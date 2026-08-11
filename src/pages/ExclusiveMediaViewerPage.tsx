import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getExclusiveRoomPost, type ExclusiveRoomPost } from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import {
  CaptureShield,
  SecureImage,
  SecureVideo,
  useCaptureDeterrent,
} from "../components/SecureMedia";

export default function ExclusiveMediaViewerPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const obscured = useCaptureDeterrent();
  const watermark = user?.user_metadata?.username || user?.user_metadata?.name || "MalluCupid";

  const [post, setPost] = useState<ExclusiveRoomPost | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      const res = await getExclusiveRoomPost(postId);
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPost(res.post || null);
    })();
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 px-6">
        <p>{error || "Post not found or access denied"}</p>
        <button type="button" onClick={() => navigate(-1)} className="text-rose-400 font-semibold">
          Go back
        </button>
      </div>
    );
  }

  const urls = post.media_urls?.length ? post.media_urls : post.media_url ? [post.media_url] : [];
  const current = urls[index] || "";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 p-4 safe-pt">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="font-semibold truncate">{post.room_name || "Exclusive"}</p>
          {post.caption ? <p className="text-xs text-zinc-400 truncate">{post.caption}</p> : null}
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        {post.media_type === "video" ? (
          <SecureVideo
            src={current}
            controls
            playsInline
            watermark={watermark}
            className="max-h-[80vh] max-w-full"
          />
        ) : (
          <SecureImage
            src={current}
            watermark={watermark}
            className="max-h-[80vh] max-w-full"
          />
        )}
        {urls.length > 1 && (
          <>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-3 p-2 rounded-full bg-black/50"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {index < urls.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-3 p-2 rounded-full bg-black/50"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>
      {urls.length > 1 && (
        <p className="text-center text-xs text-zinc-400 pb-6">{index + 1} / {urls.length}</p>
      )}
      <CaptureShield watermark={watermark} active={obscured} />
    </div>
  );
}
