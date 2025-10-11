/*
  Warnings:

  - You are about to drop the column `isDirect` on the `Room` table. All the data in the column will be lost.
  - The `role` column on the `RoomMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."RoomKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."RoomRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."FriendStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "isDirect",
ADD COLUMN     "kind" "public"."RoomKind" NOT NULL DEFAULT 'GROUP',
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."RoomMember" DROP COLUMN "role",
ADD COLUMN     "role" "public"."RoomRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."Friend" (
    "id" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "status" "public"."FriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomDirect" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userSmallId" TEXT NOT NULL,
    "userLargeId" TEXT NOT NULL,

    CONSTRAINT "RoomDirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friend_aId_idx" ON "public"."Friend"("aId");

-- CreateIndex
CREATE INDEX "Friend_bId_idx" ON "public"."Friend"("bId");

-- CreateIndex
CREATE UNIQUE INDEX "Friend_aId_bId_key" ON "public"."Friend"("aId", "bId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDirect_roomId_key" ON "public"."RoomDirect"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDirect_userSmallId_userLargeId_key" ON "public"."RoomDirect"("userSmallId", "userLargeId");

-- AddForeignKey
ALTER TABLE "public"."Friend" ADD CONSTRAINT "Friend_aId_fkey" FOREIGN KEY ("aId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friend" ADD CONSTRAINT "Friend_bId_fkey" FOREIGN KEY ("bId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomDirect" ADD CONSTRAINT "RoomDirect_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
