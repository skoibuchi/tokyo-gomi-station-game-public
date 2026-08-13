-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "spotType" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "sourceId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Spot_sourceId_key" ON "Spot"("sourceId");

-- CreateIndex
CREATE INDEX "Spot_lat_lng_idx" ON "Spot"("lat", "lng");
