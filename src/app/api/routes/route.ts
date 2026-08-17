import { NextRequest, NextResponse } from "next/server";
import { loadAllRoutes, parseKmlFile } from "@/lib/parseKml";
import path from "path";
import fs from "fs";

// ルート一覧
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    // 特定ルートの詳細（ポリラインも含む）
    const filePath = path.join(process.cwd(), "data", "routes", `${id}.kml`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "ルートが見つかりません" }, { status: 404 });
    }
    const route = parseKmlFile(filePath);
    if (!route) {
      return NextResponse.json({ error: "ルートのパースに失敗しました" }, { status: 500 });
    }
    return NextResponse.json(route);
  }

  // 一覧（ポリラインは除いて軽量化）
  const routes = loadAllRoutes().map(({ polyline: _p, ...rest }) => rest);
  return NextResponse.json(routes);
}
