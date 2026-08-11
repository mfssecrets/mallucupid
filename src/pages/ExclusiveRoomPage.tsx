import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Crown, Loader2, AlertCircle, Plus, ImagePlus, Video, LockKeyhole,
  Play, Settings, Layers,
} from "lucide-react";
import {
  getExclusiveRoom,
  checkoutExclusiveRoom,
  verifyExclusiveRoomPayment,
  deleteExclusiveRoomPost,
  deleteExclusiveRoom,
  type ExclusiveRoom,
  type ExclusiveRoomPost,
} from "../lib/auth";
import { loadRazorpay } from "../lib/razorpay";
import { useAuth } from "../lib/useAuth";

const formatInr = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function ExclusiveRoomPage() {
  const { username, roomId } = useParams<{ username?: string; roomId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<ExclusiveRoom | null>(null);
  const [posts, setPosts] = useState<ExclusiveRoomPost[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [postMenu, setPostMenu] = useState(false);

  const manageBase = username
    ? `/${username}`
    : user?.user_metadata?.username
    ? `/${user.user_metadata.username}`
    : "";

  const load = useCallback(async () => {
    if (!roomId) return;
    const res = await getExclusiveRoom(roomId);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRoom(res.room || null);
    setPosts(res.posts || []);
    setHasAccess(Boolean(res.has_access));
    setIsOwner(Boolean(res.is_owner));
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const order = search.get("order");
    const payment = search.get("payment");
    const signature = search.get("signature");
    if (!order || !payment || !signature || !roomId) return;
    (async () => {
      setBusy(true);
      setError("");
      const verified = await verifyExclusiveRoomPayment({
        room_id: roomId,
        razorpay_order_id: order,
        razorpay_payment_id: payment,
        razorpay_signature: signature,
      });
      setBusy(false);
      if (verified.error) {
        setError(verified.error);
        navigate(username ? `/${username}/exclusive/${roomId}` : `/exclusive/${roomId}`, { replace: true });
        return;
      }
      navigate(username ? `/${username}/exclusive/${roomId}` : `/exclusive/${roomId}`, { replace: true });
      await load();
    })();
  }, [search, roomId, username, navigate, load]);

  const goBack = () => {
    if (username && isOwner) navigate(`/${username}`);
    else if (room?.creator_slug) navigate(`/${room.creator_slug}`);
    else navigate(-1);
  };

  const handleDeleteRoom = async () => {
    if (!room || !isOwner) return;
    if (!window.confirm("Delete this exclusive room and all posts inside it?")) return;
    setBusy(true);
    const r = await deleteExclusiveRoom(room.id);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    navigate(manageBase || "/", { replace: true });
  };

  const enterRoom = async () => {
    if (!room || busy) return;
    setError("");
    if (!user) {
      navigate(`/userlogin?redirect=${encodeURIComponent(`/exclusive/${roomId}`)}`);
      return;
    }
    setBusy(true);
    const checkout = await checkoutExclusiveRoom(room.id);
    if (checkout.already_unlocked) {
      setBusy(false);
      await load();
      return;
    }
    if (checkout.error || !checkout.order_id || !checkout.key_id) {
      setBusy(false);
      setError(checkout.error || "Unable to start payment");
      return;
    }
    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay) {
      setBusy(false);
      setError("Could not load Razorpay");
      return;
    }
    const returnPath = username
      ? `/${username}/exclusive/${room.id}`
      : `/exclusive/${room.id}`;
    const gateway = new window.Razorpay({
      key: checkout.key_id,
      amount: checkout.amount,
      currency: checkout.currency || "INR",
      name: "MalluCupid Exclusive",
      description: `${room.name} · monthly access`,
      order_id: checkout.order_id,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        const verified = await verifyExclusiveRoomPayment({
          room_id: room.id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        setBusy(false);
        if (verified.error) {
          setError(verified.error);
          return;
        }
        navigate(returnPath, { replace: true });
        await load();
      },
      modal: {
        ondismiss: () => setBusy(false),
      },
    });
    gateway.open();
  };

  const openPost = (post: ExclusiveRoomPost) => {
    if (!hasAccess) return;
    navigate(`/view/exclusive/${post.public_id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-3 px-6">
        <p className="text-zinc-700 font-medium">{error || "Room not found"}</p>
        <button type="button" onClick={goBack} className="text-rose-500 font-semibold text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-24 md:py-8">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-3 mb-5">
          <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-zinc-900 truncate flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-rose-500 shrink-0" />
              {room.name}
            </h1>
            <p className="text-xs text-zinc-500">
              {formatInr(room.entry_fee)}/month
              {room.expires_at && hasAccess && !isOwner
                ? ` · access until ${new Date(room.expires_at).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          {isOwner && manageBase && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate(`${manageBase}/exclusive/${room.id}/edit`)}
                className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                aria-label="Edit room"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteRoom}
                disabled={busy}
                className="px-2.5 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {!hasAccess ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 text-center shadow-sm mb-6">
            <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border-2 border-rose-200 mb-4">
              {room.thumbnail_url ? (
                <img src={room.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-rose-50 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-rose-400" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-1">{room.name}</h2>
            <p className="text-sm text-zinc-500 mb-5">
              Pay a monthly entry fee to unlock every photo and video in this exclusive room.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={enterRoom}
              className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
              Enter for {formatInr(room.entry_fee)}/mo
            </button>
          </div>
        ) : (
          <>
            {isOwner && manageBase && (
              <div className="relative mb-4">
                <button
                  type="button"
                  onClick={() => setPostMenu((v) => !v)}
                  className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Post to room
                </button>
                {postMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPostMenu(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-zinc-100 shadow-xl z-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setPostMenu(false);
                          navigate(`${manageBase}/exclusive/${room.id}/create?type=photo`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-rose-50 text-left"
                      >
                        <ImagePlus className="w-5 h-5 text-rose-500" />
                        <span className="font-semibold text-sm">Photo</span>
                      </button>
                      <div className="h-px bg-zinc-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setPostMenu(false);
                          navigate(`${manageBase}/exclusive/${room.id}/create?type=video`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-rose-50 text-left"
                      >
                        <Video className="w-5 h-5 text-rose-500" />
                        <span className="font-semibold text-sm">Video</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {posts.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Layers className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                <p className="font-medium">No posts in this room yet</p>
                {isOwner && <p className="text-sm mt-1">Use Post to room to add photos or videos.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => openPost(post)}
                    className="relative aspect-[4/5] rounded-xl overflow-hidden bg-zinc-900 group"
                  >
                    {post.media_type === "video" ? (
                      <>
                        <video src={post.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        <Play className="absolute inset-0 m-auto w-8 h-8 text-white fill-white drop-shadow" />
                      </>
                    ) : (
                      <img src={post.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    )}
                    {post.media_count > 1 && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded">
                        {post.media_count}
                      </span>
                    )}
                    {isOwner && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm("Delete this room post?")) return;
                          const r = await deleteExclusiveRoomPost(post.public_id);
                          if (r.error) setError(r.error);
                          else load();
                        }}
                        className="absolute bottom-2 right-2 text-[10px] font-bold bg-red-500/90 text-white px-2 py-1 rounded-lg"
                      >
                        Delete
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
