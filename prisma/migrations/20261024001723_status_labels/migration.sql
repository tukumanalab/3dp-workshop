-- CreateTable
CREATE TABLE "StatusLabel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workshopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusLabel_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "labelId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StatusOption_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "StatusLabel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "labelId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    CONSTRAINT "ProjectStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStatus_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "StatusOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StatusLabel_workshopId_idx" ON "StatusLabel"("workshopId");

-- CreateIndex
CREATE INDEX "StatusOption_labelId_idx" ON "StatusOption"("labelId");

-- CreateIndex
CREATE INDEX "ProjectStatus_optionId_idx" ON "ProjectStatus"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_projectId_labelId_key" ON "ProjectStatus"("projectId", "labelId");
