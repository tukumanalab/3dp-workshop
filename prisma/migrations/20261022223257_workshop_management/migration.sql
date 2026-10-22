/*
  Warnings:

  - You are about to drop the column `endsAt` on the `Workshop` table. All the data in the column will be lost.
  - You are about to drop the column `startsAt` on the `Workshop` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Material" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "audience" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Material_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Material_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "participantId" INTEGER,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isTeachingMaterial" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Project" ("createdAt", "description", "hasThumbnail", "headSha256", "headVersionTs", "id", "isRemixOfUid", "isShared", "participantId", "sessionId", "sizeBytes", "title", "uid", "updatedAt", "userId", "workshopId") SELECT "createdAt", "description", "hasThumbnail", "headSha256", "headVersionTs", "id", "isRemixOfUid", "isShared", "participantId", "sessionId", "sizeBytes", "title", "uid", "updatedAt", "userId", "workshopId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_uid_key" ON "Project"("uid");
CREATE INDEX "Project_workshopId_sessionId_idx" ON "Project"("workshopId", "sessionId");
CREATE INDEX "Project_isRemixOfUid_idx" ON "Project"("isRemixOfUid");
CREATE TABLE "new_Workshop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "joinCode" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workshop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Workshop" ("createdAt", "description", "id", "isOpen", "joinCode", "ownerId", "slug", "title", "uid", "updatedAt", "visibility") SELECT "createdAt", "description", "id", "isOpen", "joinCode", "ownerId", "slug", "title", "uid", "updatedAt", "visibility" FROM "Workshop";
DROP TABLE "Workshop";
ALTER TABLE "new_Workshop" RENAME TO "Workshop";
CREATE UNIQUE INDEX "Workshop_uid_key" ON "Workshop"("uid");
CREATE UNIQUE INDEX "Workshop_slug_key" ON "Workshop"("slug");
CREATE UNIQUE INDEX "Workshop_joinCode_key" ON "Workshop"("joinCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Material_uid_key" ON "Material"("uid");

-- CreateIndex
CREATE INDEX "Material_workshopId_idx" ON "Material"("workshopId");
