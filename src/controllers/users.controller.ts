import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// clamp helper
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/**
 * GET /users/search?q=alex&limit=20
 * Auth required
 *
 * Returns up to `limit` users (excluding self) matching q in displayName or email (case-insensitive),
 * plus relationship status to the current user: "ACCEPTED" | "PENDING_IN" | "PENDING_OUT" | "NONE".
 */
export async function searchUsers(req: Request, res: Response) {
  try {
    const me = req.user!.id;
    const q = String(req.query.q ?? "").trim();
    const limit = clamp(Number(req.query.limit ?? 20), 1, 50);

    // basic input guard: short queries return empty fast (or you can 400)
    if (q.length < 2) return res.json({ items: [] });

    // 1) find users matching q (exclude me)
    const users = await prisma.user.findMany({
      where: {
        id: { not: me },
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, displayName: true, email: true, avatarUrl: true },
      take: limit,
      orderBy: { displayName: "asc" }, // simple deterministic order
    });

    if (users.length === 0) return res.json({ items: [] });

    // 2) load existing friend rows between me and these users
    const otherIds = users.map((u) => u.id);
    const relations = await prisma.friend.findMany({
      where: {
        OR: [
          { aId: me, bId: { in: otherIds } },
          { bId: me, aId: { in: otherIds } },
        ],
      },
      select: { aId: true, bId: true, status: true },
    });

    // 3) map: userId -> status (relative to me)
    const relMap = new Map<string, "ACCEPTED" | "PENDING_IN" | "PENDING_OUT">();
    for (const r of relations) {
      if (r.status === "ACCEPTED") {
        const other = r.aId === me ? r.bId : r.aId;
        relMap.set(other, "ACCEPTED");
      } else if (r.status === "PENDING") {
        // heuristic: if I am aId, call it outgoing; if I am bId, incoming
        if (r.aId === me) relMap.set(r.bId, "PENDING_OUT");
        else relMap.set(r.aId, "PENDING_IN");
      }
      // if BLOCKED is added later, you might skip or mark as "BLOCKED"
    }

    const items = users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null,
      relation: relMap.get(u.id) ?? "NONE",
    }));

    return res.json({ items });
  } catch (e) {
    console.error("[users.search]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
