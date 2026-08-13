import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findNearbySpots } from "@/lib/nearbySpots";
import { generateNearbyComment } from "@/lib/watsonx";

// bin.name が null のとき住所からエリア名を推定（nearby-info/route.ts と共通ロジック）
function resolveDisplayName(
  binName: string | null,
  spots: { name: string; address: string }[]
): string {
  if (binName) return binName;
  for (const s of spots) {
    const m = s.address.match(/区(.+?\d丁目)/);
    if (m) return `${m[1]}のゴミ箱`;
    const m2 = s.address.match(/区(.+?)(\d|$)/);
    if (m2) return `${m2[1].trim()}のゴミ箱`;
  }
  return "どこかのゴミ箱";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { messages }: { messages: ChatMessage[] } = await request.json();

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages は配列で指定してください" }, { status: 400 });
  }

  const bin = await prisma.trashBin.findUnique({
    where: { id },
    select: { id: true, name: true, lat: true, lng: true, level: true },
  });

  if (!bin) {
    return NextResponse.json({ error: "ゴミ箱が見つかりません" }, { status: 404 });
  }

  const spots = await findNearbySpots(bin.lat, bin.lng, 500, 3);
  const displayName = resolveDisplayName(bin.name, spots);

  // スポットごとに利用可能な情報をすべて文字列化
  function formatSpot(s: (typeof spots)[0]): string {
    const lines: string[] = [];
    lines.push(`【${s.name}】（約${Math.round(s.distanceM)}m・${s.category === "cultural" ? "文化財" : "公共施設"}）`);
    if (s.spotType) lines.push(`  種別: ${s.spotType}`);
    if (s.description) lines.push(`  説明: ${s.description}`);
    if (s.openTime && s.closeTime && !(s.openTime === "00:00" && s.closeTime === "00:00")) {
      lines.push(`  開館時間: ${s.openTime}〜${s.closeTime}${s.hoursNote ? "（" + s.hoursNote.slice(0, 60) + "）" : ""}`);
    }
    if (s.fee) lines.push(`  料金: ${s.fee}`);
    if (s.url) lines.push(`  URL: ${s.url}`);
    return lines.join("\n");
  }

  const spotSummary = spots.length > 0
    ? spots.map(formatSpot).join("\n\n")
    : "近くに登録済みスポットなし";

  const WATSONX_API_KEY = process.env.WATSONX_API_KEY || "";
  const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || "";
  const WATSONX_URL = process.env.WATSONX_URL || "https://jp-tok.ml.cloud.ibm.com";

  // API Key未設定 → モック応答
  if (!WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
    const reply = await generateNearbyComment(displayName, bin.level, spots);
    return NextResponse.json({ reply });
  }

  try {
    // IAMトークン取得
    const tokenRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
    });
    const { access_token } = await tokenRes.json();

    // システムプロンプト（ゴミ箱キャラの設定）
    const systemPrompt = `あなたは東京の街角に置かれたゴミ箱のキャラクター「${displayName}」です。
レベル${bin.level}のゴミ箱で、${bin.level >= 30 ? "古参として威厳のある" : bin.level >= 10 ? "頼れる中堅の" : "元気な新人の"}口調で話します。
自分の近くにある観光スポットや施設に詳しく、ゴミ拾いや環境についても話せます。
絵文字を適度に使い、親しみやすく2〜4文で返答してください。
ユーザーの質問に「ゴミ箱目線」で答えてください。

【近くのスポット情報】
${spotSummary}`;

    const response = await fetch(
      `${WATSONX_URL}/ml/v1/text/chat?version=2023-05-29`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
          project_id: WATSONX_PROJECT_ID,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          parameters: { max_new_tokens: 300, temperature: 0.8 },
        }),
      }
    );

    if (!response.ok) {
      console.error("watsonx chat error:", await response.text());
      const fallback = await generateNearbyComment(displayName, bin.level, spots);
      return NextResponse.json({ reply: fallback });
    }

    const data = await response.json();
    const reply: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("chat error:", e);
    const fallback = await generateNearbyComment(displayName, bin.level, spots);
    return NextResponse.json({ reply: fallback });
  }
}
