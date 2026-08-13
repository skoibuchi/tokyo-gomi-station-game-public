/**
 * 観光・施設 CSV を DB（Spot テーブル）に取り込むスクリプト
 *
 * 使い方:
 *   npm run spots:import
 *
 * オプション:
 *   OSM_DRY_RUN=1  DBに書き込まず件数確認だけ行う
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as iconv from "iconv-lite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.OSM_DRY_RUN === "1";

// ── CSVパーサー（ダブルクォート内カンマ対応） ─────────────────
function parseCSV(filepath: string): string[][] {
  const buf = fs.readFileSync(filepath);
  const text = iconv.decode(buf, "Shift_JIS");
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
}

function col(row: string[], idx: number): string {
  return (row[idx - 1] ?? "").trim();
}

// 説明文を一定文字数に切り詰める（長すぎるとトークン数が増えすぎるため）
function truncate(text: string, max = 200): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ── 文化財 CSV の取り込み ────────────────────────────────────
// 列: 5=名称 10=種類 12=住所 14=緯度 15=経度
//     24=開始時間 25=終了時間 26=利用特記 31=説明 33=URL
async function importCultural(): Promise<{ inserted: number; skipped: number }> {
  const filepath = path.join(process.cwd(), "data/130001_cultural_property.csv");
  const rows = parseCSV(filepath);
  let inserted = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sourceId = `cultural_${col(r,1)}_${col(r,2)}`;
    const name     = col(r, 5);
    const spotType = col(r, 10);
    const address  = col(r, 12);
    const lat      = parseFloat(col(r, 14));
    const lng      = parseFloat(col(r, 15));
    const openTime  = col(r, 24);
    const closeTime = col(r, 25);
    const hoursNote = col(r, 26);
    const description = truncate(col(r, 31));
    const url       = col(r, 33);

    if (!name || isNaN(lat) || isNaN(lng)) continue;

    if (DRY_RUN) {
      console.log(`[DRY] cultural: ${name} / ${description.slice(0,40) || "(説明なし)"}`);
      inserted++;
      continue;
    }
    const existing = await prisma.spot.findUnique({ where: { sourceId } });
    if (existing) {
      await prisma.spot.update({
        where: { sourceId },
        data: { description, openTime, closeTime, hoursNote, url },
      });
      skipped++;
    } else {
      await prisma.spot.create({
        data: {
          sourceId, name, lat, lng, address, spotType,
          category: "cultural",
          description, openTime, closeTime, hoursNote, url,
          fee: "",
        },
      });
      inserted++;
    }
  }
  return { inserted, skipped };
}

// ── 公共施設 CSV の取り込み ──────────────────────────────────
// 列: 5=名称 9=住所 11=緯度 12=経度
//     18=開始時間 19=終了時間 20=利用特記 21=説明 23=URL 30=料金基本 31=料金詳細
async function importFacility(): Promise<{ inserted: number; skipped: number }> {
  const filepath = path.join(process.cwd(), "data/130001_public_facility.csv");
  const rows = parseCSV(filepath);
  let inserted = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sourceId = `facility_${col(r,1)}_${col(r,2)}`;
    const name     = col(r, 5);
    const address  = col(r, 9);
    const lat      = parseFloat(col(r, 11));
    const lng      = parseFloat(col(r, 12));
    const openTime  = col(r, 18);
    const closeTime = col(r, 19);
    const hoursNote = col(r, 20);
    const description = truncate(col(r, 21));
    const url       = col(r, 23);
    // 料金詳細があれば優先、なければ基本料金
    const fee = col(r, 31) || col(r, 30);

    if (!name || isNaN(lat) || isNaN(lng)) continue;

    if (DRY_RUN) {
      console.log(`[DRY] facility: ${name} / ${openTime}-${closeTime} / ${fee || "料金なし"}`);
      inserted++;
      continue;
    }
    const existing = await prisma.spot.findUnique({ where: { sourceId } });
    if (existing) {
      await prisma.spot.update({
        where: { sourceId },
        data: { description, openTime, closeTime, hoursNote, url, fee },
      });
      skipped++;
    } else {
      await prisma.spot.create({
        data: {
          sourceId, name, lat, lng, address,
          spotType: "",
          category: "facility",
          description, openTime, closeTime, hoursNote, url, fee,
        },
      });
      inserted++;
    }
  }
  return { inserted, skipped };
}

// ── メイン ───────────────────────────────────────────────────
async function main() {
  console.log("=== スポットデータ インポート開始 ===");
  if (DRY_RUN) console.log("※ DRY RUNモード");

  const c = await importCultural();
  console.log(`文化財:   登録 ${c.inserted} 件 / スキップ ${c.skipped} 件`);

  const f = await importFacility();
  console.log(`公共施設: 登録 ${f.inserted} 件 / スキップ ${f.skipped} 件`);

  console.log(`=== 完了 (合計 ${c.inserted + f.inserted} 件) ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
