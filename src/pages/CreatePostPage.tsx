import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import Cropper, { type Area } from "react-easy-crop";
import {
  ImagePlus,
  Plus,
  ArrowLeft,
  Video,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { createPost, createPostUploadUrls, getCreatorVerification, uploadFileWithProgress } from "../lib/auth";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGES = 15;
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350;

interface PhotoItem {
  file: File;
  previewUrl: string;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: Area | null;
}

type Step = "select" | "edit" | "details" | "uploading" | "success";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

async function cropTo1080x1350(item: PhotoItem): Promise<Blob> {
  const image = await loadImage(item.previewUrl);
  const area = item.croppedAreaPixels ?? (() => {
    // Default center crop at 4:5 when the user never moved the cropper
    const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
    let width = image.naturalWidth;
    let height = width / targetRatio;
    if (height > image.naturalHeight) {
      height = image.naturalHeight;
      width = height * targetRatio;
    }
    return {
      x: (image.naturalWidth - width) / 2,
      y: (image.naturalHeight - height) / 2,
      width,
      height,
    };
  })();

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to crop image"))),
      "image/jpeg",
      0.92,
    );
  });
}

export default function CreatePostPage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const profilePath = `/${username}`;
  const [searchParams] = useSearchParams();
  const mediaType = (searchParams.get("type") === "video" ? "video" : "photo") as "photo" | "video";

  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState("");
  const [gateLoading, setGateLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getCreatorVerification();
      if (!res.verification?.badge_active) {
        navigate(`${profilePath}/verification`, { replace: true });
        return;
      }
      setGateLoading(false);
    })();
  }, [navigate, profilePath]);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoPreviewUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [caption, setCaption] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");

  const [uploadPercent, setUploadPercent] = useState(0);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const validatePhotos = (files: File[], existingCount: number): string | null => {
    if (existingCount + files.length > MAX_IMAGES) return `Maximum ${MAX_IMAGES} photos per post.`;
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) return "Only JPG, JPEG, or PNG photos are allowed.";
      if (file.size > MAX_IMAGE_SIZE) return "Each photo must be 50MB or smaller.";
    }
    return null;
  };

  const addPhotos = (files: File[]) => {
    const validationError = validatePhotos(files, photos.length);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    const items: PhotoItem[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
    }));
    setPhotos((prev) => [...prev, ...items]);
    setStep("edit");
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    addPhotos(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Only video files are allowed.");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setError("Video must be 500MB or smaller.");
      return;
    }
    setError("");
    setVideoFile(file);
    setStep("edit");
  };

  const removeCurrentPhoto = () => {
    const next = photos.filter((_, i) => i !== currentIndex);
    setPhotos(next);
    if (!next.length) {
      setStep("select");
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex(Math.min(currentIndex, next.length - 1));
  };

  const updateCurrentPhoto = (patch: Partial<PhotoItem>) => {
    setPhotos((prev) => prev.map((item, i) => (i === currentIndex ? { ...item, ...patch } : item)));
  };

  const validateDetails = (): string | null => {
    if (caption.length > 200) return "Caption must be 200 characters or fewer.";
    if (isPaid) {
      const amount = Number(price);
      if (!price || !Number.isFinite(amount)) return "Enter a valid price in INR.";
      if (amount < 10) return "Minimum amount is ₹10.";
    }
    return null;
  };

  const handlePost = async () => {
    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep("uploading");
    setUploadPercent(0);

    try {
      let blobs: { blob: Blob; contentType: string }[];
      if (mediaType === "photo") {
        blobs = await Promise.all(
          photos.map(async (item) => ({ blob: await cropTo1080x1350(item), contentType: "image/jpeg" })),
        );
      } else {
        if (!videoFile) throw new Error("No video selected");
        blobs = [{ blob: videoFile, contentType: videoFile.type }];
      }

      const urlResponse = await createPostUploadUrls(
        mediaType === "photo" ? "image" : "video",
        blobs.map(({ blob, contentType }) => ({ content_type: contentType, size: blob.size })),
      );
      if (urlResponse.error || !urlResponse.uploads || !urlResponse.post_public_id) {
        throw new Error(urlResponse.error || "Failed to prepare upload");
      }

      const totalBytes = blobs.reduce((sum, { blob }) => sum + blob.size, 0);
      const loadedBytes = new Array(blobs.length).fill(0);
      const reportProgress = () => {
        const loaded = loadedBytes.reduce((a, b) => a + b, 0);
        setUploadPercent(Math.min(99, Math.round((loaded / totalBytes) * 100)));
      };

      for (let i = 0; i < blobs.length; i++) {
        await uploadFileWithProgress(
          urlResponse.uploads[i].upload_url,
          blobs[i].blob,
          blobs[i].contentType,
          (loaded) => {
            loadedBytes[i] = loaded;
            reportProgress();
          },
        );
      }

      const postResponse = await createPost({
        public_id: urlResponse.post_public_id,
        caption: caption.trim(),
        media_type: mediaType === "photo" ? "image" : "video",
        media_paths: urlResponse.uploads.map((u) => u.path),
        is_paid: isPaid,
        price: isPaid ? Number(price) : 0,
      });
      if (postResponse.error) throw new Error(postResponse.error);

      setUploadPercent(100);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload post");
      setStep("details");
    }
  };

  const currentPhoto = photos[currentIndex];

  if (gateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:items-center md:justify-center md:p-4 pt-14 pb-14 md:pt-4 md:pb-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[560px] bg-white md:rounded-3xl shadow-none md:shadow-xl md:shadow-rose-100/50 border-x-0 border-y-0 md:border border-zinc-100 overflow-hidden flex flex-col flex-grow md:flex-grow-0 md:min-h-[560px]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100 shrink-0 bg-white z-10">
          {step === "select" && (
            <button onClick={() => navigate(profilePath)} className="text-zinc-600 hover:text-zinc-900 text-sm font-semibold flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Cancel
            </button>
          )}
          {step === "edit" && (
            <button onClick={() => { setStep("select"); setPhotos([]); setVideoFile(null); }} className="text-zinc-600 hover:text-zinc-900 text-sm font-semibold flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step === "details" && (
            <button onClick={() => setStep("edit")} className="text-zinc-600 hover:text-zinc-900 text-sm font-semibold flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {(step === "uploading" || step === "success") && <div className="w-16" />}

          <h3 className="text-base sm:text-lg font-bold text-zinc-900">
            {step === "success" ? "Post shared" : `New ${mediaType === "video" ? "video" : "photo"} post`}
          </h3>

          {step === "edit" ? (
            <button onClick={() => setStep("details")} className="text-rose-500 hover:text-rose-600 text-sm font-bold">
              Next
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && step !== "uploading" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 text-red-600 px-5 py-3 flex items-center gap-2 text-sm font-medium overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* STEP: SELECT */}
          {step === "select" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50/50">
              <div className="w-24 h-24 rounded-3xl bg-rose-50 flex items-center justify-center mb-6 text-rose-400">
                {mediaType === "video" ? <Video className="w-12 h-12 stroke-[1.5]" /> : <ImagePlus className="w-12 h-12 stroke-[1.5]" />}
              </div>
              <h2 className="text-xl sm:text-2xl text-zinc-900 font-bold mb-2">
                Select your {mediaType === "video" ? "video" : "photos"}
              </h2>
              <p className="text-zinc-500 mb-8 text-sm max-w-xs">
                {mediaType === "video"
                  ? "One video per post. Maximum 500MB. Reels-style 9:16 preview."
                  : `Up to ${MAX_IMAGES} photos, 50MB each. JPG, JPEG, or PNG. Cropped to 4:5.`}
              </p>
              <label className="cursor-pointer px-8 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 text-sm">
                Select from device
                <input
                  type="file"
                  accept={mediaType === "video" ? "video/*" : "image/jpeg,image/jpg,image/png"}
                  multiple={mediaType === "photo"}
                  className="hidden"
                  onChange={mediaType === "video" ? handleVideoSelect : handlePhotoSelect}
                />
              </label>
            </div>
          )}

          {/* STEP: EDIT (photo crop carousel) */}
          {step === "edit" && mediaType === "photo" && currentPhoto && (
            <div className="flex-1 flex flex-col">
              <div className="relative w-full bg-zinc-900" style={{ aspectRatio: "4 / 5" }}>
                <Cropper
                  image={currentPhoto.previewUrl}
                  crop={currentPhoto.crop}
                  zoom={currentPhoto.zoom}
                  aspect={4 / 5}
                  showGrid
                  onCropChange={(crop) => updateCurrentPhoto({ crop })}
                  onZoomChange={(zoom) => updateCurrentPhoto({ zoom })}
                  onCropComplete={(_, croppedAreaPixels) => updateCurrentPhoto({ croppedAreaPixels })}
                />

                {/* Left / right swipe arrows */}
                {photos.length > 1 && currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <ChevronLeft className="w-5 h-5 text-zinc-900" />
                  </button>
                )}
                {photos.length > 1 && currentIndex < photos.length - 1 && (
                  <button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <ChevronRight className="w-5 h-5 text-zinc-900" />
                  </button>
                )}

                {/* Delete current photo */}
                <button
                  onClick={removeCurrentPhoto}
                  className="absolute top-3 right-3 w-9 h-9 bg-white/90 hover:bg-white text-rose-500 rounded-full flex items-center justify-center shadow-lg z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Counter + add more */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                  <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-xs font-bold text-zinc-900">
                    {currentIndex + 1} / {photos.length}
                  </div>
                  {photos.length < MAX_IMAGES && (
                    <button
                      onClick={() => addMoreInputRef.current?.click()}
                      className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 shadow-lg transition-transform hover:scale-105"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>
              </div>

              {/* Zoom slider */}
              <div className="px-6 py-4 bg-white border-t border-zinc-100 flex items-center gap-4">
                <span className="text-xs font-bold text-zinc-500 shrink-0">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={currentPhoto.zoom}
                  onChange={(e) => updateCurrentPhoto({ zoom: Number(e.target.value) })}
                  className="w-full accent-rose-500"
                />
              </div>

              {/* Thumbnails */}
              {photos.length > 1 && (
                <div className="px-4 py-3 bg-white flex gap-2 overflow-x-auto">
                  {photos.map((item, i) => (
                    <button
                      key={item.previewUrl}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-12 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${i === currentIndex ? "border-rose-500" : "border-transparent opacity-60"}`}
                    >
                      <img src={item.previewUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP: EDIT (video reels preview) */}
          {step === "edit" && mediaType === "video" && videoFile && (
            <div className="flex-1 flex flex-col items-center bg-white p-6">
              <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg w-full max-w-[280px]" style={{ aspectRatio: "9 / 16" }}>
                <video src={videoPreviewUrl} className="w-full h-full object-contain" controls playsInline />
              </div>
              <p className="text-xs text-zinc-500 mt-4 text-center">
                Reels format (9:16). Other sizes show black background around the video.
              </p>
              <button
                onClick={() => { setVideoFile(null); setStep("select"); }}
                className="mt-4 text-sm font-bold text-rose-500 hover:text-rose-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Remove video
              </button>
            </div>
          )}

          {/* STEP: DETAILS */}
          {step === "details" && (
            <div className="flex-1 flex flex-col bg-white">
              {/* Media summary strip */}
              <div className="p-4 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/60">
                {mediaType === "photo" ? (
                  <>
                    <div className="w-12 h-14 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                      <img src={photos[0]?.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700">{photos.length} photo{photos.length > 1 ? "s" : ""} · 4:5</span>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-14 rounded-lg overflow-hidden border border-zinc-200 bg-black shrink-0">
                      <video src={videoPreviewUrl} className="w-full h-full object-contain" muted />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700">1 video · Reels 9:16</span>
                  </>
                )}
              </div>

              <div className="p-5 space-y-6 flex-1">
                {/* Caption */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-zinc-900">Caption</label>
                    <span className={`text-xs font-semibold ${caption.length > 200 ? "text-red-500" : "text-zinc-400"}`}>
                      {caption.length} / 200
                    </span>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={200}
                    placeholder="Write a caption..."
                    className="w-full h-28 resize-none border border-zinc-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 p-4 text-sm text-zinc-900 bg-zinc-50 focus:bg-white placeholder-zinc-400 transition-colors focus:outline-none"
                  />
                </div>

                {/* Post type */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900">Post Type</span>
                  <select
                    value={isPaid ? "paid" : "free"}
                    onChange={(e) => {
                      setIsPaid(e.target.value === "paid");
                      if (e.target.value === "free") setPrice("");
                    }}
                    className="text-sm border border-zinc-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer font-semibold px-4 py-2.5 text-zinc-900 bg-zinc-50 focus:bg-white shadow-sm outline-none"
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                {/* Price */}
                <AnimatePresence>
                  {isPaid && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-sm font-bold text-zinc-900 block">Price (INR)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold">₹</span>
                        <input
                          type="number"
                          min={10}
                          step="1"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full pl-9 pr-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white shadow-sm outline-none"
                          placeholder="10 minimum"
                        />
                      </div>
                      <p className="text-xs text-zinc-500">Minimum amount is ₹10. Fans will unlock this post to view it.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-5 border-t border-zinc-100">
                <button
                  onClick={handlePost}
                  className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-rose-500/20 text-sm"
                >
                  Post {mediaType === "video" ? "Video" : `Photo${photos.length > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* STEP: UPLOADING */}
          {step === "uploading" && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white">
              <div className="relative w-28 h-28 mb-8">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="50" fill="none" stroke="#ffe4e6" strokeWidth="8" />
                  <motion.circle
                    cx="56" cy="56" r="50" fill="none" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - uploadPercent / 100) }}
                    transition={{ ease: "easeOut", duration: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-zinc-900">{uploadPercent}%</span>
                </div>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Uploading your post</h2>
              <p className="text-zinc-500 text-sm">Please keep this page open…</p>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === "success" && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white text-center">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center mb-6 relative"
              >
                <CheckCircle2 className="w-12 h-12 text-rose-500" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.6, 2] }}
                  transition={{ duration: 1.2, delay: 0.2 }}
                  className="absolute inset-0 rounded-full border-4 border-rose-300"
                />
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 0], y: -22 }}
                  transition={{ duration: 1.4, delay: 0.4 }}
                  className="absolute -top-2 -right-2 text-rose-400"
                >
                  <Sparkles className="w-7 h-7" />
                </motion.div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-display font-bold text-zinc-900 mb-2"
              >
                Successfully uploaded your post!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-zinc-500 text-sm mb-8"
              >
                Your {mediaType === "video" ? "video" : "photos"} {isPaid ? `will be locked until fans pay ₹${price}` : `${mediaType === "video" ? "is" : "are"} now live on your profile`}.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={() => navigate(profilePath, { replace: true })}
                className="px-8 h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 text-sm"
              >
                Go to profile
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
