/**
 * 駅名 → 緯度経度を Nominatim（OSM）で取得して data/stations.json に保存するスクリプト
 *
 * 対応CSV:
 *   - data/tn23qv040800.csv  : JR（列構造: 年度,年,系統,系統En,駅,駅En,マーク,乗車総数...）
 *   - data/tn23qv041300.csv  : 私鉄（列構造: 年度,年,会社,会社En,系統,系統En,駅,駅En,マーク,乗車総数...）
 *   - data/tn23qv041500.csv  : 地下鉄（列構造: 同上）
 *
 * 使い方:
 *   npm run stations:geocode
 *
 * 注意:
 *   - Nominatim の利用規約により 1秒に1リクエスト制限あり
 *   - 既存の stations.json がある場合は未取得の駅だけ追加（差分更新）
 *   - 取得失敗した駅は null 座標で記録（手動修正可）
 */

import dotenv from "dotenv";
import path from "path";
import https from "https";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

// ── 設定 ────────────────────────────────────────────────────
const DATA_DIR    = path.join(process.cwd(), "data");
const OUTPUT_JSON = path.join(DATA_DIR, "stations.json");
const DELAY_MS    = 1100; // Nominatim レート制限対策（1秒1リクエスト）

// ── CSV定義 ─────────────────────────────────────────────────
const CSV_SOURCES = [
  {
    file: "tn23qv040800.csv",
    type: "jr" as const,
    label: "JR",
  },
  {
    file: "tn23qv041300.csv",
    type: "private" as const,
    label: "私鉄",
  },
  {
    file: "tn23qv041500.csv",
    type: "subway" as const,
    label: "地下鉄",
  },
];

// ── 型定義 ──────────────────────────────────────────────────
export interface StationEntry {
  name: string;          // 駅名（日本語）
  nameEn: string;        // 駅名（英語）
  line: string;          // 路線名
  company: string;       // 会社名
  railType: string;      // jr / private / subway
  boardingTotal: number; // 乗車人員（総数）
  lat: number | null;
  lng: number | null;
  geocoded: boolean;     // 取得済みフラグ
}

// ── CSVパース ────────────────────────────────────────────────
/**
 * JR用: 列インデックス（0始まり）
 *   0=年度 1=年 2=系統 3=系統En 4=駅 5=駅En 6=マーク 7=乗車総数
 *
 * 私鉄/地下鉄用: 列インデックス（0始まり）
 *   0=年度 1=年 2=会社 3=会社En 4=系統 5=系統En 6=駅 7=駅En 8=マーク 9=乗車総数
 */
