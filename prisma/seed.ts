import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 新しいレベル計算式（gameLogic.ts と同じ threshold(lv) = 50*(lv-1)^1.8）
function expThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.8));
}
// lv + その内での進捗率（0.0〜1.0）から総合EXPを算出
function totalExpFor(level: number, progress = 0.5): number {
  const base = expThreshold(level);
  const next = expThreshold(level + 1);
  return Math.round(base + (next - base) * progress);
}

// デモ用シードデータ
// 初期地図表示（zoom12・東京中心）で全件が視野に入る範囲に配置
// 各キャラ画像・個性ラベルがデモで映えるよう3種EXPを設定
const trashBinSeeds = [
  // ── Lv1〜4（gomi_lv1） ──
  { lat: 35.6572, lng: 139.7022, name: "道玄坂入口",         binType: "general",    level:  3, useCount:  28, source: "user",
    usageExp: Math.round(totalExpFor( 3)*0.80), knowledgeExp: Math.round(totalExpFor( 3)*0.15), supportExp: Math.round(totalExpFor( 3)*0.05) },
  { lat: 35.6880, lng: 139.7024, name: "歌舞伎町入口",       binType: "general",    level:  3, useCount:  28, source: "user",
    usageExp: Math.round(totalExpFor( 3)*0.70), knowledgeExp: Math.round(totalExpFor( 3)*0.20), supportExp: Math.round(totalExpFor( 3)*0.10) },
  { lat: 35.6700, lng: 139.6970, name: "代々木公園中央",     binType: "recycle",    level:  3, useCount:  31, source: "user",
    usageExp: Math.round(totalExpFor( 3)*0.40), knowledgeExp: Math.round(totalExpFor( 3)*0.30), supportExp: Math.round(totalExpFor( 3)*0.30) },
  { lat: 35.7142, lng: 139.7752, name: "不忍池周辺",         binType: "general",    level:  4, useCount:  41, source: "user",
    usageExp: Math.round(totalExpFor( 4)*0.50), knowledgeExp: Math.round(totalExpFor( 4)*0.30), supportExp: Math.round(totalExpFor( 4)*0.20) },

  // ── Lv5〜9（gomi_lv2）── 個性バリエーション
  { lat: 35.6714, lng: 139.6952, name: "代々木公園北口",     binType: "mixed",      level:  5, useCount:  52, source: "osm",
    usageExp: Math.round(totalExpFor( 5)*0.65), knowledgeExp: Math.round(totalExpFor( 5)*0.20), supportExp: Math.round(totalExpFor( 5)*0.15) },
  { lat: 35.6271, lng: 139.7762, name: "フジテレビ前",       binType: "general",    level:  5, useCount:  51, source: "user",
    usageExp: Math.round(totalExpFor( 5)*0.30), knowledgeExp: Math.round(totalExpFor( 5)*0.30), supportExp: Math.round(totalExpFor( 5)*0.40) }, // 応援型
  { lat: 35.6905, lng: 139.6995, name: "新宿中央公園",       binType: "recycle",    level:  6, useCount:  63, source: "osm",
    usageExp: Math.round(totalExpFor( 6)*0.25), knowledgeExp: Math.round(totalExpFor( 6)*0.55), supportExp: Math.round(totalExpFor( 6)*0.20) }, // 知識型
  { lat: 35.6800, lng: 139.7685, name: "皇居前広場",         binType: "general",    level:  6, useCount:  67, source: "osm",
    usageExp: Math.round(totalExpFor( 6)*0.65), knowledgeExp: Math.round(totalExpFor( 6)*0.20), supportExp: Math.round(totalExpFor( 6)*0.15) },
  { lat: 35.7160, lng: 139.7731, name: "上野動物園前",       binType: "recycle",    level:  7, useCount:  76, source: "osm",
    usageExp: Math.round(totalExpFor( 7)*0.20), knowledgeExp: Math.round(totalExpFor( 7)*0.55), supportExp: Math.round(totalExpFor( 7)*0.25) }, // 知識型
  { lat: 35.6286, lng: 139.7388, name: "品川駅港南口",       binType: "pet_bottle", level:  7, useCount:  74, source: "osm",
    usageExp: Math.round(totalExpFor( 7)*0.65), knowledgeExp: Math.round(totalExpFor( 7)*0.20), supportExp: Math.round(totalExpFor( 7)*0.15) },
  { lat: 35.6580, lng: 139.7016, name: "渋谷スクランブル前", binType: "general",    level:  8, useCount:  85, source: "osm",
    usageExp: Math.round(totalExpFor( 8)*0.70), knowledgeExp: Math.round(totalExpFor( 8)*0.20), supportExp: Math.round(totalExpFor( 8)*0.10) }, // 超人気
  { lat: 35.6984, lng: 139.7731, name: "秋葉原電気街口",     binType: "general",    level:  8, useCount:  88, source: "osm",
    usageExp: Math.round(totalExpFor( 8)*0.45), knowledgeExp: Math.round(totalExpFor( 8)*0.40), supportExp: Math.round(totalExpFor( 8)*0.15) },
  { lat: 35.7148, lng: 139.7967, name: "浅草寺前",           binType: "general",    level:  9, useCount:  97, source: "osm",
    usageExp: Math.round(totalExpFor( 9)*0.30), knowledgeExp: Math.round(totalExpFor( 9)*0.55), supportExp: Math.round(totalExpFor( 9)*0.15) }, // 知識型
  { lat: 35.6267, lng: 139.7753, name: "お台場海浜公園",     binType: "recycle",    level:  9, useCount:  93, source: "osm",
    usageExp: Math.round(totalExpFor( 9)*0.25), knowledgeExp: Math.round(totalExpFor( 9)*0.25), supportExp: Math.round(totalExpFor( 9)*0.50) }, // 応援型

  // ── Lv10〜19（gomi_lv3） ──
  { lat: 35.7148, lng: 139.7745, name: "上野公園入口",       binType: "mixed",      level: 10, useCount: 110, source: "osm",
    usageExp: Math.round(totalExpFor(10)*0.25), knowledgeExp: Math.round(totalExpFor(10)*0.60), supportExp: Math.round(totalExpFor(10)*0.15) }, // 知識型
  { lat: 35.6628, lng: 139.7312, name: "六本木ヒルズ前",     binType: "mixed",      level: 11, useCount: 125, source: "osm",
    usageExp: Math.round(totalExpFor(11)*0.65), knowledgeExp: Math.round(totalExpFor(11)*0.20), supportExp: Math.round(totalExpFor(11)*0.15) }, // 超人気
  { lat: 35.6586, lng: 139.7003, name: "渋谷駅ハチ公口",     binType: "general",    level: 12, useCount: 142, source: "osm",
    usageExp: Math.round(totalExpFor(12)*0.70), knowledgeExp: Math.round(totalExpFor(12)*0.15), supportExp: Math.round(totalExpFor(12)*0.15) }, // 超人気
  { lat: 35.6896, lng: 139.7006, name: "新宿駅東口",         binType: "general",    level: 15, useCount: 201, source: "osm",
    usageExp: Math.round(totalExpFor(15)*0.35), knowledgeExp: Math.round(totalExpFor(15)*0.35), supportExp: Math.round(totalExpFor(15)*0.30) }, // バランス
  { lat: 35.6812, lng: 139.7671, name: "東京駅丸の内口",     binType: "general",    level: 18, useCount: 198, source: "osm",
    usageExp: Math.round(totalExpFor(18)*0.45), knowledgeExp: Math.round(totalExpFor(18)*0.30), supportExp: Math.round(totalExpFor(18)*0.25) },

  // ── Lv20〜29（gomi_lv4） ──
  { lat: 35.7113, lng: 139.7974, name: "仲見世通り",         binType: "general",    level: 20, useCount: 230, source: "osm",
    usageExp: Math.round(totalExpFor(20)*0.20), knowledgeExp: Math.round(totalExpFor(20)*0.55), supportExp: Math.round(totalExpFor(20)*0.25) }, // 知識型
  { lat: 35.6650, lng: 139.7300, name: "麻布十番商店街",     binType: "general",    level: 25, useCount: 310, source: "osm",
    usageExp: Math.round(totalExpFor(25)*0.25), knowledgeExp: Math.round(totalExpFor(25)*0.25), supportExp: Math.round(totalExpFor(25)*0.50) }, // 応援型

  // ── Lv30以上（gomi_lv5） ──
  { lat: 35.6895, lng: 139.7000, name: "新宿サザンテラス",   binType: "mixed",      level: 30, useCount: 400, source: "osm",
    usageExp: Math.round(totalExpFor(30)*0.65), knowledgeExp: Math.round(totalExpFor(30)*0.20), supportExp: Math.round(totalExpFor(30)*0.15) }, // 超人気
  { lat: 35.6580, lng: 139.7515, name: "銀座四丁目",         binType: "general",    level: 50, useCount: 999, source: "osm",
    usageExp: Math.round(totalExpFor(50)*0.35), knowledgeExp: Math.round(totalExpFor(50)*0.35), supportExp: Math.round(totalExpFor(50)*0.30) }, // バランス
];

