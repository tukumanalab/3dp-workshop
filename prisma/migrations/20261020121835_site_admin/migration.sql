-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "siteName" TEXT NOT NULL DEFAULT '',
    "siteDescription" TEXT NOT NULL DEFAULT '',
    "footerText" TEXT NOT NULL DEFAULT '',
    "operatorName" TEXT NOT NULL DEFAULT '',
    "operatorContact" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
