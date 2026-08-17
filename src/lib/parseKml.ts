/**
 * KML ファイルをパースしてルートデータを返すユーティリティ
 *
 * 対応要素:
 *   - Folder > Placemark > Point     → ウェイポイント（スタート・ゴール・観光スポット）
 *   - Folder > Placemark > LineString → ルートライン
 *
 * 複数 Folder がある場合は最初の Folder（ウォーキングコース本体）のみ使用する。
 * 都立公園一覧など「ポイント集合体」フォルダは LineString がないため自動スキップ。
 */

import fs from "fs";
import path from "path";

export interface WayPoint {
  name: string;
  description: string;
  lat: number;
  lng: number;
  pointType: "start" | "goal" | "spot"; // スタート・ゴール・途中スポット
}

export interface RouteData {
  id: string;           // ファイル名（拡張子なし）
  name: string;         // ルート名
  description: string;  // ルート説明
  waypoints: WayPoint[];
  polyline: [number, number][]; // [lat, lng] の配列
  distanceKm: number;   // 概算距離（km）
}

// ── ヘルパー ─────────────────────────────────────────────────

/** CDATA / 通常テキストから文字列を取り出す */
function extractText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
    || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

/** <coordinates> ブロックから座標配列を取り出す */
function extractCoordinates(block: string): [number, number][] {
  const m = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!m) return [];
  return m[1]
    .trim()
    .split(/\s+/)
    .map((c) => {
      const [lng, lat] = c.split(",").map(Number);
      return [lat, lng] as [number, number];
    })
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
}

/** Haversine で2点間距離（km） */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcTotalDistanceKm(polyline: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineKm(polyline[i - 1], polyline[i]);
  }
  return Math.round(total * 10) / 10;
}

/** ウェイポイント種別を名前から推定 */
function inferPointType(name: string): WayPoint["pointType"] {
  if (/スタート|Start/i.test(name)) return "start";
  if (/ゴール|Goal/i.test(name)) return "goal";
  return "spot";
}

// ── メインパーサー ────────────────────────────────────────────

export function parseKmlFile(filePath: string): RouteData | null {
  const xml = fs.readFileSync(filePath, "utf-8");
  const id = path.basename(filePath, ".kml");
  const name = extractText(xml, "name") || id;

  // Folder ブロックを全て取り出す
  const folderBlocks = [...xml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/gi)].map((m) => m[1]);

  // LineString を持つ Folder を「コース本体」とみなす
  const routeFolder = folderBlocks.find((f) => /<LineString>/i.test(f));
  if (!routeFolder) return null;

  // Placemark を全て取り出す
  const placemarkBlocks = [...routeFolder.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/gi)].map(
    (m) => m[1]
  );

  const waypoints: WayPoint[] = [];
  let polyline: [number, number][] = [];

  for (const pm of placemarkBlocks) {
    const pmName = extractText(pm, "name").replace(/\n/g, " ").trim();
    const pmDesc = extractText(pm, "description").trim();

    if (/<LineString>/i.test(pm)) {
      // ルートライン
      polyline = extractCoordinates(pm);
    } else if (/<Point>/i.test(pm)) {
      // ウェイポイント
      const coords = extractCoordinates(pm);
      if (coords.length > 0) {
        waypoints.push({
          name: pmName,
          description: pmDesc,
          lat: coords[0][0],
          lng: coords[0][1],
          pointType: inferPointType(pmName),
        });
      }
    }
  }

  return {
    id,
    name,
    description: "",
    waypoints,
    polyline,
    distanceKm: calcTotalDistanceKm(polyline),
  };
}

/** data/routes/ 以下の全KMLを読み込んで返す */
export function loadAllRoutes(): RouteData[] {
  const dir = path.join(process.cwd(), "data", "routes");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".kml"))
    .map((f) => parseKmlFile(path.join(dir, f)))
    .filter((r): r is RouteData => r !== null);
}
