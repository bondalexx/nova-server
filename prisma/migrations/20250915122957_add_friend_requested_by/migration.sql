/*
  Warnings:

  - Added the required column `requestedBy` to the `Friend` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Friend" ADD COLUMN     "requestedBy" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Friend_requestedBy_idx" ON "public"."Friend"("requestedBy");

-- AddForeignKey
ALTER TABLE "public"."Friend" ADD CONSTRAINT "Friend_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
