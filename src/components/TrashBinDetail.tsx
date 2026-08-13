"use client";
import { useEffect, useRef, useState } from "react";
import { X, Star, TrendingUp, MapPin, Zap, Landmark, Building2, Loader2, Send, Heart } from "lucide-react";
import { TrashBinData } from "@/types";
import Image from "next/image";
import { getTrashBinLevelName, getTrashBinImage, expForNextLevel, expThreshold, getPersonalityLabel, BIN_TYPE_LABELS } from "@/lib/gameLogic";
import { useUser } from "@/contexts/UserContext";

interface NearbySpot {
  name: string;
  distanceM: number;
  category: "cultural" | "facility";
  address: string;
}

interface RecentPhoto {
  id: string;
  imageUrl: string;
  createdAt: string;
  user: { name: string };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TrashBinDetailProps {
  bin: TrashBinData;
  onClose: () => void;
  onReport: () => void;
  onBinUpdate?: (bin: TrashBinData) => void;
}

export default function TrashBinDetail({ bin, onClose, onReport, onBinUpdate }: TrashBinDetailProps) {
  const { user, setUser } = useUser();

  const levelName = getTrashBinLevelName(bin.level);
  const characterImage = getTrashBinImage(bin.level);
  const nextLevelExp = expForNextLevel(bin.level);
  const currentLevelExp = expThreshold(bin.level);
  const totalExpInLevel = nextLevelExp - currentLevelExp;
  const expProgressInLevel = bin.exp - currentLevelExp;
  const expProgress = totalExpInLevel > 0 ? Math.min((expProgressInLevel / totalExpInLevel) * 100, 100) : 100;
  const personalityLabel = getPersonalityLabel(bin.usageExp ?? 0, bin.knowledgeExp ?? 0, bin.supportExp ?? 0);

  const [spots, setSpots] = useState<NearbySpot[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [cheering, setCheering] = useState(false);
  const [cheered, setCheered] = useState(false);
  const [cheerMsg, setCheerMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const levelColor =
    bin.level >= 50 ? "text-yellow-500" :
    bin.level >= 30 ? "text-purple-500" :
    bin.level >= 10 ? "text-green-500" :
                      "text-blue-500";

  // ゴミ箱が切り替わったら全リセット＆スポット取得
  useEffect(() => {
    setMessages([]);
    setSpots([]);
    setRecentPhotos([]);
    setInput("");
    setChatOpen(false);
    setCheered(false);
    setCheerMsg(null);
    setSpotsLoading(true);
    fetch(`/api/trashbins/${bin.id}/nearby-info`)
      .then((r) => r.json())
      .then((d) => {
        setSpots(d.spots ?? []);
        setRecentPhotos(d.recentPhotos ?? []);
      })
      .catch(() => {})
      .finally(() => setSpotsLoading(false));
  }, [bin.id]);

  // チャットを開いたとき＆最初のメッセージ（挨拶）を自動送信
  async function openChat() {
    if (chatOpen) return;
    setChatOpen(true);
    await sendMessage(null); // ユーザーメッセージなし＝挨拶リクエスト
  }

  // メッセージ送信
  async function sendMessage(userText: string | null) {
    const newMessages: ChatMessage[] = userText
      ? [...messages, { role: "user", content: userText }]
      : messages;

    if (userText) setMessages(newMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/trashbins/${bin.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const reply: string = data.reply ?? "うまく話せなかったよ…ごめんね";

      setMessages((prev) => [...(userText ? prev : newMessages), { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "通信エラーだよ…もう一度試してね🗑️" }]);
    } finally {
      setSending(false);
    }
  }

  // 新メッセージが追加されたら一番下にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleCheer() {
    if (!user || cheering || cheered) return;
    setCheering(true);
    setCheerMsg(null);
    try {
      const res = await fetch(`/api/trashbins/${bin.id}/cheer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCheered(true);
        setCheerMsg(data.message ?? "応援した！");
        setUser({ ...user, totalPoints: data.userTotalPoints });
        if (onBinUpdate && data.bin) onBinUpdate(data.bin);
      } else {
        // 429（既に応援済み）やその他エラーをメッセージ表示
        setCheerMsg(data.error ?? "エラーが発生しました");
        if (res.status === 429) setCheered(true); // 既応援済みとしてボタンを無効化
      }
    } catch {
      setCheerMsg("通信エラー…もう一度試してね");
    } finally {
      setCheering(false);
      setTimeout(() => setCheerMsg(null), 4000);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    sendMessage(input.trim());
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[1000] flex flex-col max-h-[80vh]">
      {/* スクロール可能な上部エリア */}
      <div className="overflow-y-auto p-5 space-y-4 flex-1">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={characterImage} alt={levelName} width={56} height={56} className="object-contain" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">{bin.name || "ゴミ箱"}</h2>
              <p className={`text-sm font-semibold ${levelColor}`}>Lv.{bin.level} {levelName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* EXPバー */}
        <div className="space-y-2">
          {/* 総合Lvバー */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1"><Zap size={12} className="text-yellow-400" />総合EXP</span>
              <span>{bin.exp.toLocaleString()} / {nextLevelExp.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-500"
                style={{ width: `${expProgress}%` }}
              />
            </div>
          </div>
          {/* 3種EXP内訳 */}
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[
              { label: "利用", value: bin.usageExp ?? 0, color: "bg-blue-400" },
              { label: "知識", value: bin.knowledgeExp ?? 0, color: "bg-purple-400" },
              { label: "応援", value: bin.supportExp ?? 0, color: "bg-pink-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-0.5`} />
                <p className="font-semibold text-gray-700">{value.toLocaleString()}</p>
                <p className="text-gray-400">{label}EXP</p>
              </div>
            ))}
          </div>
          {/* 個性ラベル */}
          {personalityLabel && (
            <p className="text-xs text-center text-gray-500 font-medium">{personalityLabel}</p>
          )}
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <TrendingUp size={18} className="mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold text-gray-800">{bin.level}</p>
            <p className="text-xs text-gray-500">レベル</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <Star size={18} className="mx-auto text-yellow-500 mb-1" />
            <p className="text-lg font-bold text-gray-800">{bin.useCount}</p>
            <p className="text-xs text-gray-500">利用回数</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <MapPin size={18} className="mx-auto text-red-500 mb-1" />
            <p className="text-xs font-mono font-bold text-gray-800">{bin.lat.toFixed(4)}</p>
            <p className="text-xs text-gray-500">緯度</p>
          </div>
        </div>

        {/* ゴミ箱情報 */}
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-semibold">種別:</span> {BIN_TYPE_LABELS[bin.binType] || bin.binType}</p>
          {bin.source === "osm" && <p className="text-xs text-gray-400">📍 OpenStreetMapより</p>}
        </div>

        {/* 最近の投稿写真 */}
        {recentPhotos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">最近の投稿写真</p>
            <div className="grid grid-cols-3 gap-1.5">
              {recentPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxSrc(photo.imageUrl)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={`${photo.user.name}の投稿`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 周辺スポット（常時展開） */}
        {spotsLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" />周辺スポットを検索中…
          </div>
        )}
        {!spotsLoading && spots.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">周辺スポット（500m以内）</p>
            {spots.map((spot, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                {spot.category === "cultural"
                  ? <Landmark size={14} className="text-purple-500 shrink-0" />
                  : <Building2 size={14} className="text-blue-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{spot.name}</p>
                  <p className="text-xs text-gray-400">約{Math.round(spot.distanceM)}m · {spot.category === "cultural" ? "文化財" : "公共施設"}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* チャット開始ボタン */}
        {!chatOpen && (
          <button
            onClick={openChat}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm border border-blue-200"
          >
            🗣️ このゴミ箱に話しかける
          </button>
        )}

        {/* チャットエリア */}
        {chatOpen && (
          <div className="space-y-2">
            {/* メッセージ一覧 */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <Image src={characterImage} alt="" width={24} height={24} className="object-contain self-end shrink-0" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-green-500 text-white rounded-br-sm"
                        : "bg-blue-50 text-blue-900 border border-blue-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-2 justify-start">
                  <Image src={characterImage} alt="" width={24} height={24} className="object-contain self-end shrink-0" />
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl rounded-bl-sm px-3 py-2">
                    <Loader2 size={16} className="animate-spin text-blue-400" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* 応援 & ゴミ捨てボタン */}
        <div className="flex gap-2">
          {user && (
            <button
              onClick={handleCheer}
              disabled={cheering || cheered}
              className={`flex-1 font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border text-sm
                ${cheered
                  ? "bg-pink-100 text-pink-400 border-pink-200 cursor-default"
                  : "bg-pink-50 hover:bg-pink-100 disabled:bg-gray-100 text-pink-600 border-pink-200"}`}
            >
              {cheering
                ? <Loader2 size={16} className="animate-spin" />
                : <Heart size={16} className={cheered ? "fill-pink-400" : ""} />}
              {cheered ? "応援済み ✓" : "応援する (+20pt)"}
            </button>
          )}
          <button
            onClick={onReport}
            className={`${user ? "flex-1" : "w-full"} bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors`}
          >
            🗑️ ゴミを捨てる (+10 pt)
          </button>
        </div>
        {cheerMsg && (
          <p className={`text-center text-sm font-semibold ${cheered && !cheerMsg?.includes("エラー") ? "text-pink-600" : "text-orange-500"}`}>
            {cheerMsg}
          </p>
        )}
      </div>

      {/* チャット入力欄（チャットオープン時のみ・底面固定） */}
      {chatOpen && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-200 px-4 py-3 flex gap-2 bg-white shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="何か話しかけてみよう…"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-3 py-2 flex items-center justify-center transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      )}

      {/* ライトボックス（写真フルサイズ表示） */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-[3000] flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="投稿写真"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
