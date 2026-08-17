"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrashBinData } from "@/types";
import { getTrashBinLevelName, getTrashBinImage } from "@/lib/gameLogic";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WayPoint {
  name: string;
  description: string;
  lat: number;
  lng: number;
  pointType: "start" | "goal" | "spot";
}

interface RouteData {
  id: string;
  name: string;
  waypoints: WayPoint[];
  polyline: [number, number][];
  distanceKm: number;
}

interface TrashBinMapProps {
  onBinSelect: (bin: TrashBinData) => void;
  onMapClick: (lat: number, lng: number) => void;
  onLocationUpdate?: (lat: number, lng: number) => void;
  selectedBinId?: string | null;
  refreshKey?: number;
}

export default function TrashBinMap({
  onBinSelect,
  onMapClick,
  onLocationUpdate,
  selectedBinId,
  refreshKey,
}: TrashBinMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const routeId = searchParams.get("routeId");

  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const myLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [bins, setBins] = useState<TrashBinData[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [mapReady, setMapReady] = useState(false); // Leaflet初期化完了フラグ

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    // Leafletを動的に読み込む
    import("leaflet").then((L) => {
      // アイコン修正（Next.jsでのバグ対策）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (leafletMap.current) return;

      const map = L.map(mapRef.current!, {
        center: [35.6812, 139.7500],
        zoom: 16,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // 地図クリックで新規登録
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });

      // 現在地取得
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            myLocationRef.current = { lat, lng };
            onLocationUpdate?.(lat, lng);
            map.setView([lat, lng], 16);
            L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: "#3b82f6",
              color: "#fff",
              weight: 2,
              fillOpacity: 1,
            }).addTo(map).bindPopup("現在地");
          },
          () => {}
        );
      }

      leafletMap.current = map;

      // 初期ゴミ箱読み込み
      loadBins(L, map);

      map.on("moveend", () => loadBins(L, map));

      // Leaflet初期化完了を通知（routeIdのuseEffectが待っている）
      setMapReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refreshKeyが変わったら再読み込み
  useEffect(() => {
    if (!leafletMap.current) return;
    import("leaflet").then((L) => {
      if (leafletMap.current) loadBins(L, leafletMap.current);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // routeId または mapReady が変わったらルートを描画
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    if (!routeId) {
      // ルートなし → レイヤーをクリア
      routeLayerRef.current?.clearLayers();
      setActiveRoute(null);
      return;
    }
    import("leaflet").then((L) => {
      if (!leafletMap.current) return;
      fetch(`/api/routes?id=${routeId}`)
        .then((r) => r.json())
        .then((route: RouteData) => {
          setActiveRoute(route);

          // 既存ルートレイヤーをクリア
          if (routeLayerRef.current) {
            routeLayerRef.current.clearLayers();
          } else {
            routeLayerRef.current = L.layerGroup().addTo(leafletMap.current!);
          }

          const lg = routeLayerRef.current!;

          // ポリライン描画
          if (route.polyline.length > 0) {
            L.polyline(route.polyline, {
              color: "#3b82f6",
              weight: 4,
              opacity: 0.85,
            }).addTo(lg);

            // ルート全体が見えるようにフィット
            leafletMap.current!.fitBounds(L.polyline(route.polyline).getBounds(), {
              padding: [40, 40],
            });
          }

          // ウェイポイントマーカー描画
          route.waypoints.forEach((wp) => {
            const emoji =
              wp.pointType === "start" ? "🟢" :
              wp.pointType === "goal"  ? "🏁" : "📍";
            const icon = L.divIcon({
              html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">${emoji}</div>`,
              className: "",
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            const popupContent = wp.description
              ? `<b>${wp.name}</b><br/><span style="font-size:12px">${wp.description}</span>`
              : `<b>${wp.name}</b>`;
            L.marker([wp.lat, wp.lng], { icon }).addTo(lg).bindPopup(popupContent);
          });
        })
        .catch((e) => console.error("ルート読み込みエラー", e));
    });
  }, [routeId, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBins(
    L: typeof import("leaflet"),
    map: import("leaflet").Map
  ) {
    const bounds = map.getBounds();
    const params = new URLSearchParams({
      minLat: bounds.getSouth().toString(),
      maxLat: bounds.getNorth().toString(),
      minLng: bounds.getWest().toString(),
      maxLng: bounds.getEast().toString(),
    });

    try {
      const res = await fetch(`/api/trashbins?${params}`);
      const data: TrashBinData[] = await res.json();
      setBins(data);

      // 既存マーカーを削除
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      data.forEach((bin) => {
        const levelName = getTrashBinLevelName(bin.level);
        const imgSrc = getTrashBinImage(bin.level);
        const bgColor = getRiskBgColor(bin.riskScore);
        const icon = L.divIcon({
          html: `<div style="
            background: ${bgColor};
            border: 2px solid ${getLevelColor(bin.level)};
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            overflow: hidden;
          "><img src="${imgSrc}" style="width:28px;height:28px;object-fit:contain;" /></div>`,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });

        const riskLabel = bin.riskScore >= 0.5 ? "🔴 高危険度"
          : bin.riskScore >= 0.2 ? "🟡 要注意"
          : bin.riskScore > 0    ? "🟢 安全"
          : "";

        const marker = L.marker([bin.lat, bin.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:160px">
              <b>${bin.name || "ゴミ箱"}</b><br/>
              <span>Lv.${bin.level} ${levelName}</span><br/>
              <span>利用回数: ${bin.useCount}</span>${riskLabel ? `<br/><span style="font-weight:bold">${riskLabel}</span>` : ""}
            </div>`
          )
          .on("click", () => onBinSelect(bin));

        markersRef.current.set(bin.id, marker);
      });
    } catch (e) {
      console.error("ゴミ箱データ取得エラー", e);
    }
  }

  function getLevelColor(level: number): string {
    if (level >= 50) return "#f59e0b";
    if (level >= 30) return "#8b5cf6";
    if (level >= 10) return "#10b981";
    if (level >= 5) return "#3b82f6";
    return "#6b7280";
  }

  function getRiskBgColor(riskScore: number): string {
    if (riskScore >= 0.5) return "#fecaca"; // 赤：高危険度
    if (riskScore >= 0.2) return "#fef08a"; // 黄：要注意
    return "white";                          // 白：安全 or スコアなし
  }

  function handleLocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        myLocationRef.current = { lat, lng };
        onLocationUpdate?.(lat, lng);
        leafletMap.current?.setView([lat, lng], 16);
      },
      () => alert("現在地を取得できませんでした。\nHTTPSで接続しているか確認してください。")
    );
  }

  return (
    <div className="relative w-full h-full">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* アクティブルートバナー */}
      {activeRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-blue-500 text-white rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg flex items-center gap-2 max-w-[80vw]">
          <span>🚶</span>
          <span className="truncate">{activeRoute.name}</span>
          <span className="shrink-0 opacity-80">{activeRoute.distanceKm}km</span>
        </div>
      )}

      {/* 現在地ボタン */}
      <button
        onClick={handleLocate}
        className="absolute bottom-14 right-4 bg-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center z-[1000] border border-gray-200 hover:bg-gray-50 active:bg-gray-100 text-xl"
        title="現在地へ移動"
      >
        📍
      </button>

      {/* 凡例 */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg text-xs text-gray-600 z-[1000]">
        {/* ヘッダー（常時表示・タップで開閉） */}
        <button
          onClick={() => setLegendOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 font-semibold text-gray-600"
        >
          {legendOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          <span>凡例</span>
          <span className="ml-auto text-gray-400 font-normal">ゴミ箱: {bins.length}件</span>
        </button>

        {/* 折りたたみ内容 */}
        {legendOpen && (
          <div className="px-2.5 pb-2 space-y-1.5 border-t border-gray-200">
            {/* 危険度（背景色） */}
            <div className="space-y-0.5 pt-1.5">
              <p className="font-semibold text-gray-500 leading-none">溢れリスク（背景）</p>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: "#fecaca" }} />
                <span>高危険度</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: "#fef08a" }} />
                <span>要注意</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: "white" }} />
                <span>安全</span>
              </div>
            </div>
            {/* 区切り線 */}
            <div className="border-t border-gray-200" />
            {/* レベル（ボーダー色） */}
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-500 leading-none">レベル（枠色）</p>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ border: "2px solid #f59e0b" }} />
                <span>Lv.50+</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ border: "2px solid #8b5cf6" }} />
                <span>Lv.30+</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ border: "2px solid #10b981" }} />
                <span>Lv.10+</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ border: "2px solid #3b82f6" }} />
                <span>Lv.5+</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ border: "2px solid #6b7280" }} />
                <span>Lv.1〜4</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
