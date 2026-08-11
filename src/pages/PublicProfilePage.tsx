import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Download, Grid, Heart, Loader2, LockKeyhole, LogIn, LogOut,
  MessageCircle, MonitorX, Play, PlaySquare, Share, UserPlus, X, Eye,
} from "lucide-react";
import {
  checkoutPost, getPost, getPublicProfile, startConversation, togglePublicFollow,
  verifyPostPayment, getPostPaymentStatus,
  type PublicProfileData, type PublicProfilePost, type PaymentBreakdown,
} from "../lib/auth";
import { ExclusiveHighlightsRow } from "../components/ExclusiveHighlightsRow";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useAuth } from "../lib/useAuth";
import { BRAND_APP_ICON_URL, BRAND_LOGO_URL } from "../lib/brand";
import { loadRazorpay, type RazorpaySuccess } from "../lib/razorpay";
import PaymentDialog from "../components/PaymentDialog";
import PaymentResultScreen from "../components/PaymentResultScreen";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const detectMobileDevice = () => {
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (mobileUa || iPadOs) && navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
};

function useMobileDevice() {
  const [mobile, setMobile] = useState(detectMobileDevice);
  useEffect(() => {
    const check = () => setMobile(detectMobileDevice());
    addEventListener("resize", check);
    addEventListener("orientationchange", check);
    return () => {
      removeEventListener("resize", check);
      removeEventListener("orientationchange", check);
    };
  }, []);
  return mobile;
}