async function main() {
  console.log("シードデータを投入中...");

  // デモユーザーを作成
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "tanaka@demo.com" },
      update: { totalPoints: 1250 },
      create: { name: "ゴミハンター田中", email: "tanaka@demo.com", totalPoints: 1250 },
    }),
    prisma.user.upsert({
      where: { email: "sato@demo.com" },
      update: { totalPoints: 980 },
      create: { name: "エコ戦士佐藤", email: "sato@demo.com", totalPoints: 980 },
    }),
    prisma.user.upsert({
      where: { email: "yamada@demo.com" },
      update: { totalPoints: 720 },
      create: { name: "クリーン山田", email: "yamada@demo.com", totalPoints: 720 },
    }),
  ]);

  console.log(`デモユーザー ${users.length} 件作成`);

  // ゴミ箱データを投入
  let count = 0;
  for (const seed of trashBinSeeds) {
    const totalExp = seed.usageExp + seed.knowledgeExp + seed.supportExp;
    await prisma.trashBin.upsert({
      where: { osmId: `seed_${seed.lat}_${seed.lng}` },
      update: {
        level: seed.level,
        exp: totalExp,
        usageExp: seed.usageExp,
        knowledgeExp: seed.knowledgeExp,
        supportExp: seed.supportExp,
        useCount: seed.useCount,
      },
      create: {
        lat: seed.lat,
        lng: seed.lng,
        name: seed.name,
        binType: seed.binType,
        source: seed.source,
        level: seed.level,
        exp: totalExp,
        usageExp: seed.usageExp,
        knowledgeExp: seed.knowledgeExp,
        supportExp: seed.supportExp,
        useCount: seed.useCount,
        osmId: `seed_${seed.lat}_${seed.lng}`,
        status: "active",
      },
    });
    count++;
  }

  console.log(`ゴミ箱データ ${count} 件投入完了`);
  console.log("シード完了！");
}

async function clearSeeds() {
  console.log("シードデータを削除中...");

  // osmId が "seed_" で始まるゴミ箱（シードデータ）を対象にする
  const bins = await prisma.trashBin.findMany({
    where: { osmId: { startsWith: "seed_" } },
    select: { id: true },
  });
  const binIds = bins.map((b) => b.id);

  // 関連レポートを先に削除
  const deletedReports = await prisma.report.deleteMany({
    where: { trashBinId: { in: binIds } },
  });

  // ゴミ箱を削除
  const deletedBins = await prisma.trashBin.deleteMany({
    where: { id: { in: binIds } },
  });

  console.log(`レポート ${deletedReports.count} 件、ゴミ箱 ${deletedBins.count} 件を削除しました`);
}

const isClear = process.argv.includes("--clear");

(isClear ? clearSeeds() : main())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
