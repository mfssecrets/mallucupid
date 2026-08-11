import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ImagePlus, Video, AlertCircle, Loader2, CheckCircle2,
} from "lucide-react";
import {
  createExclusiveRoomPost,
  createExclusiveRoomUploadUrls,
  getCreatorVerification,
  uploadFileWithProgress,
} from "../lib/auth";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGES = 15;

export default function ExclusiveRoomCreatePostPage() {
  const { username, roomId } = useParams<{ username: string; roomId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mediaType = params.get("type") === "video" ? "video" : "photo";
  const roomPath = `/${username}/exclusive/${roomId}`;
  const base = `/${username}`;

  const [gateLoading, setGateLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const gate = await getCreatorVerification();
      if (!gate.verification?.badge_active) {
        navigate(`${base}/verification`, { replace: true });
        return;
      }
      setGateLoading(false);
    })();
  }, [base, navigate]);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    if (mediaType === "video") {
      const file = list[0];
      if (!file.type.startsWith("video/")) {
        setError("Select a video file");
        return;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        setError("Video must be under 500MB");
        return;
      }
      setFiles([file]);
      setPreviews([URL.createObjectURL(file)]);
      return;
    }
    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setError("Photos must be JPG or PNG");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError("Each photo must be under 50MB");
        return;
      }
      next.push(file);
      if (next.length >= MAX_IMAGES) break;
    }
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handlePost = async () => {
    if (!roomId || !files.length) {
      setError("Select media first");
      return;
    }
    setUploading(true);
    setError("");
    setPercent(0);
    try {
      const fileMeta = files.map((f) => ({
        content_type: f.type || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
        size: f.size,
      }));
      const urls = await createExclusiveRoomUploadUrls(roomId, mediaType === "photo" ? "image" : "video", fileMeta);
      if (urls.error || !urls.uploads || !urls.post_public_id) {
        throw new Error(urls.error || "Failed to prepare upload");
      }
      const total = files.reduce((s, f) => s + f.size, 0);
      const loaded = new Array(files.length).fill(0);
      for (let i = 0; i < files.length; i++) {
        await uploadFileWithProgress(
          urls.uploads[i].upload_url,
          files[i],
          fileMeta[i].content_type,
          (n) => {
            loaded[i] = n;
            setPercent(Math.min(99, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100)));
          },
        );
      }
      const created = await createExclusiveRoomPost({
        room_id: roomId,
        public_id: urls.post_public_id,
        caption: caption.trim(),
        media_type: mediaType === "photo" ? "image" : "video",
        media_paths: urls.uploads.map((u) => u.path),
      });
      if (created.error) throw new Error(created.error);
      setPercent(100);
      setDone(true);
      setTimeout(() => navigate(roomPath, { replace: true }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  if (gateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-20">
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center gap-3 mb-5">
          <button type="button" onClick={() => navigate(roomPath)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-zinc-900">
            Post {mediaType === "video" ? "video" : "photos"} to room
          </h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {done ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-zinc-900">Posted to exclusive room</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-zinc-200 p-5 space-y-4 shadow-sm">
            <p className="text-sm text-zinc-500">
              All room posts are included with the monthly entry fee — no separate unlock price.
            </p>

            {!files.length ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full aspect-[4/5] rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:border-rose-300"
              >
                {mediaType === "video" ? <Video className="w-10 h-10" /> : <ImagePlus className="w-10 h-10" />}
                <span className="font-semibold text-sm">Select from device</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="aspect-square rounded-xl overflow-hidden bg-zinc-900">
                    {mediaType === "video" ? (
                      <video src={src} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    )}
                    {i === 0 && (
                      <span className="sr-only">{files.length} file(s)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={mediaType === "video" ? "video/*" : "image/jpeg,image/jpg,image/png"}
              multiple={mediaType === "photo"}
              className="hidden"
              onChange={(e) => onSelect(e.target.files)}
            />

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Caption (optional)"
              rows={3}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />

            <button
              type="button"
              disabled={uploading || !files.length}
              onClick={handlePost}
              className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading {percent}%
                </>
              ) : (
                "Share to room"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
