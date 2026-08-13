// ── キャラクター画像 ─────────────────────────────────────────
export function getTrashBinImage(level: number): string {
  if (level >= 30) return "/images/gomi_lv5.png";
  if (level >= 20) return "/images/gomi_lv4.png";
  if (level >= 10) return "/images/gomi_lv3.png";
  if (level >= 5)  return "/images/gomi_lv2.png";
  return "/images/gomi_lv1.png";
}

// ── レベル名 ─────────────────────────────────────────────────
export function getTrashBinLevelName(level: number): string {
  if (level >= 30) return "東京クリーンタワー";
  if (level >= 20) return "エコステーション";
  if (level >= 10) return "大型ゴミ箱";
  if (level >= 5)  return "中型ゴミ箱";
  return "小さなゴミ箱";
}

// ── 3種EXPから総合Lvを算出 ───────────────────────────────────
//
// 総合EXP = usageExp + knowledgeExp + supportExp
//
// Lv閾値（総合EXP）:
//   Lv.1  :     0〜
//   Lv.5  :   500〜  （利用50回 or バランス型）
//   Lv.10 : 2,000〜  （利用200回 or バランス型）
//   Lv.20 :10,000〜  （利用1,000回 or バランス型）
//   Lv.30 :30,000〜  （利用3,000回 or バランス型）
//
// 各Lv閾値は二次曲線: threshold(lv) = 50 * lv^1.8（整数化）
//
export function calcTotalExp(
  usageExp: number,
  knowledgeExp: number,
  supportExp: number
): number {
  return usageExp + knowledgeExp + supportExp;
}

export function expThreshold(level: number): number {
  // level=1 → 0, level=5 → ~500, level=10 → ~2000, level=20 → ~9800, level=30 → ~28600
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.8));
}

export function calcLevelFromExp(totalExp: number): number {
  let level = 1;
  while (expThreshold(level + 1) <= totalExp) {
    level++;
    if (level >= 50) break; // 上限
  }
  return level;
}

// 次のレベルまでの残り必要EXP
export function expForNextLevel(level: number): number {
  return expThreshold(level + 1);
}

// EXPを加算して新しいレベルを返す（reports API用）
export function calcLevelUp(
  currentUsageExp: number,
  currentKnowledgeExp: number,
  currentSupportExp: number,
  addUsage: number,
  addKnowledge: number,
  addSupport: number
): {
  newUsageExp: number;
  newKnowledgeExp: number;
  newSupportExp: number;
  newTotalExp: number;
  newLevel: number;
  leveledUp: boolean;
  prevLevel: number;
} {
  const newUsageExp     = currentUsageExp     + addUsage;
  const newKnowledgeExp = currentKnowledgeExp + addKnowledge;
  const newSupportExp   = currentSupportExp   + addSupport;
  const newTotalExp     = calcTotalExp(newUsageExp, newKnowledgeExp, newSupportExp);
  const prevLevel       = calcLevelFromExp(calcTotalExp(currentUsageExp, currentKnowledgeExp, currentSupportExp));
  const newLevel        = calcLevelFromExp(newTotalExp);
  return {
    newUsageExp, newKnowledgeExp, newSupportExp,
    newTotalExp, newLevel,
    leveledUp: newLevel > prevLevel,
    prevLevel,
  };
}

// ── ポイント定義 ─────────────────────────────────────────────
export const POINTS = {
  use:               10,
  photo_bonus:       20,  // 写真投稿ボーナス（利用時のみ）
  new_discovery:    100,
  popular_contribution: 20,
} as const;

// ── EXP加算量定義 ────────────────────────────────────────────
export const EXP_GAIN = {
  // 利用EXP
  usage_use:          10,   // ゴミ箱利用
  usage_first_visit:  50,   // 初回訪問ボーナス
  usage_consecutive:  20,   // 連続利用ボーナス（将来拡張用）

  // 知識EXP
  knowledge_photo:    20,   // 写真投稿
  knowledge_chat:     10,   // AIとの会話フィードバック

  // 応援EXP
  support_cheer:     100,   // 応援ポイント付与（将来拡張用）
  support_favorite:   20,   // お気に入り登録（将来拡張用）
} as const;

// ── ゴミ箱種別ラベル ─────────────────────────────────────────
export const BIN_TYPE_LABELS: Record<string, string> = {
  general:    "一般ゴミ",
  recycle:    "リサイクル",
  pet_bottle: "ペットボトル",
  can:        "缶",
  glass:      "ガラス",
  cigarette:  "タバコ",
  mixed:      "混合",
};

// ── 個性ラベル（3種EXPの比率から判定） ──────────────────────
export function getPersonalityLabel(
  usageExp: number,
  knowledgeExp: number,
  supportExp: number
): string {
  const total = usageExp + knowledgeExp + supportExp;
  if (total === 0) return "";
  const u = usageExp / total;
  const k = knowledgeExp / total;
  const s = supportExp / total;
  if (u >= 0.6) return "超人気ゴミ箱 🔥";
  if (k >= 0.5) return "地域のAI観光ガイド 📚";
  if (s >= 0.5) return "地域住民に愛されるシンボル ❤️";
  if (u >= 0.4 && k >= 0.3) return "賑わいの情報拠点 🗺️";
  return "バランス型ゴミ箱 ⭐";
}
