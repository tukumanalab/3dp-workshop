-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'organizer',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "googleSub" TEXT,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "joinCode" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workshop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkshopStaff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workshopId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    CONSTRAINT "WorkshopStaff_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkshopStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workshopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "defaultShared" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workshopId" INTEGER NOT NULL,
    "loginId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pinHash" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "participantId" INTEGER,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isRemixOfUid" TEXT,
    "headVersionTs" TEXT,
    "headSha256" TEXT,
    "hasThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "timestamp" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "hasThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_uid_key" ON "Workshop"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_slug_key" ON "Workshop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_joinCode_key" ON "Workshop"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStaff_workshopId_userId_key" ON "WorkshopStaff"("workshopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_workshopId_loginId_key" ON "Participant"("workshopId", "loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_uid_key" ON "Project"("uid");

-- CreateIndex
CREATE INDEX "Project_workshopId_sessionId_idx" ON "Project"("workshopId", "sessionId");

-- CreateIndex
CREATE INDEX "Project_isRemixOfUid_idx" ON "Project"("isRemixOfUid");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVersion_projectId_timestamp_key" ON "ProjectVersion"("projectId", "timestamp");