function DesktopBlock() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-sm bg-white rounded-3xl p-9 text-center">
        <MonitorX className="w-10 h-10 text-rose-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Mobile only</h1>
        <p className="text-sm text-zinc-500 mt-2">Open this creator link on a mobile device.</p>
      </div>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center">
          <motion.button
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-10"
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100">
              <X className="w-4 h-4" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function PublicProfilePage() {
  const mobile = useMobileDevice();
  const navigate = useNavigate();
  const { username: slug = "" } = useParams<{ username: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"image" | "video">("image");
  const [following, setFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [installed, setInstalled] = useState(matchMedia("(display-mode: standalone)").matches);

  // ── Payment dialog state ──────────────────────────────────────────────────
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payBreakdown, setPayBreakdown] = useState<PaymentBreakdown | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payDialogError, setPayDialogError] = useState("");
  const [activePost, setActivePost] = useState<PublicProfilePost | null>(null);

  // ── Payment result screen ─────────────────────────────────────────────────
  const [resultOpen, setResultOpen] = useState(false);
  const [resultKind, setResultKind] = useState<"success" | "failed">("success");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await getPublicProfile(slug);
      if (cancelled) return;
      setLoading(false);
      if (!response.profile) {
        setError(response.error || "Creator not found");
        return;
      }
      const next = response as PublicProfileData;
      setData(next);
      setFollowing(next.viewer?.is_following || false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const done = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    addEventListener("beforeinstallprompt", capture);
    addEventListener("appinstalled", done);
    return () => {
      removeEventListener("beforeinstallprompt", capture);
      removeEventListener("appinstalled", done);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.profile.full_name || data.profile.username} | MalluCupid`;
    return () => {
      document.title = "MalluCupid";
    };
  }, [data]);

  // Swap in a per-creator manifest so "Install" opens this creator's page
  // (https://www.mallucupid.com/<username><serial>), not the homepage.
  useEffect(() => {
    if (!data) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const originalHref = link.href;
    const creatorPath = `/${slug}`;
    const manifest = {
      name: `${data.profile.full_name || data.profile.username} | MalluCupid`,
      short_name: data.profile.username,
      description: "Follow creators, chat, and unlock exclusive content.",
      start_url: `${location.origin}${creatorPath}`,
      scope: `${location.origin}/`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#f43f5e",
      icons: [
        { src: BRAND_APP_ICON_URL, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: BRAND_APP_ICON_URL, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    };
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
    );
    link.href = blobUrl;
    return () => {
      link.href = originalHref;
      URL.revokeObjectURL(blobUrl);
    };
  }, [data, slug]);

  const posts = useMemo(
    () => (data?.posts || []).filter((post) => post.media_type === tab),
    [data, tab],
  );
  const userLogin = () => navigate(`/userlogin?redirect=${encodeURIComponent(slug)}`);
  const isLoggedIn = Boolean(user) || Boolean(data?.viewer?.authenticated);
  const isOwnPage =
    Boolean(user?.user_metadata?.username) &&
    String(user?.user_metadata?.username).toLowerCase() === String(data?.profile.username || "").toLowerCase();

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    navigate(`/userlogin?redirect=${encodeURIComponent(slug)}`, { replace: true });
  };

  // Server 401s are the final authority: a stale client session must never
  // leave the user on the page thinking the action worked.
  const isAuthError = (message?: string) =>
    Boolean(message && /unauthorized|login required|valid account required/i.test(message));

  const requireLogin = () => {
    if (authLoading) return false;
    if (!isLoggedIn) {
      userLogin();
      return false;
    }
    return true;
  };

  const follow = async () => {
    if (actionLoading || authLoading) return;
    setActionError("");
    if (!requireLogin()) return;
    if (isOwnPage) {
      setActionError("You can't follow your own page.");
      return;
    }
    setActionLoading(true);
    const response = await togglePublicFollow(slug);
    setActionLoading(false);
    if (isAuthError(response.error)) return userLogin();
    if (response.error) {
      setActionError(response.error);
      return;
    }
    if (typeof response.following === "boolean") {
      setFollowing(response.following);
      setData((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                followers: Math.max(0, prev.stats.followers + (response.following ? 1 : -1)),
              },
            }
          : prev,
      );
    }
  };

  const chat = async () => {
    if (actionLoading || authLoading) return;
    setActionError("");
    if (!requireLogin()) return;
    if (!data) return;
    if (isOwnPage) {
      setActionError("You can't chat with your own page.");
      return;
    }
    setActionLoading(true);
    const response = await startConversation(data.profile.username);
    setActionLoading(false);
    if (isAuthError(response.error)) return userLogin();
    if (response.error) {
      setActionError(response.error);
      return;
    }
    if (response.conversation_id) {
      // Open the exact chat page (consumer route). Real messages use the
      // conversations/messages APIs — no local mock thread.
      navigate(`/user-chat/${response.conversation_id}`, { replace: false });
    } else {
      setActionError("Could not open chat. Please try again.");
    }
  };

  const openPost = async (post: PublicProfilePost) => {
    if (actionLoading || authLoading) return;
    setActionError("");
    if (!requireLogin()) return;
    setPaymentError("");

    // Always ask the backend first. It is the only authority for ownership
    // and permanent purchase access.
    const detail = await getPost(post.public_id);
    if (isAuthError(detail.error)) {
      return userLogin();
    }
    if (detail.post?.has_access) {
      navigate(`/view/${post.public_id}`);
      return;
    }
    if (!post.is_paid) {
      setPaymentError(detail.error || "Unable to open this post right now.");
      return;
    }

    // Show the payment dialog with a server-issued breakdown (content amount,
    // 3% platform charge, final amount). NEVER trust frontend pricing.
    setActivePost(post);
    setPayBreakdown(null);
    setPayDialogError("");
    setPayLoading(true);
    setPayDialogOpen(true);

    const checkout = await checkoutPost(post.public_id);
    setPayLoading(false);
    if (isAuthError(checkout.error)) {
      setPayDialogOpen(false);
      return userLogin();
    }
    if (checkout.already_unlocked) {
      setPayDialogOpen(false);
      navigate(`/view/${post.public_id}`);
      return;
    }
    if (checkout.error || !checkout.order_id || !checkout.key_id) {
      setPayDialogError(checkout.error || "Unable to start payment. Please try again.");
      return;
    }
    setPayBreakdown(checkout as PaymentBreakdown);
  };

  // Razorpay checkout.success → verify server-side, then show result UI.
  const handlePaySuccess = async (payment: RazorpaySuccess) => {
    if (!activePost) return;
    setPayDialogOpen(false);
    // Optimistically show success screen ONLY after server confirms.
    const verified = await verifyPostPayment({
      public_id: activePost.public_id,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    });
    if (verified.status === "paid") {
      setResultKind("success");
      setResultOpen(true);
      return;
    }
    // Reconcile via /post-payment-status (handles captured-but-callback-lost)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await getPostPaymentStatus(activePost.public_id, payment.razorpay_order_id);
      if (status.has_access || status.status === "paid") {
        setResultKind("success");
        setResultOpen(true);
        return;
      }
      if (attempt < 7) await new Promise((r) => setTimeout(r, 1500));
    }
    setResultKind("failed");
    setResultOpen(true);
  };

  // User closed Razorpay without paying — reconcile in case money was debited
  // but the browser callback was interrupted. If no capture, just close.
  const handlePayDismiss = async () => {
    if (!activePost) {
      setPayDialogOpen(false);
      return;
    }
    // Reconcile server-side; if paid, show success screen.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const status = await getPostPaymentStatus(activePost.public_id, payBreakdown?.order_id || "");
      if (status.has_access || status.status === "paid") {
        setPayDialogOpen(false);
        setResultKind("success");
        setResultOpen(true);
        return;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1200));
    }
    // No capture detected — keep dialog open so the user can retry.
    setPayDialogError("");
  };

  const handleResultDone = () => {
    setResultOpen(false);
    if (resultKind === "success" && activePost) {
      navigate(`/view/${activePost.public_id}`);
    }
    setActivePost(null);
    setPayBreakdown(null);
  };

  const handleResultRetry = () => {
    setResultOpen(false);
    // Re-fetch breakdown and reopen dialog
    if (activePost) {
      openPost(activePost);
    }
  };

  const install = async () => {
    if (installed) return;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    } else {
      setInstallHelp(true);
    }
  };

  if (!mobile) return <DesktopBlock />;

  return (
    <div className="min-h-screen bg-[#f4fff9] text-zinc-900">
      <main className="w-full max-w-md mx-auto min-h-screen bg-white shadow-2xl">
        <section className="relative">
          <div className="absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="absolute top-3 left-3 right-3 z-30 flex items-start justify-between text-white">
            <div className="flex gap-4">
              {isLoggedIn ? (
                <button
                  className="flex flex-col items-center text-[11px] disabled:opacity-60"
                  onClick={handleLogout}
                  disabled={signingOut || authLoading}
                >
                  <div className="w-7 h-7 rounded-full border border-white/80 flex items-center justify-center">
                    {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  </div>
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  className="flex flex-col items-center text-[11px]"
                  onClick={userLogin}
                >
                  <div className="w-7 h-7 rounded-full border border-white/80 flex items-center justify-center">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <span>Login</span>
                </button>
              )}
              <button
                onClick={follow}
                disabled={actionLoading || authLoading}
                className="flex flex-col items-center text-[11px] disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 mt-1 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5 mt-1" />
                )}
                <span>{following ? "Following" : "Follow"}</span>
              </button>
            </div>
            <button
              onClick={install}
              disabled={installed}
              className="h-10 px-4 rounded-lg bg-rose-500 text-white text-sm font-semibold shadow-lg disabled:bg-emerald-500"
            >
              {installed ? "Installed" : "Install"}
            </button>
          </div>
          <div className="h-[238px] overflow-hidden bg-gradient-to-br from-rose-400 via-rose-500 to-amber-400" />
        </section>

        {loading && (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
          </div>
        )}
        {!loading && error && (
          <div className="py-20 px-6 text-center">
            <h1 className="font-bold">Creator not found</h1>
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
          </div>
        )}
        {!loading && data && (
          <>
            <section className="bg-[#effff7] px-6 pt-7 pb-8 text-center">
              <div className="w-24 h-24 rounded-full ring-4 ring-white shadow-lg overflow-hidden mx-auto -mt-20 relative z-20 bg-rose-100">
                {data.profile.avatar_url ? (
                  <img
                    src={data.profile.avatar_url}
                    alt={data.profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-rose-500">
                    {(data.profile.full_name || data.profile.username)[0].toUpperCase()}
                  </div>
                )}
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-rose-500">
                Hi, I'm {data.profile.full_name || data.profile.username}
              </h1>
              <p className="text-sm font-semibold text-zinc-700 mt-1 inline-flex items-center justify-center gap-1.5">
                @{data.profile.username}
                <VerifiedBadge verified={data.profile.is_verified} size="sm" />
              </p>
              <div className="flex justify-center gap-10 mt-4">
                <div>
                  <strong>{data.stats.posts}</strong>
                  <span className="block text-xs text-zinc-500">posts</span>
                </div>
                <div>
                  <strong>{data.stats.followers}</strong>
                  <span className="block text-xs text-zinc-500">subscribers</span>
                </div>
              </div>
              {data.profile.bio && (
                <p className="mt-5 text-[15px] leading-6 text-zinc-600">{data.profile.bio}</p>
              )}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  disabled={actionLoading || authLoading}
                  onClick={follow}
                  className="h-11 rounded-lg bg-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {following ? "Following" : "Follow"}
                </button>
                <button
                  disabled={actionLoading || authLoading}
                  onClick={chat}
                  className="h-11 rounded-lg bg-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Chat Now
                </button>
              </div>
              {(actionError || paymentError) && (
                <p className="mt-3 text-sm text-red-600">{actionError || paymentError}</p>
              )}
              {(data.rooms?.length || 0) > 0 && (
                <div className="mt-6">
                  <ExclusiveHighlightsRow
                    rooms={data.rooms || []}
                    onOpenRoom={(room) => {
                      if (!requireLogin()) return;
                      navigate(`/exclusive/${room.id}`);
                    }}
                  />
                </div>
              )}
            </section>

            <section className="bg-[#effff7] min-h-[68vh] px-4 pb-20">
              <h2 className="text-xl font-semibold text-rose-500 pt-1 pb-4">Exclusive Content</h2>
              {data?.content_locked ? (
                <div className="py-16 px-4 text-center rounded-2xl bg-white border border-amber-100">
                  <LockKeyhole className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="mt-4 font-semibold text-zinc-900">Content locked</p>
                  <p className="mt-2 text-sm text-zinc-500 leading-6">
                    This creator’s posts and Exclusive Rooms are locked while their verification badge is inactive.
                  </p>
                </div>
              ) : (
              <>
              <div className="grid grid-cols-2 border-b border-emerald-100 mb-4">
                <button
                  onClick={() => setTab("image")}
                  className={`py-3 flex justify-center border-b-2 ${
                    tab === "image" ? "border-rose-500 text-rose-500" : "border-transparent text-zinc-400"
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setTab("video")}
                  className={`py-3 flex justify-center border-b-2 ${
                    tab === "video" ? "border-rose-500 text-rose-500" : "border-transparent text-zinc-400"
                  }`}
                >
                  <PlaySquare className="w-5 h-5" />
                </button>
              </div>
              {posts.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {posts.map((post) => (
                    <button
                      key={post.public_id}
                      onClick={() => openPost(post)}
                      className="rounded-2xl overflow-hidden bg-white shadow-sm border border-emerald-100 text-left"
                    >
                      <div className="relative aspect-[4/5] bg-zinc-900 overflow-hidden">
                        {post.is_paid || !post.media_url ? (
                          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950 flex flex-col items-center justify-center text-white">
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                              <LockKeyhole className="w-6 h-6 text-zinc-900" />
                            </div>
                            <strong className="mt-4 text-sm">
                              {post.is_paid ? "Exclusive Content" : "Login to view"}
                            </strong>
                            <span className="mt-1 text-xs text-zinc-300">
                              {post.is_paid ? "Unlock to view" : "Sign in required"}
                            </span>
                            {post.is_paid ? (
                              <span className="mt-4 bg-white text-zinc-900 rounded-full px-4 py-2 text-xs font-bold">
                                Unlock for ₹{post.price}
                              </span>
                            ) : null}
                          </div>
                        ) : post.media_type === "video" ? (
                          <>
                            <video
                              src={post.media_url}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                            <Play className="absolute inset-0 m-auto w-8 h-8 text-white fill-white" />
                          </>
                        ) : (
                          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-3 text-white text-xs font-semibold drop-shadow-md">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 fill-white" /> {post.like_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {post.view_count}
                          </span>
                        </div>
                      </div>
                      {post.is_paid && (
                        <div className="p-3 flex justify-between text-xs">
                          <span>Premium post</span>
                          <span className="text-rose-500 font-bold">₹{post.price}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-zinc-400">
                  No {tab === "image" ? "photo" : "video"} posts yet.
                </div>
              )}
              </>
              )}
            </section>

            <section className="bg-white px-5 pt-24 pb-12 border-t border-rose-100">
              <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-pink-500 p-7 text-white shadow-xl shadow-rose-200/60">
                <img src={BRAND_LOGO_URL} alt="MalluCupid" className="h-10 w-auto object-contain mb-4 brightness-0 invert" draggable={false} />
                <h2 className="text-2xl font-bold">Be a creator</h2>
                <p className="text-sm leading-6 text-rose-50 mt-2">
                  Build your audience and sell exclusive photos and videos from your own page.
                </p>
                <button
                  onClick={() => { window.location.href = "https://www.mallucupid.com/"; }}
                  className="w-full h-12 mt-6 rounded-xl bg-white text-rose-500 font-bold"
                >
                  Start Earning
                </button>
              </div>
              <p className="text-center text-xs text-zinc-400 mt-8">
                © {new Date().getFullYear()} MalluCupid
              </p>
            </section>
          </>
        )}
      </main>

      <BottomSheet open={installHelp} onClose={() => setInstallHelp(false)}>
        <Download className="w-9 h-9 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">Install this page</h2>
        <p className="text-sm text-zinc-500 mt-2 leading-6">
          On Android Chrome, open the browser menu and tap <strong>Install app</strong> or{" "}
          <strong>Add to Home screen</strong>. On iPhone Safari, tap{" "}
          <Share className="inline w-4 h-4" /> Share, then <strong>Add to Home Screen</strong>.
        </p>
      </BottomSheet>

      <PaymentDialog
        open={payDialogOpen}
        breakdown={payBreakdown}
        loading={payLoading}
        error={payDialogError}
        onClose={() => {
          setPayDialogOpen(false);
          setActivePost(null);
          setPayBreakdown(null);
          setPayDialogError("");
        }}
        onPaySuccess={handlePaySuccess}
        onPayDismiss={handlePayDismiss}
        prefill={{
          email: user?.email || "",
          name: user?.user_metadata?.name || user?.user_metadata?.full_name || "",
        }}
        brandName="MalluCupid"
        description={`Unlock @${data?.profile.username || "creator"} post`}
      />

      <PaymentResultScreen
        open={resultOpen}
        result={resultKind}
        amountLabel={payBreakdown ? `₹${((payBreakdown.final_amount_paise ?? 0) / 100).toFixed(2)}` : undefined}
        contentName={payBreakdown?.content_name}
        onRetry={resultKind === "failed" ? handleResultRetry : undefined}
        onDone={handleResultDone}
        doneLabel="View unlocked post"
      />
    </div>
  );
}
