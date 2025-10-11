/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the `RoomDirect` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[directKey]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."RoomType" AS ENUM ('DIRECT', 'GROUP');

-- AlterEnum
ALTER TYPE "public"."RoomRole" ADD VALUE 'OWNER';

-- DropForeignKey
ALTER TABLE "public"."RoomDirect" DROP CONSTRAINT "RoomDirect_roomId_fkey";

-- DropIndex
DROP INDEX "public"."Room_createdAt_idx";

-- DropIndex
DROP INDEX "public"."RoomMember_userId_idx";

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "createdBy",
DROP COLUMN "kind",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "directKey" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "type" "public"."RoomType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."RoomMember" ADD COLUMN     "isMuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."RoomDirect";

-- DropEnum
DROP TYPE "public"."RoomKind";

-- CreateIndex
CREATE UNIQUE INDEX "Room_directKey_key" ON "public"."Room"("directKey");

-- CreateIndex
CREATE INDEX "Room_lastMessageAt_idx" ON "public"."Room"("lastMessageAt");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
