"use client";
import { useEffect, useRef, useState } from "react";
import { TrashBinData } from "@/types";
import { getTrashBinLevelName, getTrashBinImage } from "@/lib/gameLogic";

interface TrashBinMapProps {
  onBinSelect: (bin: TrashBinData) => void;
  onMapClick: (lat: number, lng: number) => void;
  selectedBinId?: string | null;
  refreshKey?: number;
}

export default function TrashBinMap({
  onBinSelect,
  onMapClick,
  selectedBinId,
  refreshKey,
}: TrashBinMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [bins, setBins] = useState<TrashBinData[]>([]);

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

      // 全シードデータが視野に入る zoom12 で初期化
      const map = L.map(mapRef.current!, {
        center: [35.6812, 139.7500],
        zoom: 12,
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
            map.setView([pos.coords.latitude, pos.coords.longitude], 16);
            L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
              radius: 8,
              fillColor: "#3b82f6",
              color: "#fff",
              weight: 2,
              fillOpacity: 1,
            })
              .addTo(map)
              .bindPopup("現在地");
          },
          () => {}
        );
      }

      leafletMap.current = map;

      // 初期ゴミ箱読み込み
      loadBins(L, map);

      map.on("moveend", () => loadBins(L, map));
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
        const icon = L.divIcon({
          html: `<div style="
            background: white;
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

        const marker = L.marker([bin.lat, bin.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:160px">
              <b>${bin.name || "ゴミ箱"}</b><br/>
              <span>Lv.${bin.level} ${levelName}</span><br/>
              <span>利用回数: ${bin.useCount}</span>
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

  return (
    <div className="relative w-full h-full">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg p-2 text-xs text-gray-600 z-[1000]">
        ゴミ箱: {bins.length}件表示中
      </div>
    </div>
  );
}
