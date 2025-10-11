import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signinSchema, signupSchema } from "../validators/auth.schema";
import { signAccessToken, signRefreshToken, verifyRefresh } from "../utils/jwt";

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true on HTTPS in prod
    sameSite: "lax", // 'none' + secure:true if cross-site HTTPS
    path: "/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // mirror REFRESH_TOKEN_TTL
  });
}

export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  console.log(parsed);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, displayName, username } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, username },
  });

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);

  return res.status(201).json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
}

export async function signin(req: Request, res: Response) {
  const parsed = signinSchema.safeParse(req.body);
  console.log(parsed);

  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);

  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "No refresh token" });

  try {
    const payload = verifyRefresh(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "User not found" });

    // (Optional) rotation: issue a new refresh + set cookie again.
    // const newRefresh = signRefreshToken(user.id);
    // setRefreshCookie(res, newRefresh);

    const newAccess = signAccessToken(user.id, user.email);
    return res.json({ accessToken: newAccess });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function logout(_req: Request, res: Response) {
  // if you store refresh JTI in DB, revoke here
  res.clearCookie("refresh_token", { path: "/auth" });
  return res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}
