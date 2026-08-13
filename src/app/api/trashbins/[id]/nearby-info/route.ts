import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findNearbySpots } from "@/lib/nearbySpots";
import { generateNearbyComment } from "@/lib/watsonx";

// bin.name が null のとき、最寄りスポットの住所からエリア名を推定する
function resolveDisplayName(
  binName: string | null,
  spots: { name: string; address: string }[]
): string {
  if (binName) return binName;
  // 住所の「東京都XX区YY」から「YY」部分を取り出す
  for (const s of spots) {
    const m = s.address.match(/区(.+?\d丁目)/);
    if (m) return `${m[1]}のゴミ箱`;
    const m2 = s.address.match(/区(.+?)(\d|$)/);
    if (m2) return `${m2[1].trim()}のゴミ箱`;
  }
  return "どこかのゴミ箱";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bin = await prisma.trashBin.findUnique({
    where: { id },
    select: { id: true, name: true, lat: true, lng: true, level: true },
  });

  if (!bin) {
    return NextResponse.json({ error: "ゴミ箱が見つかりません" }, { status: 404 });
  }

  const [spots, recentPhotos] = await Promise.all([
    findNearbySpots(bin.lat, bin.lng, 500, 3),
    prisma.report.findMany({
      where: { trashBinId: id, imageUrl: { not: null }, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        imageUrl: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const displayName = resolveDisplayName(bin.name, spots);
  const comment = await generateNearbyComment(displayName, bin.level, spots);

  return NextResponse.json({ spots, comment, recentPhotos });
}
