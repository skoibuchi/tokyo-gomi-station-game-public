-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrashBin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "binType" TEXT NOT NULL DEFAULT 'general',
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "usageExp" INTEGER NOT NULL DEFAULT 0,
    "knowledgeExp" INTEGER NOT NULL DEFAULT 0,
    "supportExp" INTEGER NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "riskScore" REAL NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'user',
    "osmId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TrashBin" ("binType", "createdAt", "description", "exp", "id", "imageUrl", "knowledgeExp", "lat", "level", "lng", "name", "osmId", "source", "status", "supportExp", "updatedAt", "usageExp", "useCount") SELECT "binType", "createdAt", "description", "exp", "id", "imageUrl", "knowledgeExp", "lat", "level", "lng", "name", "osmId", "source", "status", "supportExp", "updatedAt", "usageExp", "useCount" FROM "TrashBin";
DROP TABLE "TrashBin";
ALTER TABLE "new_TrashBin" RENAME TO "TrashBin";
CREATE UNIQUE INDEX "TrashBin_osmId_key" ON "TrashBin"("osmId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
