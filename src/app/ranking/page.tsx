"use client";
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp } from "lucide-react";
import { RankingEntry } from "@/types";
import { useUser } from "@/contexts/UserContext";

export default function RankingPage() {
  const { user } = useUser();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ranking")
      .then((r) => r.json())
      .then((data) => {
        setRanking(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* タイトル */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Trophy className="text-yellow-500" size={28} />
          ランキング
        </h1>
        <p className="text-gray-500 text-sm">ゴミ箱ハンターTop20</p>
      </div>

      {/* 自分の順位 */}
      {user && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm text-green-700 font-semibold mb-1">あなたの成績</p>
          <div className="flex items-center justify-between">
            <span className="text-gray-800 font-bold">{user.name}</span>
            <span className="text-green-600 font-bold text-lg">{user.totalPoints} pt</span>
          </div>
          {ranking.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              順位: {
                (() => {
                  const idx = ranking.findIndex((r) => r.id === user.id);
                  return idx >= 0 ? `${idx + 1}位` : "圏外";
                })()
              }
            </p>
          )}
        </div>
      )}

      {/* ランキング一覧 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 animate-bounce">🏆</div>
          <p>読み込み中...</p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗑️</div>
          <p>まだランキングがありません</p>
          <p className="text-sm mt-1">ゴミ箱を利用してポイントを獲得しよう！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border ${
                entry.id === user?.id
                  ? "border-green-300 bg-green-50"
                  : "border-gray-100"
              }`}
            >
              {/* 順位 */}
              <div className="w-10 text-center">
                <span className={`text-xl ${index < 3 ? "" : "text-gray-500 font-bold text-sm"}`}>
                  {getMedal(index)}
                </span>
              </div>

              {/* 名前 */}
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  {entry.name}
                  {entry.id === user?.id && (
                    <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={10} />
                    {entry.reportCount}回投稿
                  </span>
                </div>
              </div>

              {/* ポイント */}
              <div className="text-right">
                <p className="font-bold text-yellow-600 text-lg">{entry.totalPoints}</p>
                <p className="text-xs text-gray-400">pt</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ポイント説明 */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          ポイント獲得方法
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">🗑️ ゴミ箱を利用する</span>
            <span className="font-bold text-green-600">+10 pt</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">🆕 新しいゴミ箱を発見する</span>
            <span className="font-bold text-green-600">+100 pt</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">⭐ 人気ゴミ箱への貢献</span>
            <span className="font-bold text-green-600">+20 pt</span>
          </div>
        </div>
      </div>
    </div>
  );
}
