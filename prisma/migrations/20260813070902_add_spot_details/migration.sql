-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Spot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "spotType" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "openTime" TEXT NOT NULL DEFAULT '',
    "closeTime" TEXT NOT NULL DEFAULT '',
    "hoursNote" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "fee" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Spot" ("address", "category", "id", "lat", "lng", "name", "sourceId", "spotType") SELECT "address", "category", "id", "lat", "lng", "name", "sourceId", "spotType" FROM "Spot";
DROP TABLE "Spot";
ALTER TABLE "new_Spot" RENAME TO "Spot";
CREATE UNIQUE INDEX "Spot_sourceId_key" ON "Spot"("sourceId");
CREATE INDEX "Spot_lat_lng_idx" ON "Spot"("lat", "lng");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
