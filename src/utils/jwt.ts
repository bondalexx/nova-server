import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = (process.env.ACCESS_TOKEN_TTL || "15m") as SignOptions["expiresIn"];
const REFRESH_TTL = (process.env.REFRESH_TOKEN_TTL || "7d") as SignOptions["expiresIn"];

export type AccessClaims = JwtPayload & { sub: string; typ: "access"; email?: string };
export type RefreshClaims = JwtPayload & { sub: string; typ: "refresh"; jti?: string };

export function signAccessToken(userId: string, email?: string) {
  const payload: AccessClaims = { sub: userId, typ: "access", email };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string) {
  const payload: RefreshClaims = { sub: userId, typ: "refresh" };
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as AccessClaims;
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as RefreshClaims;
}