import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession, logout } from "./auth";

type User = any;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    setLoading(true);
    try {
      const response = await getSession();
      setUser(response?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshSession, signOut }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="rounded-3xl bg-white p-8 shadow-lg border border-zinc-200 text-center">
        <p className="text-zinc-700 font-medium">Loading your session…</p>
      </div>
    </div>
  );
}

/** Any authenticated account. Defaults to consumer login for deep-links from public pages. */
export function RequireAuth({
  children,
  loginPath = "/userlogin",
}: {
  children: React.ReactNode;
  loginPath?: string;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!user) {
    const redirect = `${location.pathname.replace(/^\//, "")}${location.search}`;
    return <Navigate to={`${loginPath}?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <>{children}</>;
}

/** Creator-only pages (legacy helper; CreatorLayout is the primary gate). */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.user_metadata?.role !== "creator") return <Navigate to="/userlogin" replace />;
  return <>{children}</>;
}
