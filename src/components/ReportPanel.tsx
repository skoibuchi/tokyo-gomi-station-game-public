"use client";
import { useState, useRef } from "react";
import { X, Camera, MapPin, Loader2, CheckCircle, AlertCircle, ImagePlus } from "lucide-react";
import { TrashBinData } from "@/types";
import { useUser } from "@/contexts/UserContext";

interface ReportPanelProps {
  selectedBin: TrashBinData | null;
  newBinLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "idle" | "submitting" | "success" | "error";

export default function ReportPanel({
  selectedBin,
  newBinLocation,
  onClose,
  onSuccess,
}: ReportPanelProps) {
  const { user } = useUser();
  const [step, setStep] = useState<Step>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNewDiscovery = !selectedBin && !!newBinLocation;
  const reportType = isNewDiscovery ? "new_discovery" : "use";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!user) {
      setMessage("ログインが必要です");
      return;
    }

    setStep("submitting");

    try {
      const body: Record<string, unknown> = {
        userId: user.id,
        lat: selectedBin?.lat ?? newBinLocation?.lat,
        lng: selectedBin?.lng ?? newBinLocation?.lng,
        mimeType: "image/jpeg",
        reportType,
      };
      if (selectedBin) body.trashBinId = selectedBin.id;
      if (imageBase64) body.imageBase64 = imageBase64; // 写真は任意

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || data.error || "エラーが発生しました");
        setStep("error");
        return;
      }

      setPointsEarned(data.pointsEarned);
      setLeveledUp(data.leveledUp || false);
      setMessage(data.message || `${data.pointsEarned}ポイント獲得！`);
      setStep("success");

      setTimeout(() => onSuccess(), 2000);
    } catch {
      setMessage("通信エラーが発生しました");
      setStep("error");
    }
  }

  const bonusPt = isNewDiscovery ? 100 : 10;
  const photoBonusPt = isNewDiscovery ? 0 : 20; // 利用時のみ写真ボーナス

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end justify-center sm:items-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {isNewDiscovery ? "🆕 新規ゴミ箱を発見！" : "🗑️ ゴミ箱を利用する"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* 場所 */}
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <MapPin size={16} className="text-green-500" />
          <span>
            {selectedBin?.name
              ? selectedBin.name
              : `${(selectedBin?.lat ?? newBinLocation?.lat ?? 0).toFixed(5)}, ${(
                  selectedBin?.lng ?? newBinLocation?.lng ?? 0
                ).toFixed(5)}`}
          </span>
        </div>

        {step === "success" ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle size={48} className="text-green-500 mx-auto" />
            <p className="text-3xl font-bold text-green-600">+{pointsEarned} pt</p>
            {leveledUp && (
              <p className="text-yellow-600 font-semibold text-lg">🎉 ゴミ箱がレベルアップ！</p>
            )}
            <p className="text-gray-500 text-sm">{message}</p>
          </div>

        ) : step === "error" ? (
          <div className="text-center space-y-3 py-4">
            <AlertCircle size={48} className="text-red-500 mx-auto" />
            <p className="text-red-600 text-sm">{message}</p>
            <button
              onClick={() => { setStep("idle"); setMessage(""); }}
              className="text-blue-600 underline text-sm"
            >
              もう一度試す
            </button>
          </div>

        ) : (
          <>
            {/* ポイント表示 */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {isNewDiscovery ? "🆕 新規発見ボーナス" : "🗑️ 利用ポイント"}
                </span>
                <span className="font-bold text-green-600">+{bonusPt} pt</span>
              </div>
              {!isNewDiscovery && (
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>📸 写真投稿ボーナス（任意）</span>
                  <span className="font-semibold text-blue-500">+{photoBonusPt} pt</span>
                </div>
              )}
            </div>

            {/* 写真（任意） */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">
                写真を撮影する
                <span className="ml-1 text-gray-400 font-normal">（任意・AIが判定して追加ポイント）</span>
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="プレビュー"
                      className="max-h-32 mx-auto rounded-lg object-cover"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">タップして変更</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3 text-gray-400">
                    <ImagePlus size={20} />
                    <span className="text-sm">写真を選択（スキップ可）</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {message && (
              <p className="text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            {/* 送信ボタン */}
            <button
              onClick={handleSubmit}
              disabled={step === "submitting"}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {step === "submitting" ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {imageBase64 ? "AI判定中..." : "送信中..."}
                </>
              ) : (
                <>
                  <Camera size={20} />
                  {imageBase64
                    ? `投稿する (+${bonusPt + photoBonusPt} pt)`
                    : `利用する (+${bonusPt} pt)`}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
