-- CreateEnum
CREATE TYPE "WorkAllocationType" AS ENUM ('TASK', 'MEETING', 'SUPPORT', 'ADMIN', 'TRAINING', 'UNPLANNED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "WorkAllocationSource" AS ENUM ('MANUAL', 'TASK_ASSIGNMENT', 'CALENDAR', 'TIME_ENTRY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WorkAllocationStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WorkAllocation" (
    "id" TEXT NOT NULL,
    "type" "WorkAllocationType" NOT NULL,
    "source" "WorkAllocationSource" NOT NULL,
    "status" "WorkAllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkAllocation_userId_startsAt_idx" ON "WorkAllocation"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "WorkAllocation_projectId_startsAt_idx" ON "WorkAllocation"("projectId", "startsAt");

-- CreateIndex
CREATE INDEX "WorkAllocation_taskId_startsAt_idx" ON "WorkAllocation"("taskId", "startsAt");

-- AddForeignKey
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
