/**
 * 駅乗降客数・区別昼夜間人口データからゴミ箱の危険度スコアを計算してDBに保存するスクリプト
 *
 * 使い方:
 *   npm run risk:import
 *
 * 前提:
 *   - npm run stations:geocode を先に実行して data/stations.json を生成しておくこと
 *
 * スコア計算式:
 *   危険度スコア（0.0〜1.0）= 正規化された以下の合算
 *     + 最寄駅乗降客数（500m以内の駅の最大値）   × 重み 0.5
 *     + 区の昼夜間人口比率（夜間=100 に対して）   × 重み 0.3
 *     + ゴミ箱の利用回数（useCount）              × 重み 0.2
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { PrismaClient } from "@prisma/client";
import type { StationEntry } from "./geocode-stations";

const prisma = new PrismaClient();

const DATA_DIR       = path.join(process.cwd(), "data");
const STATIONS_JSON  = path.join(DATA_DIR, "stations.json");
const POPULATION_CSV = path.join(DATA_DIR, "tj10zv0100.csv");

// ── 定数 ────────────────────────────────────────────────────
const STATION_RADIUS_M = 500;  // 駅の影響範囲（m）
const W_STATION    = 0.5;
const W_POPULATION = 0.3;
const W_USECOUNT   = 0.2;

// ── Haversine 距離（m） ──────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 区コード → 昼夜間人口比率 ───────────────────────────────
interface DistrictInfo {
  code: string;
  name: string;
  ratio: number;  // 昼夜間人口比率（夜間=100）
}

function parsePopulationCsv(csvPath: string): DistrictInfo[] {
  const content = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: DistrictInfo[] = [];

  for (const line of lines) {
    const cols = line.split(",");
    const code = cols[0]?.trim() ?? "";
    const name = cols[1]?.trim() ?? "";
    const ratio = parseFloat(cols[8]?.trim() ?? "");

    // 区コードは 13101〜13123
    if (!/^131\d{2}$/.test(code)) continue;
    if (isNaN(ratio)) continue;

    results.push({ code, name, ratio });
  }
  return results;
}

// 区名からコードを引く（簡易マッチング）
const DISTRICT_BOUNDS: Record<string, [number, number, number, number]> = {
  "千代田区": [35.666, 139.730, 35.703, 139.772],
  "中央区":   [35.660, 139.754, 35.692, 139.793],
  "港区":     [35.627, 139.718, 35.680, 139.773],
  "新宿区":   [35.679, 139.693, 35.718, 139.736],
  "文京区":   [35.697, 139.729, 35.730, 139.766],
  "台東区":   [35.699, 139.762, 35.728, 139.797],
  "墨田区":   [35.695, 139.788, 35.730, 139.830],
  "江東区":   [35.645, 139.793, 35.706, 139.873],
  "品川区":   [35.587, 139.700, 35.640, 139.754],
  "目黒区":   [35.617, 139.672, 35.664, 139.718],
  "大田区":   [35.541, 139.668, 35.608, 139.758],
  "世田谷区": [35.597, 139.601, 35.673, 139.686],
  "渋谷区":   [35.636, 139.674, 35.679, 139.726],
  "中野区":   [35.693, 139.644, 35.726, 139.690],
  "杉並区":   [35.680, 139.593, 35.726, 139.667],
  "豊島区":   [35.714, 139.701, 35.749, 139.738],
  "北区":     [35.738, 139.706, 35.790, 139.762],
  "荒川区":   [35.727, 139.762, 35.760, 139.806],
  "板橋区":   [35.732, 139.658, 35.797, 139.727],
  "練馬区":   [35.710, 139.601, 35.782, 139.681],
  "足立区":   [35.747, 139.767, 35.820, 139.875],
  "葛飾区":   [35.718, 139.828, 35.793, 139.902],
  "江戸川区": [35.672, 139.848, 35.743, 139.930],
};

function getDistrictRatio(lat: number, lng: number, districts: DistrictInfo[]): number {
  for (const [name, [minLat, minLng, maxLat, maxLng]] of Object.entries(DISTRICT_BOUNDS)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      const d = districts.find((d) => d.name.includes(name.replace("区", "")));
      if (d) return d.ratio;
    }
  }
  return 100; // デフォルト（比率=100は昼夜同じ）
}

// ── スコア正規化 ─────────────────────────────────────────────
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

// ── メイン ──────────────────────────────────────────────────
async function main() {
  console.log("=== 危険度スコア計算開始 ===");

  // 駅データ読み込み
  if (!fs.existsSync(STATIONS_JSON)) {
    console.error(`stations.json が見つかりません。先に npm run stations:geocode を実行してください。`);
    process.exit(1);
  }
  const stations: StationEntry[] = JSON.parse(fs.readFileSync(STATIONS_JSON, "utf-8"));
  const geocodedStations = stations.filter((s) => s.lat !== null && s.lng !== null);
  console.log(`駅データ: ${geocodedStations.length} 件（座標あり）`);

  // 区別人口データ読み込み
  const districts = parsePopulationCsv(POPULATION_CSV);
  console.log(`区データ: ${districts.length} 件`);

  // ゴミ箱データ取得
  const bins = await prisma.trashBin.findMany({
    where: { status: "active" },
    select: { id: true, lat: true, lng: true, useCount: true },
  });
  console.log(`ゴミ箱: ${bins.length} 件`);

  // 各ゴミ箱のスコア計算
  const scores: { id: string; stationScore: number; popScore: number; useScore: number }[] = [];

  for (const bin of bins) {
    // 最寄駅乗降客数（半径500m以内の最大値）
    let maxBoarding = 0;
    for (const s of geocodedStations) {
      const dist = haversine(bin.lat, bin.lng, s.lat!, s.lng!);
      if (dist <= STATION_RADIUS_M && s.boardingTotal > maxBoarding) {
        maxBoarding = s.boardingTotal;
      }
    }

    // 区の昼夜間人口比率
    const ratio = getDistrictRatio(bin.lat, bin.lng, districts);

    scores.push({
      id: bin.id,
      stationScore: maxBoarding,
      popScore: ratio,
      useScore: bin.useCount,
    });
  }

  // 各スコアを正規化
  const maxStation = Math.max(...scores.map((s) => s.stationScore), 1);
  const maxPop     = Math.max(...scores.map((s) => s.popScore), 1);
  const maxUse     = Math.max(...scores.map((s) => s.useScore), 1);

  // DBに書き込み
  let updated = 0;
  for (const s of scores) {
    const stationNorm = normalize(s.stationScore, 0, maxStation);
    const popNorm     = normalize(s.popScore,     100, maxPop);   // 100以上が「昼間人口多い」
    const useNorm     = normalize(s.useScore,     0, maxUse);

    const riskScore = W_STATION * stationNorm + W_POPULATION * popNorm + W_USECOUNT * useNorm;

    await prisma.trashBin.update({
      where: { id: s.id },
      data: { riskScore: Math.round(riskScore * 1000) / 1000 }, // 小数3桁
    });
    updated++;
  }

  console.log(`\n=== 完了 ===`);
  console.log(`  更新: ${updated} 件`);

  // スコア分布を表示
  const allScores = scores.map((s) => {
    const sn = normalize(s.stationScore, 0, maxStation);
    const pn = normalize(s.popScore, 100, maxPop);
    const un = normalize(s.useScore, 0, maxUse);
    return W_STATION * sn + W_POPULATION * pn + W_USECOUNT * un;
  });
  const high   = allScores.filter((s) => s >= 0.5).length;
  const medium = allScores.filter((s) => s >= 0.2 && s < 0.5).length;
  const low    = allScores.filter((s) => s < 0.2).length;
  console.log(`  🔴 高危険度（0.5以上）: ${high} 件`);
  console.log(`  🟡 中危険度（0.2〜0.5）: ${medium} 件`);
  console.log(`  🟢 低危険度（0.2未満）: ${low} 件`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
