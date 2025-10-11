import { Request, Response } from "express";
import { PrismaClient, RoomType, RoomRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { z } from "zod";

/* ---------- helpers ---------- */

const directKeyFor = (u1: string, u2: string) => {
  const [a, b] = [u1, u2].sort();
  return `${a}:${b}`;
};

/* --------------------------- Controllers --------------------------- */

/**
 * POST /rooms/direct
 * Body: { peerId: string }
 * Ensures a DM room exists between me and peer; returns the room.
 * - If exists → returns it
 * - If not → creates it (race-safe against concurrent requests)
 */
export async function postDirectRoom(req: Request, res: Response) {
  try {
    const me = req.user!.id;
    const { peerId } = req.body as { peerId?: string };

    if (!peerId || peerId === me) {
      return res.status(400).json({ error: "Invalid peerId" });
    }

    const key = directKeyFor(me, peerId);

    // 1) try find
    const found = await prisma.room.findUnique({
      where: { directKey: key },
      include: { members: true },
    });
    if (found) return res.json(found);

    // 2) try create (handle unique race with P2002)
    try {
      const created = await prisma.room.create({
        data: {
          type: RoomType.DIRECT,
          directKey: key,
          createdById: me,
          members: {
            create: [
              { userId: me, role: RoomRole.OWNER },
              { userId: peerId, role: RoomRole.MEMBER },
            ],
          },
        },
        include: { members: true },
      });
      return res.status(201).json(created);
    } catch (e: any) {
      // Another request created it first
      if (e?.code === "P2002") {
        const existing = await prisma.room.findUnique({
          where: { directKey: key },
          include: { members: true },
        });
        if (existing) return res.json(existing);
      }
      throw e;
    }
  } catch (e) {
    console.error("[rooms.direct]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * GET /rooms?scope=recent|all
 * recent → rooms with activity (lastMessageAt not null), ordered by lastMessageAt desc
 * all    → all rooms the user is a member of
 * Returns unreadCount as well.
 */
export async function listRooms(req: Request, res: Response) {
  try {
    const me = req.user!.id;

    const scopeParam = String(req.query.scope || "recent").toLowerCase();
    const scope: "recent" | "all" = scopeParam === "all" ? "all" : "recent";

    const whereBase = { members: { some: { userId: me } } } as const;
    const where =
      scope === "recent"
        ? { ...whereBase, lastMessageAt: { not: null } }
        : whereBase;

    const rooms = await prisma.room.findMany({
      where, // ✅ actually use the computed filter
      orderBy: [
        { lastMessageAt: "desc" }, // active first
        { createdAt: "desc" }, // tie-breaker
      ],
      include: {
        members: {
          select: {
            userId: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    // Compute unread counts (per-room)
    const enriched = await Promise.all(
      rooms.map(async (r) => {
        const mine = r.members.find((m) => m.userId === me);
        const after = mine?.lastReadAt ?? new Date(0);

        const unread = await prisma.message.count({
          where: {
            roomId: r.id,
            deletedAt: null,
            createdAt: { gt: after },
          },
        });

        // You may also want to surface "otherUser" for DIRECT rooms:
        const otherMember = r.members.find((m) => m.userId !== me);
        const otherUser = otherMember?.user ?? null;

        return {
          ...r,
          unreadCount: unread,
          otherUser, // convenient for client DM list
        };
      })
    );

    return res.json(enriched);
  } catch (e) {
    console.error("[rooms.list]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function createGroupRoom(req: Request, res: Response) {
  try {
    const me = req.user!.id;
    const { name, memberIds = [] } = req.body as {
      name?: string;
      memberIds?: string[];
    };

    if (!name?.trim()) return res.status(400).json({ error: "name required" });

    const unique = Array.from(new Set([me, ...memberIds]));
    const room = await prisma.room.create({
      data: {
        type: RoomType.GROUP,
        name: name.trim(),
        createdById: me,
        members: {
          create: unique.map((uid) => ({
            userId: uid,
            role: uid === me ? RoomRole.OWNER : RoomRole.MEMBER,
          })),
        },
      },
      include: { members: true },
    });

    return res.status(201).json(room);
  } catch (e) {
    console.error("[rooms.create]", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
