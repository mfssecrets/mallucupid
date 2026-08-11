import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, MoreVertical, Heart, Pencil, Trash2, Flag, ChevronLeft, ChevronRight,
  Play, Pause, Loader2, LockKeyhole, AlertCircle, X, Eye, SkipBack, SkipForward,
} from "lucide-react";
import {
  getPost, togglePostLike, deletePost, checkoutPost,
  type PostDetail,
} from "../lib/auth";
import { loadRazorpay, type RazorpaySuccess } from "../lib/razorpay";
import { useAuth } from "../lib/useAuth";
import { CaptureShield, SecureImage, SecureVideo, useCaptureDeterrent } from "../components/SecureMedia";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SEEK_STEP_SECONDS = 5;

export default function MediaViewerPage() {
  const { username, postId } = useParams<{ username: string; postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const obscured = useCaptureDeterrent();
  const watermark = user?.user_metadata?.username || user?.user_metadata?.name || "MalluCupid";
  const base = username ? `/${username}` : "";
  const goBack = () => username ? navigate(base) : navigate(-1);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const [liking, setLiking] = useState(false);

  // Video state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const loginRedirect = useCallback(() => {
    const loginPath = username ? "/login" : "/userlogin";
    const redirect = username ? `${username}/post/${postId}` : `view/${postId}`;
    navigate(`${loginPath}?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [navigate, postId, username]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const response = await getPost(postId);
    if (response.post) {
      setPost(response.post);
      setError("");
    } else if (response.error && /unauthorized|login/i.test(response.error)) {
      // Security wall: post details and media are never available to guests.
      loginRedirect();
      return;
    } else {
      setError(response.error || "Failed to load post");
    }
    setIsLoading(false);
  }, [postId, loginRedirect]);

  useEffect(() => {
    setIsLoading(true);
    loadPost();
  }, [loadPost]);

  const handleLike = async () => {
    if (!post || liking) return;
    setLiking(true);
    const previous = post;
    setPost({
      ...post,
      liked_by_me: !post.liked_by_me,
      like_count: Math.max(0, post.like_count + (post.liked_by_me ? -1 : 1)),
    });
    const response = await togglePostLike(post.public_id);
    if (typeof response.like_count === "number") {
      setPost((prev) => prev
        ? { ...prev, like_count: response.like_count as number, liked_by_me: Boolean(response.liked) }
        : prev);
    } else if (response.error) {
      setPost(previous);
      if (/unauthorized|login/i.test(response.error)) loginRedirect();
    }
    setLiking(false);
  };

  const handleDelete = async () => {
    if (!post || isDeleting) return;
    setIsDeleting(true);
    const response = await deletePost(post.public_id);
    if (response.status === "post_deleted") {
      username ? navigate(base, { replace: true }) : navigate(-1);
    } else {
      setError(response.error || "Failed to delete post");
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleUnlock = async () => {
    if (!post || isPaying) return;
    setPayError("");
    setIsPaying(true);

    const checkout = await checkoutPost(post.public_id);
    if (checkout.error && /unauthorized|login/i.test(checkout.error)) {
      setIsPaying(false);
      loginRedirect();
      return;
    }
    if (checkout.already_unlocked) {
      await loadPost();
      setIsPaying(false);
      return;
    }
    if (checkout.error || !checkout.order_id || !checkout.key_id) {
      setPayError(checkout.error || "Failed to start payment. Please try again.");
      setIsPaying(false);
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay) {
      setPayError("Could not load the payment gateway. Check your connection and try again.");
      setIsPaying(false);
      return;
    }

    const razorpay = new window.Razorpay({
      key: checkout.key_id,
      amount: checkout.amount,
      currency: checkout.currency || "INR",
      name: "MalluCupid",
      description: "Unlock exclusive post",
      order_id: checkout.order_id,
      theme: { color: "#f43f5e" },
      handler: (payment: RazorpaySuccess) => {
        setIsPaying(false);
        navigate(
          `/payment-confirmation?post=${encodeURIComponent(post.public_id)}&order=${encodeURIComponent(payment.razorpay_order_id)}`,
          { state: { payment } },
        );
      },
      modal: {
        ondismiss: () => {
          setIsPaying(false);
          navigate(
            `/payment-confirmation?post=${encodeURIComponent(post.public_id)}&order=${encodeURIComponent(checkout.order_id as string)}`,
          );
        },
      },
    });
    razorpay.open();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(duration) && duration > 0 ? duration : video.duration;
    if (!Number.isFinite(max) || max <= 0) return;
    const next = Math.min(Math.max(seconds, 0), max);
    video.currentTime = next;
    setCurrentTime(next);
  }, [duration]);

  const seekBy = useCallback((delta: number) => {
    seekTo(currentTime + delta);
  }, [currentTime, seekTo]);

  const seekToRatio = useCallback((ratio: number) => {
    const video = videoRef.current;
    const max = Number.isFinite(duration) && duration > 0 ? duration : video?.duration ?? 0;
    if (!Number.isFinite(max) || max <= 0) return;
    seekTo(ratio * max);
  }, [duration, seekTo]);

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    seekToRatio(ratio);
  };

  const handleSeekPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const bar = event.currentTarget;
    const seekAt = (clientX: number) => {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      seekToRatio(ratio);
    };
    seekAt(event.clientX);
    const onMove = (e: PointerEvent) => seekAt(e.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleVideoDoubleTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < rect.width * 0.35) seekBy(-SEEK_STEP_SECONDS);
    else if (x > rect.width * 0.65) seekBy(SEEK_STEP_SECONDS);
    else togglePlay();
  };

  const mediaUrls = post?.media_urls || [];
  const showCarousel = post?.media_type === "image" && mediaUrls.length > 1;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            aria-label="Back"
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          {post?.owner && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 shrink-0 bg-zinc-700">
                {post.owner.avatar_url ? (
                  <img src={post.owner.avatar_url} alt={post.owner.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                    {post.owner.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-white font-semibold text-sm truncate">{post.owner.username}</span>
            </div>
          )}
        </div>

        {post && (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="Post options"
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                    className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                  >
                    {post.is_owner ? (
                      <>
                        <button
                          onClick={() => { setIsMenuOpen(false); navigate(`${base}/post/${post.public_id}/edit`); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
                        >
                          <Pencil className="w-4 h-4 text-zinc-500" />
                          <span className="font-semibold text-sm">Edit</span>
                        </button>
                        <div className="h-px bg-zinc-100" />
                        <button
                          onClick={() => { setIsMenuOpen(false); setIsDeleteConfirmOpen(true); }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-rose-600 hover:bg-rose-50 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="font-semibold text-sm">Delete</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          // Consumers use /report/:id (outside CreatorLayout); creators keep nested path.
                          if (username) navigate(`/${username}/post/${post.public_id}/report`);
                          else navigate(`/report/${post.public_id}`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <Flag className="w-4 h-4" />
                        <span className="font-semibold text-sm">Report</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Media area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {isLoading ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : error ? (
          <div className="text-center px-8">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Couldn't load this post</p>
            <p className="text-white/60 text-sm mb-6">{error}</p>
            <button
              onClick={goBack}
              className="px-6 py-2.5 bg-white text-zinc-900 rounded-full text-sm font-bold"
            >
              Go back
            </button>
          </div>
        ) : post && !post.has_access ? (
          /* Locked paid post: server refused media, ask to pay */
          <div className="text-center px-8 max-w-sm">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
              <LockKeyhole className="w-8 h-8 text-zinc-900" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Exclusive Content</h2>
            <p className="text-white/70 text-sm mb-6">
              Pay once to unlock this post forever. One-time payment, unlimited access.
            </p>
            {payError && (
              <div className="flex items-start gap-2 bg-rose-500/15 border border-rose-500/40 rounded-xl px-4 py-3 mb-4 text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-rose-300 text-xs">{payError}</p>
              </div>
            )}
            <button
              onClick={handleUnlock}
              disabled={isPaying}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-full font-bold transition-colors shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                </>
              ) : (
                <>Unlock for ₹{post.price}</>
              )}
            </button>
          </div>
        ) : post && post.media_type === "image" ? (
          <>
            <SecureImage
              src={mediaUrls[slide]}
              alt={post.caption || "Post"}
              watermark={watermark}
              className="max-w-full max-h-full object-contain"
            />
            {showCarousel && (
              <>
                {slide > 0 && (
                  <button
                    onClick={() => setSlide((s) => s - 1)}
                    aria-label="Previous"
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-zinc-900 rounded-full shadow-lg transition-colors z-20"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {slide < mediaUrls.length - 1 && (
                  <button
                    onClick={() => setSlide((s) => s + 1)}
                    aria-label="Next"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-zinc-900 rounded-full shadow-lg transition-colors z-20"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                <div className="absolute top-16 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-bold z-20">
                  {slide + 1}/{mediaUrls.length}
                </div>
                <div className="absolute bottom-28 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {mediaUrls.map((_, index) => (
                    <span
                      key={index}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${index === slide ? "bg-white" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : post && post.media_type === "video" ? (
          <div
            className="relative w-full h-full flex items-center justify-center"
            onClick={togglePlay}
            onDoubleClick={handleVideoDoubleTap}
          >
            <SecureVideo
              ref={videoRef}
              src={mediaUrls[0]}
              watermark={watermark}
              className="max-w-full max-h-full object-contain"
              playsInline
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Center play/pause */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  aria-label="Play"
                  className="absolute p-5 bg-white/90 rounded-full shadow-2xl z-20"
                >
                  <Play className="w-8 h-8 text-zinc-900 fill-zinc-900" />
                </motion.button>
              )}
            </AnimatePresence>
            {/* Video controls: seek + time */}
            <div
              className="absolute bottom-24 left-4 right-4 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="h-6 flex items-center cursor-pointer group touch-none"
                onClick={handleSeek}
                onPointerDown={handleSeekPointer}
                role="slider"
                aria-label="Video progress"
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={currentTime}
              >
                <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden group-hover:h-2 transition-all">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => seekBy(-SEEK_STEP_SECONDS)}
                    aria-label={`Rewind ${SEEK_STEP_SECONDS} seconds`}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <SkipBack className="w-5 h-5 fill-white" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekBy(SEEK_STEP_SECONDS)}
                    aria-label={`Forward ${SEEK_STEP_SECONDS} seconds`}
                    className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <SkipForward className="w-5 h-5 fill-white" />
                  </button>
                </div>
                <span className="text-white/90 text-xs font-medium tabular-nums shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom bar: likes + caption */}
      {post && post.has_access && (
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pt-10 pb-5 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleLike}
              aria-label={post.liked_by_me ? "Unlike" : "Like"}
              className="p-1.5 -ml-1.5 active:scale-90 transition-transform"
            >
              <Heart
                className={`w-7 h-7 transition-colors ${post.liked_by_me ? "text-rose-500 fill-rose-500" : "text-white"}`}
              />
            </button>
            <span className="text-white font-semibold text-sm">
              {post.like_count} {post.like_count === 1 ? "like" : "likes"}
            </span>
            <span className="flex items-center gap-1 text-white/80 text-sm ml-2">
              <Eye className="w-4 h-4" />
              {post.view_count} {post.view_count === 1 ? "view" : "views"}
            </span>
            <span className={`ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full ${post.is_paid ? "bg-rose-500 text-white" : "bg-white/20 text-white"}`}>
              {post.is_paid ? `₹${post.price}` : "Free"}
            </span>
          </div>
          {post.caption && (
            <p className="text-white/90 text-sm leading-relaxed line-clamp-3">
              {post.owner && <span className="font-semibold text-white mr-1.5">{post.owner.username}</span>}
              {post.caption}
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 sm:p-8"
            >
              <button
                onClick={() => !isDeleting && setIsDeleteConfirmOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-500">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete this post?</h3>
              <p className="text-zinc-500 mb-6 text-sm">
                This will permanently remove the post and its media. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-md shadow-rose-500/20 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CaptureShield watermark={watermark} active={obscured && Boolean(post?.has_access)} />
    </div>
  );
}
