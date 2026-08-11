import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, AlertCircle, IndianRupee, Layers, Play } from "lucide-react";
import { getPost, updatePost, type PostDetail } from "../lib/auth";

export default function EditPostPage() {
  const { username, postId } = useParams<{ username: string; postId: string }>();
  const navigate = useNavigate();
  const viewerPath = `/${username}/post/${postId}`;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [caption, setCaption] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const response = await getPost(postId);
      if (cancelled) return;
      if (response.post) {
        if (!response.post.is_owner) {
          navigate(viewerPath, { replace: true });
          return;
        }
        setPost(response.post);
        setCaption(response.post.caption || "");
        setIsPaid(response.post.is_paid);
        setPrice(response.post.is_paid ? String(response.post.price) : "");
      } else {
        setError(response.error || "Failed to load post");
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, navigate, viewerPath]);

  const handleSave = async () => {
    if (!post || isSaving) return;
    setSaveError("");

    if (caption.length > 200) {
      setSaveError("Caption must be 200 characters or fewer");
      return;
    }
    const priceValue = Number(price);
    if (isPaid && (!Number.isFinite(priceValue) || priceValue < 10)) {
      setSaveError("Minimum amount is ₹10 for paid posts");
      return;
    }

    setIsSaving(true);
    // Saves against the existing post id; the backend never creates a new one
    const response = await updatePost({
      public_id: post.public_id,
      caption: caption.trim(),
      is_paid: isPaid,
      price: isPaid ? priceValue : 0,
    });
    if (response.status === "post_updated") {
      navigate(viewerPath, { replace: true });
    } else {
      setSaveError(response.error || "Failed to save changes");
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-20 md:pt-8 md:pb-8">
      <main className="container mx-auto px-4 max-w-lg py-4 md:py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(viewerPath)}
            aria-label="Back"
            className="p-2 -ml-2 text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">Edit post</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center shadow-sm">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-zinc-700 font-medium mb-4">{error}</p>
            <button
              onClick={() => navigate(`/${username}`)}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-bold transition-colors"
            >
              Go to profile
            </button>
          </div>
        ) : post ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden"
          >
            {/* Media preview (read-only) */}
            <div className="relative aspect-[4/5] max-h-80 w-full bg-black flex items-center justify-center">
              {post.media_type === "video" ? (
                <>
                  <video src={post.media_urls[0]} className="w-full h-full object-contain" playsInline muted />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white">
                      <Play className="w-6 h-6 fill-white" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <img src={post.media_urls[0]} alt="Post" className="w-full h-full object-contain" />
                  {post.media_count > 1 && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-full text-white flex items-center gap-1 text-[10px] font-bold">
                      <Layers className="w-3.5 h-3.5" /> {post.media_count}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Caption */}
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="Write a caption…"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 resize-none"
                />
                <p className="text-right text-xs text-zinc-400 mt-1">{caption.length}/200</p>
              </div>

              {/* Post type */}
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">Post type</label>
                <select
                  value={isPaid ? "paid" : "free"}
                  onChange={(e) => setIsPaid(e.target.value === "paid")}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 appearance-none"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Amount */}
              {isPaid && (
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-1.5">Amount (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="number"
                      min={10}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Minimum ₹10"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Minimum amount is ₹10</p>
                </div>
              )}

              {saveError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-rose-600 text-xs font-medium">{saveError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => navigate(viewerPath)}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-md shadow-rose-500/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
