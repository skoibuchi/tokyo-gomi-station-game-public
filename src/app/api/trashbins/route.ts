import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ゴミ箱一覧取得（バウンディングボックス対応）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minLat = parseFloat(searchParams.get("minLat") || "35.5");
  const maxLat = parseFloat(searchParams.get("maxLat") || "35.9");
  const minLng = parseFloat(searchParams.get("minLng") || "139.5");
  const maxLng = parseFloat(searchParams.get("maxLng") || "139.9");

  const bins = await prisma.trashBin.findMany({
    where: {
      lat: { gte: minLat, lte: maxLat },
      lng: { gte: minLng, lte: maxLng },
      status: "active",
    },
    orderBy: { level: "desc" },
    take: 500,
  });

  return NextResponse.json(bins);
}

// 新規ゴミ箱登録（管理者承認後に有効化）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng, name, description, binType, imageUrl, userId } = body;

  if (!lat || !lng || !userId) {
    return NextResponse.json({ error: "lat, lng, userIdは必須です" }, { status: 400 });
  }

  // 近くに既存のゴミ箱がないか確認（50m以内）
  const nearby = await prisma.trashBin.findFirst({
    where: {
      lat: { gte: lat - 0.0005, lte: lat + 0.0005 },
      lng: { gte: lng - 0.0005, lte: lng + 0.0005 },
      status: "active",
    },
  });

  if (nearby) {
    return NextResponse.json(
      { error: "近くに既存のゴミ箱があります", existingBin: nearby },
      { status: 409 }
    );
  }

  const trashBin = await prisma.trashBin.create({
    data: {
      lat,
      lng,
      name,
      description,
      binType: binType || "general",
      imageUrl,
      status: "pending",
      source: "user",
    },
  });

  // レポートを作成してポイント付与
  const points = 100;
  await prisma.report.create({
    data: {
      userId,
      trashBinId: trashBin.id,
      lat,
      lng,
      imageUrl,
      reportType: "new_discovery",
      aiPassed: true,
      pointsEarned: points,
      status: "approved",
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { totalPoints: { increment: points } },
  });

  await prisma.pointLog.create({
    data: { userId, points, reason: "新規ゴミ箱発見" },
  });

  return NextResponse.json({ trashBin, pointsEarned: points }, { status: 201 });
}
