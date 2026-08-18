import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { judgeTrashBinImage } from "@/lib/watsonx";
import { calcLevelUp, EXP_GAIN, POINTS } from "@/lib/gameLogic";
import { writeFile, mkdir, rename } from "fs/promises";
import path from "path";

// 画像Base64を含むリクエストのためボディサイズ制限を緩和
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

// Base64画像をファイルに保存して公開URLパスを返す
// 保存先: public/uploads/{trashBinId or "new"}/{timestamp}-{random}.{ext}
async function saveImageFile(
  imageBase64: string,
  mimeType: string,
  groupId: string  // trashBinId or report.id（新規発見時）
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", groupId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(imageBase64, "base64"));
  return `/uploads/${groupId}/${filename}`;
}

// レポート（ゴミ箱利用・新規発見）投稿
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, trashBinId, lat, lng, imageBase64, mimeType, reportType } = body;

  if (!userId || !lat || !lng) {
    return NextResponse.json(
      { error: "userId, lat, lng は必須です" },
      { status: 400 }
    );
  }

  // ユーザー確認
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  // 画像がある場合のみAI判定
  let aiResult = null;
  let imageUrl: string | null = null;
  const hasImage = !!imageBase64;

  if (hasImage) {
    aiResult = await judgeTrashBinImage(imageBase64, mimeType || "image/jpeg");
    const aiPassed = aiResult.hasTrashBin && aiResult.isValid && aiResult.confidence >= 0.5;
    if (!aiPassed) {
      return NextResponse.json(
        {
          error: "AIがゴミ箱を判定できませんでした",
          aiResult,
          message: aiResult.reason,
        },
        { status: 422 }
      );
    }
    // trashBinId がある場合はそのID、新規発見は仮フォルダ "new" に保存（後でリネーム）
    imageUrl = await saveImageFile(imageBase64, mimeType || "image/jpeg", trashBinId || "_new_tmp");
  }

  // 利用ポイント計算（写真あり利用時は +20pt ボーナス）
  const isNewDiscovery = reportType === "new_discovery";
  const points = isNewDiscovery
    ? POINTS.new_discovery
    : POINTS.use + (hasImage ? POINTS.photo_bonus : 0);

  // レポート作成
  const report = await prisma.report.create({
    data: {
      userId,
      trashBinId: trashBinId || null,
      lat,
      lng,
      imageUrl,
      reportType: reportType || "use",
      aiResult: aiResult ? JSON.stringify(aiResult) : null,
      aiPassed: hasImage,
      pointsEarned: points,
      status: "approved",
    },
  });

  // 新規発見かつ画像あり → 仮フォルダをレポートIDでリネーム
  if (!trashBinId && imageUrl) {
    const uploadsBase = path.join(process.cwd(), "public", "uploads");
    const tmpDir = path.join(uploadsBase, "_new_tmp");
    const finalDir = path.join(uploadsBase, report.id);
    try {
      await rename(tmpDir, finalDir);
      // imageUrl のパスも更新
      const newImageUrl = imageUrl.replace("/_new_tmp/", `/${report.id}/`);
      await prisma.report.update({ where: { id: report.id }, data: { imageUrl: newImageUrl } });
      imageUrl = newImageUrl;
    } catch {
      // リネーム失敗しても処理は続行
    }
  }

  // ユーザーポイント加算
  await prisma.user.update({
    where: { id: userId },
    data: { totalPoints: { increment: points } },
  });

  await prisma.pointLog.create({
    data: {
      userId,
      points,
      reason: isNewDiscovery ? "新規ゴミ箱発見" : "ゴミ箱利用",
    },
  });

  // ゴミ箱の3種EXPを加算 & dirtLevelをriskScoreに反映（既存ゴミ箱の場合）
  let leveledUp = false;
  let updatedBin = null;
  if (trashBinId) {
    const bin = await prisma.trashBin.findUnique({ where: { id: trashBinId } });
    if (bin) {
      // 初回訪問ボーナス判定（今回のレポートを除いて確認）
      const prevReport = await prisma.report.findFirst({
        where: { trashBinId, userId, status: "approved", id: { not: report.id } },
      });
      const isFirstVisit = !prevReport;

      const addUsage     = EXP_GAIN.usage_use + (isFirstVisit ? EXP_GAIN.usage_first_visit : 0);
      const addKnowledge = hasImage ? EXP_GAIN.knowledge_photo : 0;
      const addSupport   = 0;

      const result = calcLevelUp(
        bin.usageExp, bin.knowledgeExp, bin.supportExp,
        addUsage, addKnowledge, addSupport
      );
      leveledUp = result.leveledUp;

      // 写真がある場合 dirtLevel をriskScoreに反映
      // 既存スコアと移動平均（直近投稿を30%の重みで反映）
      const dirtLevel: number = aiResult?.dirtLevel ?? 0;
      const dirtBonus = dirtLevel / 4 * 0.3; // 最大+0.3の加算
      const newRiskScore = hasImage
        ? Math.min(1.0, Math.round((bin.riskScore * 0.7 + dirtBonus) * 1000) / 1000)
        : bin.riskScore;

      if (hasImage) {
        console.log(
          `[riskScore更新] ${bin.name || bin.id}: ${bin.riskScore} → ${newRiskScore}` +
          ` (dirtLevel=${dirtLevel}, dirtBonus=${dirtBonus.toFixed(3)})`
        );
      }

      updatedBin = await prisma.trashBin.update({
        where: { id: trashBinId },
        data: {
          usageExp:     result.newUsageExp,
          knowledgeExp: result.newKnowledgeExp,
          supportExp:   result.newSupportExp,
          exp:          result.newTotalExp,
          level:        result.newLevel,
          useCount:     { increment: 1 },
          ...(hasImage && { riskScore: newRiskScore }),
        },
      });
    }
  }

  return NextResponse.json({
    report,
    pointsEarned: points,
    aiResult,
    leveledUp,
    updatedBin,
    message: `${points}ポイント獲得！${leveledUp ? "🎉 ゴミ箱がレベルアップしました！" : ""}`,
  });
}

// レポート一覧取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const reports = await prisma.report.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true } },
      trashBin: { select: { id: true, name: true, level: true } },
    },
  });

  return NextResponse.json(reports);
}
