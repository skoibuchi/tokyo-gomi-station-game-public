"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Footprints } from "lucide-react";

interface WayPoint {
  name: string;
  description: string;
  lat: number;
  lng: number;
  pointType: "start" | "goal" | "spot";
}

interface RouteItem {
  id: string;
  name: string;
  description: string;
  waypoints: WayPoint[];
  distanceKm: number;
}

export default function RoutesPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/routes")
      .then((r) => r.json())
      .then((data) => { setRoutes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleStart(route: RouteItem) {
    router.push(`/map?routeId=${route.id}`);
  }

  const getPointIcon = (type: WayPoint["pointType"]) => {
    if (type === "start") return "🟢";
    if (type === "goal") return "🏁";
    return "📍";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* タイトル */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Footprints className="text-green-500" size={28} />
          散歩ルート
        </h1>
        <p className="text-gray-500 text-sm">ルートを選んで地図で確認しよう</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 animate-bounce">🗺️</div>
          <p>読み込み中...</p>
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🚶</div>
          <p>ルートがありません</p>
          <p className="text-sm mt-1">data/routes/ にKMLファイルを追加してください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => {
            const start = route.waypoints.find((w) => w.pointType === "start");
            const goal = route.waypoints.find((w) => w.pointType === "goal");
            const spots = route.waypoints.filter((w) => w.pointType === "spot");

            return (
              <div
                key={route.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* カードヘッダー */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-gray-800 text-base leading-snug">
                      {route.name}
                    </h2>
                    <span className="shrink-0 text-xs bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded-full border border-green-200">
                      {route.distanceKm} km
                    </span>
                  </div>

                  {/* 統計 */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-blue-400" />
                      スポット {spots.length}か所
                    </span>
                    <span className="flex items-center gap-1">
                      <Navigation size={12} className="text-green-400" />
                      約 {Math.round(route.distanceKm / 4 * 60)} 分
                    </span>
                  </div>

                  {/* ウェイポイント一覧 */}
                  <div className="space-y-1">
                    {start && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>🟢</span>
                        <span className="font-medium">{start.name}</span>
                      </div>
                    )}
                    {/* 縦線 */}
                    {spots.length > 0 && (
                      <div className="ml-[9px] pl-4 border-l-2 border-dashed border-gray-200 space-y-1 py-1">
                        {spots.map((wp, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <span className="shrink-0">📍</span>
                            <div className="min-w-0">
                              <p className="font-medium leading-snug truncate">{wp.name}</p>
                              {wp.description && (
                                <p className="text-gray-400 leading-snug line-clamp-1">{wp.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {goal && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>🏁</span>
                        <span className="font-medium">{goal.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* スタートボタン */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => handleStart(route)}
                    className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Navigation size={18} />
                    地図で確認する
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
