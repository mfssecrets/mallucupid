import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MobileHeader } from "./MobileHeader";
import { MobileNavbar } from "./MobileNavbar";
import { useAuth } from "../lib/useAuth";
import { getProfile } from "../lib/auth";

/**
 * Layout for all /:username routes. Verifies the URL username belongs to the
 * logged-in creator (redirecting to the canonical one otherwise) and renders
 * the fixed mobile header + navbar on every page after login.
 */
export default function CreatorLayout() {
  const { username } = useParams<{ username: string }>();
  const { user, loading } = useAuth();
  const location = useLocation();
  const [canonical, setCanonical] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user || user.user_metadata?.role !== "creator") {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await getProfile();
      if (!cancelled) {
        setCanonical(response.profile?.username || null);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.user_metadata?.role !== "creator") {
    return <Navigate to="/user-inbox" replace />;
  }

  if (canonical && username !== canonical) {
    const rest = location.pathname.split("/").slice(2).join("/");
    return <Navigate to={`/${canonical}${rest ? `/${rest}` : ""}${location.search}`} replace />;
  }

  return (
    <>
      <MobileHeader />
      <Outlet />
      <MobileNavbar />
    </>
  );
}