function parseStationCsv(
  csvPath: string,
  railType: "jr" | "private" | "subway"
): Omit<StationEntry, "lat" | "lng" | "geocoded">[] {
  const content = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, ""); // BOM除去
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  const results: Omit<StationEntry, "lat" | "lng" | "geocoded">[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const cols = line.split(",");

    // 令和5（2023年）のデータのみ使用
    if (cols[0]?.trim() !== "令和5" && cols[1]?.trim() !== "2023") continue;

    let company: string;
    let lineName: string;
    let stationJa: string;
    let stationEn: string;
    let boardingStr: string;

    if (railType === "jr") {
      // JR: 列オフセットが2つ少ない（会社列がない）
      company    = "JR東日本";
      lineName   = cols[2]?.trim() ?? "";
      stationJa  = cols[4]?.trim() ?? "";
      stationEn  = cols[5]?.trim() ?? "";
      boardingStr = cols[7]?.trim() ?? "";
    } else {
      // 私鉄・地下鉄: 会社名あり
      company    = cols[2]?.trim() ?? "";
      lineName   = cols[4]?.trim() ?? "";
      stationJa  = cols[6]?.trim() ?? "";
      stationEn  = cols[7]?.trim() ?? "";
      boardingStr = cols[9]?.trim() ?? "";
    }

    // 駅名がない行（集計行など）はスキップ
    if (!stationJa) continue;

    // 総数・区部・路線合計行をスキップ
    if (
      company === "総数" || company === "Total" ||
      company === "区部" || company === "うち区部" ||
      lineName === "Total" || lineName === "" ||
      stationJa === ""
    ) continue;

    // 乗客数パース
    const boarding = parseInt(boardingStr.replace(/,/g, ""), 10);
    if (isNaN(boarding)) continue;

    // 同一駅は重複スキップ
    const key = `${stationJa}__${company}__${lineName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name: stationJa,
      nameEn: stationEn,
      line: lineName,
      company,
      railType,
      boardingTotal: boarding,
    });
  }

  // 乗客数降順でソート
  return results.sort((a, b) => b.boardingTotal - a.boardingTotal);
}

// ── Nominatim ジオコーディング ───────────────────────────────
function geocodeStation(stationName: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${stationName}駅 東京`);
    const options = {
      hostname: "nominatim.openstreetmap.org",
      path: `/search?q=${query}&format=json&limit=1&countrycodes=jp`,
      method: "GET",
      headers: {
        "User-Agent": "gomi-map-station-geocoder/1.0",
        "Accept-Language": "ja",
      },
      family: 4, // IPv4 強制（RHEL9 環境対応）
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.length > 0) {
            resolve({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.setTimeout(10_000);
    req.end();
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── メイン ──────────────────────────────────────────────────
async function main() {
  console.log("=== 駅ジオコーディング開始 ===");

  // 全CSVから駅リストを読み込む
  const allStations: Omit<StationEntry, "lat" | "lng" | "geocoded">[] = [];
  for (const src of CSV_SOURCES) {
    const csvPath = path.join(DATA_DIR, src.file);
    if (!fs.existsSync(csvPath)) {
      console.warn(`⚠ ${src.file} が見つかりません。スキップします。`);
      continue;
    }
    const stations = parseStationCsv(csvPath, src.type);
    console.log(`${src.label}: ${stations.length} 駅`);
    allStations.push(...stations);
  }

  // キーで重複排除（複数路線で同名の場合は乗客数が多い方を優先）
  const dedupMap = new Map<string, Omit<StationEntry, "lat" | "lng" | "geocoded">>();
  for (const s of allStations) {
    const key = `${s.name}__${s.company}__${s.line}`;
    const existing = dedupMap.get(key);
    if (!existing || s.boardingTotal > existing.boardingTotal) {
      dedupMap.set(key, s);
    }
  }
  const stations = Array.from(dedupMap.values()).sort((a, b) => b.boardingTotal - a.boardingTotal);
  console.log(`\n対象駅数（重複除去後）: ${stations.length} 件`);

  // 既存データを読み込む（差分更新）
  let existing: Record<string, StationEntry> = {};
  if (fs.existsSync(OUTPUT_JSON)) {
    const raw = JSON.parse(fs.readFileSync(OUTPUT_JSON, "utf-8")) as StationEntry[];
    existing = Object.fromEntries(raw.map((s) => [`${s.name}__${s.company}__${s.line}`, s]));
    console.log(`既存データ: ${raw.length} 件（差分更新モード）`);
  }

  const results: StationEntry[] = [];
  let geocodedCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const key = `${s.name}__${s.company}__${s.line}`;

    // 既に取得済みならスキップ
    if (existing[key]?.geocoded) {
      results.push(existing[key]);
      skipCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${stations.length}] ${s.name}（${s.company} / ${s.line}）... `);

    await sleep(DELAY_MS);
    const coords = await geocodeStation(s.name);

    if (coords) {
      console.log(`✓ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      results.push({ ...s, lat: coords.lat, lng: coords.lng, geocoded: true });
      geocodedCount++;
    } else {
      console.log("✗ 取得失敗");
      results.push({ ...s, lat: null, lng: null, geocoded: false });
      failCount++;
    }

    // 途中経過を毎回保存（中断対策）
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), "utf-8");
  }

  console.log("\n=== 完了 ===");
  console.log(`  取得成功: ${geocodedCount} 件`);
  console.log(`  スキップ: ${skipCount} 件`);
  console.log(`  取得失敗: ${failCount} 件`);
  console.log(`  保存先: ${OUTPUT_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
