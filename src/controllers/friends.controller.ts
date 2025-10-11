import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";

/* --------------------------- helpers --------------------------- */

const UsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username too short")
    .max(32, "Username too long")
    .regex(/^[a-z0-9_.]+$/i, "Only letters, numbers, underscore, dot"),
});

function orderPair(u1: string, u2: string) {
  return u1 < u2 ? ([u1, u2] as const) : ([u2, u1] as const);
}
/**
 * POST /friends/request
 * Body: { userId }
 * Behavior:
 *  - If no row: create PENDING
 *  - If PENDING and requester is the "other side": no-op
 *  - If ACCEPTED: 200 (already friends)
 *  - If BLOCKED: 403
 */
export async function requestFriend(req: Request, res: Response) {
  try {
    const parsed = UsernameSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const me = req.user!.id;
    const username = parsed.data.username.toLowerCase();

    // 1) Resolve target by username (unique)
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    const other = target.id;
    if (other === me)
      return res.status(400).json({ error: "Cannot friend yourself" });

    // 2) Canonicalize pair and check existing
    const [aId, bId] = orderPair(me, other);
    const existing = await prisma.friend.findUnique({
      where: { aId_bId: { aId, bId } },
      select: { status: true, requestedBy: true },
    });

    if (!existing) {
      await prisma.friend.create({
        data: {
          aId,
          bId,
          status: "PENDING",
          requestedBy: me, // record initiator
        },
      });
      return res.status(201).json({ status: "PENDING", direction: "OUTGOING" });
    }

    if (existing.status === "BLOCKED") {
      return res.status(403).json({ error: "Blocked" });
    }

    if (existing.status === "ACCEPTED") {
      return res.status(200).json({ status: "ACCEPTED" });
    }

    // Already pending → tell client whether it's incoming or outgoing for me
    const direction = existing.requestedBy === me ? "OUTGOING" : "INCOMING";
    return res.status(200).json({ status: "PENDING", direction });
  } catch (e) {
    console.error("[friends.request]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * POST /friends/accept
 * Body: { userId }
 * Only the "receiver" of a PENDING relationship can accept.
 */
export async function acceptFriend(req: Request, res: Response) {
  try {
    const parsed = UsernameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const me = req.user!.id;
    const handle = parsed.data.username.toLowerCase();

    // 1) resolve target by username
    const target = await prisma.user.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === me)
      return res.status(400).json({ error: "Cannot accept yourself" });

    // 2) locate friend row using canonical pair
    const [aId, bId] = orderPair(me, target.id);
    const rel = await prisma.friend.findUnique({
      where: { aId_bId: { aId, bId } },
      select: { status: true, requestedBy: true },
    });

    if (!rel) return res.status(404).json({ error: "No friend request found" });
    if (rel.status === "BLOCKED")
      return res.status(403).json({ error: "Blocked" });
    if (rel.status === "ACCEPTED")
      return res.status(200).json({ status: "ACCEPTED" });

    // 3) must be pending and I must be the receiver (not the requester)
    if (rel.status !== "PENDING") {
      return res.status(400).json({ error: "Invalid state" });
    }
    if (rel.requestedBy === me) {
      return res.status(400).json({
        error: "You sent this request; wait for the other user to accept",
      });
    }

    // 4) accept
    await prisma.friend.update({
      where: { aId_bId: { aId, bId } },
      data: { status: "ACCEPTED" },
    });

    return res.json({ status: "ACCEPTED" });
  } catch (e) {
    console.error("[friends.accept]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function declineFriend(req: Request, res: Response) {
  try {
    const parsed = UsernameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const me = req.user!.id;
    const handle = parsed.data.username.toLowerCase();

    // 1) resolve target by username
    const target = await prisma.user.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === me)
      return res.status(400).json({ error: "Cannot decline yourself" });

    // 2) locate relation
    const [aId, bId] = orderPair(me, target.id);
    const rel = await prisma.friend.findUnique({
      where: { aId_bId: { aId, bId } },
      select: { status: true, requestedBy: true },
    });

    if (!rel) return res.status(404).json({ error: "No friend request found" });
    if (rel.status === "BLOCKED")
      return res.status(403).json({ error: "Blocked" });
    if (rel.status === "ACCEPTED")
      return res.status(400).json({ error: "Already friends" });

    // Must be pending to decline/cancel
    if (rel.status !== "PENDING") {
      return res.status(400).json({ error: "Invalid state" });
    }

    // 3) If I am receiver -> DECLINE; if I am requester -> CANCEL (common UX)
    const amRequester = rel.requestedBy === me;

    await prisma.friend.delete({
      where: { aId_bId: { aId, bId } },
    });

    return res.json({ status: amRequester ? "CANCELED" : "DECLINED" });
  } catch (e) {
    console.error("[friends.decline]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
/**
 * GET /friends
 * Returns your accepted friends and pending requests (incoming/outgoing).
 */
export async function listFriends(req: Request, res: Response) {
  try {
    const me = req.user!.id;

    // 1) All friend relations involving me
    const rows = await prisma.friend.findMany({
      where: { OR: [{ aId: me }, { bId: me }] },
      orderBy: { updatedAt: "desc" },
      select: { aId: true, bId: true, status: true, requestedBy: true },
    });

    if (rows.length === 0) {
      return res.json({
        accepted: [],
        pendingIncoming: [],
        pendingOutgoing: [],
      });
    }

    // 2) Fetch profiles for the "other" user in each row
    const otherIds = Array.from(
      new Set(rows.map((r) => (r.aId === me ? r.bId : r.aId)))
    );

    const profiles = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    const byId = new Map(profiles.map((u) => [u.id, u]));

    // 3) Build buckets
    const accepted: any[] = [];
    const pendingIncoming: any[] = [];
    const pendingOutgoing: any[] = [];

    for (const r of rows) {
      const other = r.aId === me ? r.bId : r.aId;
      const profile = byId.get(other);
      if (!profile) continue;

      if (r.status === "ACCEPTED") {
        accepted.push(profile);
      } else if (r.status === "PENDING") {
        if (r.requestedBy === me) pendingOutgoing.push(profile);
        else pendingIncoming.push(profile);
      }
      // if BLOCKED: skip (or include in a separate list if you want)
    }

    return res.json({ accepted, pendingIncoming, pendingOutgoing });
  } catch (e) {
    console.error("[friends.list]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
