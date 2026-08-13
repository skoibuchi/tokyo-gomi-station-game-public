import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcLevelUp } from "@/lib/gameLogic";

// 特定ゴミ箱の取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bin = await prisma.trashBin.findUnique({
    where: { id },
    include: {
      reports: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!bin) {
    return NextResponse.json({ error: "ゴミ箱が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(bin);
}

// ゴミ箱のレベルアップ処理（内部利用）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { addExp } = await request.json();

  const bin = await prisma.trashBin.findUnique({ where: { id } });
  if (!bin) {
    return NextResponse.json({ error: "ゴミ箱が見つかりません" }, { status: 404 });
  }

  const result = calcLevelUp(
    bin.usageExp, bin.knowledgeExp, bin.supportExp,
    addExp, 0, 0
  );

  const updated = await prisma.trashBin.update({
    where: { id },
    data: {
      usageExp:     result.newUsageExp,
      knowledgeExp: result.newKnowledgeExp,
      supportExp:   result.newSupportExp,
      exp:          result.newTotalExp,
      level:        result.newLevel,
      useCount:     { increment: 1 },
    },
  });

  return NextResponse.json({ ...updated, leveledUp: result.leveledUp });
}
