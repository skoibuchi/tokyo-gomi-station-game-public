import { prisma } from "./prisma";

export interface NearbySpot {
  name: string;
  lat: number;
  lng: number;
  address: string;
  spotType: string;
  category: "cultural" | "facility";
  distanceM: number;
  description: string;
  openTime: string;
  closeTime: string;
  hoursNote: string;
  url: string;
  fee: string;
}

// Haversine公式で2点間の距離（メートル）
function calcDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 緯度・経度 radiusM メートルのバウンディングボックス（度数）
function bboxDelta(radiusM: number, lat: number) {
  const latDelta = radiusM / 111000;
  const lngDelta = radiusM / (111000 * Math.cos((lat * Math.PI) / 180));
  return { latDelta, lngDelta };
}

// ゴミ箱の緯度・経度から半径radiusM以内のスポットを返す
export async function findNearbySpots(
  lat: number,
  lng: number,
  radiusM = 500,
  maxPerCategory = 3
): Promise<NearbySpot[]> {
  const { latDelta, lngDelta } = bboxDelta(radiusM, lat);

  // バウンディングボックスで絞り込んでからHaversineで正確な距離を計算
  const candidates = await prisma.spot.findMany({
    where: {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    },
  });

  const withDistance = candidates
    .map((s) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      spotType: s.spotType,
      category: s.category as "cultural" | "facility",
      distanceM: calcDistanceM(lat, lng, s.lat, s.lng),
      description: s.description,
      openTime: s.openTime,
      closeTime: s.closeTime,
      hoursNote: s.hoursNote,
      url: s.url,
      fee: s.fee,
    }))
    .filter((s) => s.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  // カテゴリごとに最大 maxPerCategory 件に絞る
  const cultural = withDistance.filter((s) => s.category === "cultural").slice(0, maxPerCategory);
  const facility = withDistance.filter((s) => s.category === "facility").slice(0, maxPerCategory);

  return [...cultural, ...facility].sort((a, b) => a.distanceM - b.distanceM);
}
