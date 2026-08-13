/**
 * OSM（OpenStreetMap）からゴミ箱データを取得してDBに登録するスクリプト
 *
 * 使い方:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-osm.ts
 *
 * オプション（環境変数）:
 *   OSM_BBOX   取得する矩形範囲 "minLat,minLng,maxLat,maxLng"
 *              デフォルト: 東京都全域 "35.5,138.9,35.9,139.9"
 *   OSM_DRY_RUN=1  DBに書き込まずログ出力だけ行う
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── 設定 ────────────────────────────────────────────────
// 負荷分散のためミラーサーバーを優先して使う
const OVERPASS_URL =
  process.env.OSM_OVERPASS_URL ?? "https://lz4.overpass-api.de/api/interpreter";

// 東京都の概略バウンディングボックス（デフォルト）
// 広範囲は Overpass に負荷がかかるため、デフォルトは23区中心部に絞る
const DEFAULT_BBOX = "35.60,139.60,35.75,139.80";
const BBOX = process.env.OSM_BBOX ?? DEFAULT_BBOX;
const DRY_RUN = process.env.OSM_DRY_RUN === "1";

// OSM の waste_basket タグ → binType マッピング
const WASTE_TYPE_MAP: Record<string, string> = {
  recycling:    "recycle",
  pet_bottle:   "pet_bottle",
  cans:         "can",
  glass:        "glass",
  cigarettes:   "cigarette",
  dogfeces:     "general",
  general:      "general",
  trash:        "general",
};

// ── OSMノード型 ──────────────────────────────────────────
interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OsmNode[];
}

// ── メイン ───────────────────────────────────────────────
async function fetchOsmBins(bbox: string): Promise<OsmNode[]> {
  // amenity=waste_basket をバウンディングボックスで取得
  // recycling タグのゴミ箱も対象に含める
  const query = `
[out:json][timeout:60];
(
  node["amenity"="waste_basket"](${bbox});
  node["amenity"="recycling"]["recycling_type"="container"](${bbox});
);
out body;
`.trim();

  console.log(`Overpass API にリクエスト中... (bbox: ${bbox})`);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": "gomi-map-osm-importer/1.0",
    },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`Overpass API エラー: ${res.status} ${await res.text()}`);
  }

  const json: OverpassResponse = await res.json();
  return json.elements;
}

function resolveBinType(tags: Record<string, string> = {}): string {
  // amenity=recycling の場合
  if (tags.amenity === "recycling") return "recycle";

  // waste タグで種別判定
  const waste = tags.waste ?? tags["recycling:type"] ?? "";
  return WASTE_TYPE_MAP[waste] ?? "general";
}

function resolveName(tags: Record<string, string> = {}, id: number): string | null {
  // name タグがあればそれを使う
  if (tags.name) return tags.name;
  // operator（設置主体）があれば補助的に使う
  if (tags.operator) return `${tags.operator}のゴミ箱`;
  return null;
}

async function importBins(nodes: OsmNode[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const node of nodes) {
    const osmId = `osm_${node.id}`;

    // 既存チェック（osmId で一意）
    const existing = await prisma.trashBin.findUnique({ where: { osmId } });
    if (existing) {
      skipped++;
      continue;
    }

    const binType = resolveBinType(node.tags);
    const name = resolveName(node.tags ?? {}, node.id);

    if (DRY_RUN) {
      console.log(`[DRY RUN] 登録予定: osmId=${osmId} lat=${node.lat} lng=${node.lon} type=${binType} name=${name ?? "(なし)"}`);
      inserted++;
      continue;
    }

    await prisma.trashBin.create({
      data: {
        osmId,
        lat: node.lat,
        lng: node.lon,
        name,
        binType,
        status: "active",
        source: "osm",
      },
    });
    inserted++;
  }

  return { inserted, skipped };
}

async function main() {
  console.log("=== OSM ゴミ箱インポート開始 ===");
  if (DRY_RUN) console.log("※ DRY RUNモード：DBへの書き込みは行いません");

  const nodes = await fetchOsmBins(BBOX);
  console.log(`取得件数: ${nodes.length} 件`);

  if (nodes.length === 0) {
    console.log("取得データなし。終了します。");
    return;
  }

  const { inserted, skipped } = await importBins(nodes);

  console.log("=== 完了 ===");
  console.log(`  登録: ${inserted} 件`);
  console.log(`  スキップ（既存）: ${skipped} 件`);
}

main()
  .catch((e) => {
    console.error("エラー:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
