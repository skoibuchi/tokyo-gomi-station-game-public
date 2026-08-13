"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  totalPoints: number;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (name: string, email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
  loading: false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("gomi_user");
    if (stored) {
      try {
        const parsed: User = JSON.parse(stored);
        // DBに実際に存在するか確認する（古いDB由来のIDを弾く）
        fetch(`/api/users?email=${encodeURIComponent(parsed.email)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data && data.id) {
              // DBのデータで上書き（IDが変わっていても対応）
              const fresh: User = {
                id: data.id,
                name: data.name,
                email: data.email,
                totalPoints: data.totalPoints,
              };
              setUser(fresh);
              localStorage.setItem("gomi_user", JSON.stringify(fresh));
            } else {
              // DBに存在しない → 古いデータを削除
              localStorage.removeItem("gomi_user");
            }
          })
          .catch(() => {
            // ネットワークエラー時はとりあえず既存データを使う
            setUser(parsed);
          })
          .finally(() => setLoading(false));
        return; // loading は fetch 完了後に false にする
      } catch {
        localStorage.removeItem("gomi_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (name: string, email: string) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      localStorage.setItem("gomi_user", JSON.stringify(data));
    }
  };

  const updateUser = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem("gomi_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("gomi_user");
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    const res = await fetch(`/api/users?email=${encodeURIComponent(user.email)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) updateUser(data);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gomi_user");
  };

  return (
    <UserContext.Provider value={{ user, setUser: updateUser, login, logout, refreshUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
