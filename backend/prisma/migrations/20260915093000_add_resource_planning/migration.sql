-- V0.1 resource planning: capacity, availability, planned task assignments, and timeline blocks.
ALTER TABLE "User" ADD COLUMN "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 2400;

CREATE TYPE "TimeBlockKind" AS ENUM ('WORK', 'MEETING', 'SUPPORT', 'OTHER');

CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSkill" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId", "skillId")
);

CREATE TABLE "TaskSkillRequirement" (
    "taskId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "TaskSkillRequirement_pkey" PRIMARY KEY ("taskId", "skillId")
);

CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "TimeBlockKind" NOT NULL DEFAULT 'WORK',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "assignmentId" TEXT,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");
CREATE UNIQUE INDEX "TimeBlock_assignmentId_key" ON "TimeBlock"("assignmentId");
CREATE INDEX "TaskAssignment_userId_scheduledFor_idx" ON "TaskAssignment"("userId", "scheduledFor");
CREATE INDEX "TaskAssignment_taskId_scheduledFor_idx" ON "TaskAssignment"("taskId", "scheduledFor");
CREATE INDEX "TimeBlock_userId_startsAt_idx" ON "TimeBlock"("userId", "startsAt");
CREATE INDEX "TimeBlock_projectId_startsAt_idx" ON "TimeBlock"("projectId", "startsAt");
CREATE INDEX "Availability_userId_startsAt_idx" ON "Availability"("userId", "startsAt");

ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskSkillRequirement" ADD CONSTRAINT "TaskSkillRequirement_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskSkillRequirement" ADD CONSTRAINT "TaskSkillRequirement_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
