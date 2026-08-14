"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { TrashBinData } from "@/types";
import TrashBinDetail from "@/components/TrashBinDetail";
import ReportPanel from "@/components/ReportPanel";
import { Plus, Navigation } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// Leafletはサーバーサイドでは動かないのでdynamic importする
const TrashBinMap = dynamic(() => import("@/components/map/TrashBinMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center space-y-2">
        <div className="text-4xl animate-bounce">🗑️</div>
        <p className="text-gray-500">地図を読み込み中...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const { user, refreshUser } = useUser();
  const [selectedBin, setSelectedBin] = useState<TrashBinData | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [newBinLocation, setNewBinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showNewBin, setShowNewBin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleBinSelect = useCallback((bin: TrashBinData) => {
    setSelectedBin(bin);
    setNewBinLocation(null);
    setShowReport(false);
    setShowNewBin(false);
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!user) return;
      setNewBinLocation({ lat, lng });
      setSelectedBin(null);
      setShowNewBin(true);
    },
    [user]
  );

  const handleReportSuccess = () => {
    setShowReport(false);
    setShowNewBin(false);
    setSelectedBin(null);
    setNewBinLocation(null);
    setRefreshKey((k) => k + 1);
    refreshUser(); // ユーザーポイントをDBから再取得して更新
    showToast("✅ 投稿完了！ポイントを獲得しました");
  };

  const handleBinUpdate = useCallback((updatedBin: TrashBinData) => {
    setSelectedBin(updatedBin);
  }, []);

  return (
    <div className="relative flex flex-col h-[calc(100vh-57px)]">
      {/* 地図 */}
      <div className="flex-1 relative">
        <TrashBinMap
          onBinSelect={handleBinSelect}
          onMapClick={handleMapClick}
          onLocationUpdate={(lat, lng) => setMyLocation({ lat, lng })}
          selectedBinId={selectedBin?.id}
          refreshKey={refreshKey}
        />

        {/* ユーザー未ログイン時の説明 */}
        {!user && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur rounded-xl px-4 py-2 text-sm text-gray-600 shadow">
            ログインするとゴミ箱を利用・登録できます
          </div>
        )}

        {/* 新規登録ボタン */}
        {user && (
          <div className="absolute top-4 right-4 z-[1000] space-y-2">
            <button
              onClick={() => {
                showToast("地図上の場所をタップして新規ゴミ箱を登録できます");
              }}
              className="bg-white hover:bg-gray-50 shadow-lg rounded-full p-3 flex items-center justify-center border border-gray-200"
            >
              <Plus size={20} className="text-green-600" />
            </button>
          </div>
        )}

        {/* トースト */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-800 text-white rounded-xl px-5 py-3 text-sm shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>

      {/* ゴミ箱詳細パネル */}
      {selectedBin && !showReport && (
        <TrashBinDetail
          bin={selectedBin}
          onClose={() => setSelectedBin(null)}
          onReport={() => setShowReport(true)}
          onBinUpdate={handleBinUpdate}
          myLocation={myLocation}
        />
      )}

      {/* 新規ゴミ箱の確認バー */}
      {newBinLocation && !showNewBin && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-[1000]">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Navigation size={16} className="text-green-500" />
              <span>
                {newBinLocation.lat.toFixed(5)}, {newBinLocation.lng.toFixed(5)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNewBinLocation(null)}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => setShowNewBin(true)}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg font-semibold"
              >
                ここに登録 (+100pt)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 投稿モーダル（ゴミ箱利用 / 新規発見） */}
      {(showReport || showNewBin) && (
        <ReportPanel
          selectedBin={showReport ? selectedBin : null}
          newBinLocation={showNewBin ? newBinLocation : null}
          onClose={() => {
            setShowReport(false);
            setShowNewBin(false);
          }}
          onSuccess={handleReportSuccess}
        />
      )}
    </div>
  );
}
