import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcLevelUp, EXP_GAIN, POINTS } from "@/lib/gameLogic";

// 応援ボタン: supportExp += 100、ユーザーポイント += 20
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId は必須です" }, { status: 400 });
  }

  const [bin, user] = await Promise.all([
    prisma.trashBin.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!bin) return NextResponse.json({ error: "ゴミ箱が見つかりません" }, { status: 404 });
  if (!user) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  // 24時間以内に同じゴミ箱を応援済みかチェック
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCheer = await prisma.pointLog.findFirst({
    where: {
      userId,
      reason: `cheer:${id}`,
      createdAt: { gte: since },
    },
  });
  if (recentCheer) {
    return NextResponse.json(
      { error: "24時間以内に既に応援しています。明日またどうぞ！" },
      { status: 429 }
    );
  }

  const result = calcLevelUp(
    bin.usageExp, bin.knowledgeExp, bin.supportExp,
    0, 0, EXP_GAIN.support_cheer
  );

  const updatedBin = await prisma.trashBin.update({
    where: { id },
    data: {
      usageExp:     result.newUsageExp,
      knowledgeExp: result.newKnowledgeExp,
      supportExp:   result.newSupportExp,
      exp:          result.newTotalExp,
      level:        result.newLevel,
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { totalPoints: { increment: POINTS.popular_contribution } },
  });

  // reason に ゴミ箱IDを含めることで重複チェックに使用
  await prisma.pointLog.create({
    data: { userId, points: POINTS.popular_contribution, reason: `cheer:${id}` },
  });

  return NextResponse.json({
    bin: updatedBin,
    pointsEarned: POINTS.popular_contribution,
    leveledUp: result.leveledUp,
    userTotalPoints: updatedUser.totalPoints,
    message: `応援した！ +${POINTS.popular_contribution}pt${result.leveledUp ? " 🎉 レベルアップ！" : ""}`,
  });
}
