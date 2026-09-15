/*
  Warnings:

  - You are about to drop the column `startDate` on the `ProjectMember` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "ProjectMember" DROP COLUMN "startDate";

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "taskId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockerComment" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "BlockerComment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerComment" ADD CONSTRAINT "BlockerComment_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Blocker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerComment" ADD CONSTRAINT "BlockerComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
