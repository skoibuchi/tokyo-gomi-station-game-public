import { AiJudgmentResult } from "@/types";
import type { NearbySpot } from "./nearbySpots";

const WATSONX_API_KEY = process.env.WATSONX_API_KEY || "";
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || "";
const WATSONX_URL =
  process.env.WATSONX_URL || "https://jp-tok.ml.cloud.ibm.com";

// IBM Cloud IAMトークンを取得
async function getIAMToken(): Promise<string> {
  const response = await fetch(
    "https://iam.cloud.ibm.com/identity/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
    }
  );
  const data = await response.json();
  return data.access_token;
}

// 画像をBase64に変換（URL or Base64文字列を受け取る）
function ensureBase64(imageData: string): string {
  // すでにBase64なら返す
  if (imageData.startsWith("data:image")) {
    return imageData.split(",")[1];
  }
  return imageData;
}

// watsonx.aiのVisionモデルでゴミ箱を判定する
export async function judgeTrashBinImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<AiJudgmentResult> {
  // API Keyが未設定の場合はモック結果を返す（開発用）
  if (!WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
    console.warn("watsonx.ai API Key未設定。モック結果を返します。");
    return getMockResult();
  }

  try {
    const token = await getIAMToken();
    const base64Data = ensureBase64(imageBase64);

    const prompt = `You are an AI system that analyzes images of trash bins/waste bins.

Please analyze this image and respond ONLY with a JSON object in this exact format:
{
  "hasTrashBin": true or false,
  "binType": "general" or "recycle" or "pet_bottle" or "can" or "glass" or "cigarette" or "mixed",
  "confidence": 0.0 to 1.0,
  "isValid": true or false,
  "reason": "brief explanation in Japanese",
  "dirtLevel": 0 to 4,
  "dirtReason": "brief explanation of cleanliness in Japanese"
}

Rules:
- hasTrashBin: true if a public trash bin is clearly visible
- binType: the type of trash bin (use "general" if unclear)
- confidence: your confidence level (0.0-1.0)
- isValid: true if this appears to be a legitimate report of a real trash bin
- reason: short Japanese explanation
- dirtLevel: cleanliness level of the trash bin and surrounding area
    0 = clean, no litter visible
    1 = slightly dirty, minor litter
    2 = dirty, some litter around the bin
    3 = very dirty, significant overflow or litter
    4 = severely overflowing, litter scattered widely
- dirtReason: short Japanese explanation of the cleanliness condition`;

    const response = await fetch(
      `${WATSONX_URL}/ml/v1/text/chat?version=2023-05-29`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
          project_id: WATSONX_PROJECT_ID,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
          parameters: {
            max_new_tokens: 300,
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("watsonx.ai API error:", await response.text());
      return getMockResult();
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // JSONを抽出してパース
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const judgment: AiJudgmentResult = {
        hasTrashBin: Boolean(result.hasTrashBin),
        binType: result.binType || "general",
        confidence: Number(result.confidence) || 0.5,
        isValid: Boolean(result.isValid),
        reason: result.reason || "判定完了",
        dirtLevel: Number(result.dirtLevel ?? 0),
        dirtReason: result.dirtReason || "状態不明",
      };
      console.log(
        `[AI判定] hasTrashBin=${judgment.hasTrashBin} binType=${judgment.binType}` +
        ` confidence=${(judgment.confidence * 100).toFixed(0)}% isValid=${judgment.isValid}` +
        ` reason="${judgment.reason}"` +
        ` | dirtLevel=${judgment.dirtLevel}/4 dirtReason="${judgment.dirtReason}"`
      );
      return judgment;
    }
  } catch (error) {
    console.error("AI判定エラー:", error);
  }

  return getMockResult();
}

function getMockResult(): AiJudgmentResult {
  return {
    hasTrashBin: true,
    binType: "general",
    confidence: 0.85,
    isValid: true,
    reason: "ゴミ箱が確認されました（デモモード）",
    dirtLevel: 0,
    dirtReason: "清潔な状態です（デモモード）",
  };
}

// ゴミ箱が周辺情報をしゃべる（テキスト生成）
export async function generateNearbyComment(
  binName: string,
  binLevel: number,
  spots: NearbySpot[]
): Promise<string> {
  // スポットなし → 固定メッセージ
  if (spots.length === 0) {
    return getMockComment(binName, binLevel, spots);
  }

  // API Key未設定 → モック
  if (!WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
    return getMockComment(binName, binLevel, spots);
  }

  try {
    const token = await getIAMToken();
    const spotList = spots
      .map((s, i) => `${i + 1}. ${s.name}（約${Math.round(s.distanceM)}m・${s.category === "cultural" ? "文化財" : "公共施設"}）`)
      .join("\n");

    const prompt = `あなたは東京の街角に置かれたゴミ箱のキャラクター「${binName}」です。レベル${binLevel}のゴミ箱です。
近くにある観光スポットや施設を、ゴミ箱らしく親しみやすく2〜3文で紹介してください。
ゴミ箱目線で「ここから歩いてすぐだよ」「僕のそばにあるよ」などの表現を使ってください。
絵文字を1〜2個使ってOKです。

近くのスポット:
${spotList}

紹介文（日本語で、ゴミ箱キャラとして話してください）:`;

    const response = await fetch(
      `${WATSONX_URL}/ml/v1/text/chat?version=2023-05-29`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
          project_id: WATSONX_PROJECT_ID,
          messages: [{ role: "user", content: prompt }],
          parameters: { max_new_tokens: 200, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      console.error("watsonx.ai text error:", await response.text());
      return getMockComment(binName, binLevel, spots);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content || "";
    return content.trim() || getMockComment(binName, binLevel, spots);
  } catch (e) {
    console.error("周辺情報生成エラー:", e);
    return getMockComment(binName, binLevel, spots);
  }
}

function getMockComment(binName: string, binLevel: number, spots: NearbySpot[]): string {
  // レベル帯によるキャラクター口調
  const personality =
    binLevel >= 30 ? { prefix: "わし", tone: "古参のゴミ箱として威厳を持って" } :
    binLevel >= 10 ? { prefix: "オレ",  tone: "頼れる中堅ゴミ箱として" } :
    binLevel >= 5  ? { prefix: "ぼく",  tone: "元気な新人ゴミ箱として" } :
                     { prefix: "ぼく",  tone: "緊張気味な新米ゴミ箱として" };

  if (spots.length === 0) {
    const noSpotLines = [
      `やあ！${personality.prefix}は${binName}（Lv.${binLevel}）だよ。まだ近くにスポット情報がないけど、ゴミは${personality.prefix}に任せて！`,
      `こんにちは！${binName}（Lv.${binLevel}）です。このあたりのスポット情報はまだ集め中…でもゴミならいつでも受け取るよ🗑️`,
      `ども、${binName}（Lv.${binLevel}）！近くの観光情報はまだないけど、ゴミ捨てはお任せあれ！`,
    ];
    // ゴミ箱名の文字数でバリエーションを選ぶ（ランダムの代わり）
    return noSpotLines[binName.length % noSpotLines.length];
  }

  const top = spots[0];
  const dist = Math.round(top.distanceM);
  const category = top.category === "cultural" ? "文化財" : "公共施設";

  // スポット数・種別・距離・レベルの組み合わせでバリエーション
  const lines = [
    `${personality.prefix}は${binName}（Lv.${binLevel}）！ここから約${dist}mに「${top.name}」っていう${category}があるよ🗺️ 帰りにゴミ捨てていってね！`,
    `やあ、${binName}（Lv.${binLevel}）だよ。すぐそこ${dist}mの「${top.name}」、知ってる？${category}なんだ。見学したらぜひここでゴミ捨ててね✨`,
    `${binName}（Lv.${binLevel}）です！近くに「${top.name}」（${dist}m先・${category}）があるよ。${spots.length > 1 ? `他にも${spots.length - 1}件スポットがあるよ！` : "ぜひ行ってみて！"}🗑️`,
  ];
  // 名前の長さ + レベル + 距離でバリエーションを決定（毎回同じゴミ箱は同じ文体）
  return lines[(binName.length + binLevel + Math.floor(dist / 100)) % lines.length];
}
