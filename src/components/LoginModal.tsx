"use client";
import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { User, LogIn } from "lucide-react";

export default function LoginModal() {
  const { login, user } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    await login(name, email);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="text-5xl">🗑️</div>
          <h1 className="text-2xl font-bold text-gray-800">ゴミ箱マップ</h1>
          <p className="text-gray-500 text-sm">ゴミ箱を発見してポイントを獲得しよう！</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ゴミハンターTaro"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              "ログイン中..."
            ) : (
              <>
                <LogIn size={18} />
                はじめる
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
          <User size={20} className="text-green-500 shrink-0" />
          <p className="text-xs text-green-700">
            初回は自動でアカウント作成されます
          </p>
        </div>
      </div>
    </div>
  );
}
