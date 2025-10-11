import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

async function ensureMember(roomId: string, userId: string) {
  return prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
}

/* ---------- GET /rooms/:roomId/messages ---------- */
export async function getRoomMessages(req: Request, res: Response) {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  const { roomId } = req.params;
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const cursor = req.query.cursor as string | undefined;

  // verify membership
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: me } },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });

  const items = await prisma.message.findMany({
    where: { roomId },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roomId: true,
      senderId: true,
      content: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  const nextCursor = items.length === limit ? items[items.length - 1].id : null;
  res.json({ items, nextCursor });
}
