"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Trophy, User, LogOut, Footprints } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useState, useRef, useEffect } from "react";

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-[1500]">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/map" className="flex items-center gap-2">
          <span className="text-2xl">🗑️</span>
          <span className="font-bold text-gray-800 text-sm sm:text-base">
            東京ゴミ箱マップ
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/map"
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/map"
                ? "bg-green-100 text-green-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Map size={16} />
            <span className="hidden sm:inline">マップ</span>
          </Link>

          <Link
            href="/routes"
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/routes"
                ? "bg-green-100 text-green-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Footprints size={16} />
            <span className="hidden sm:inline">散歩</span>
          </Link>

          <Link
            href="/ranking"
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/ranking"
                ? "bg-yellow-100 text-yellow-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Trophy size={16} />
            <span className="hidden sm:inline">ランキング</span>
          </Link>
        </nav>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 bg-green-50 hover:bg-green-100 rounded-xl px-3 py-1.5 transition-colors"
            >
              <User size={14} className="text-green-600" />
              <div className="text-xs text-left">
                <p className="font-semibold text-gray-800 leading-none">{user.name}</p>
                <p className="text-green-600 font-bold">{user.totalPoints} pt</p>
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px] z-10">
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  ログアウト
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
