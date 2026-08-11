import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ArrowRight, User, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProfile, updateProfile } from "../lib/auth";
import { useAuth } from "../lib/useAuth";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

export default function CreatorOnboardingPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [username, setUsername] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarType, setAvatarType] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (res?.error || !res?.profile) {
        navigate("/login", { replace: true });
        return;
      }
      setUsername(res.profile.username);
      if (res.profile.full_name) setName(res.profile.full_name);
      if (res.profile.bio) setBio(res.profile.bio);
      if (res.profile.avatar_url) setImagePreview(res.profile.avatar_url);
      setLoadingProfile(false);
    })();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be 5MB or smaller.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setAvatarBase64(result);
      setAvatarType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!bio.trim()) {
      setError("Bio is required.");
      return;
    }

    setIsSubmitting(true);
    const response = await updateProfile({
      full_name: name.trim(),
      bio: bio.trim(),
      ...(avatarBase64 && avatarType
        ? { avatar_base64: avatarBase64, avatar_content_type: avatarType }
        : {}),
    });
    setIsSubmitting(false);

    if (response?.error) {
      setError(response.error);
      return;
    }
    await refreshSession();
    navigate(username ? `/${username}` : "/dashboard", { replace: true });
  };

  if (loadingProfile) {
    return (
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-8 sm:p-10 my-8"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-bold text-zinc-900 mb-2">Complete Profile</h1>
        <p className="text-zinc-500">Set up your creator page to start earning</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium overflow-hidden"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-rose-300 transition-colors"
            onClick={!isSubmitting ? triggerFileInput : undefined}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-white" />
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <Camera className="w-8 h-8 text-zinc-400 mx-auto mb-2 group-hover:text-rose-400 transition-colors" />
                <span className="text-xs font-medium text-zinc-500">Upload Photo</span>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          {imagePreview && (
            <button
              type="button"
              onClick={triggerFileInput}
              className="text-sm font-medium text-rose-500 hover:text-rose-600"
            >
              Change Image
            </button>
          )}
        </div>

        {/* Username (Read Only, auto-fetched) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Username</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              readOnly
              value={username}
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-500 cursor-not-allowed focus:outline-none"
            />
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Display Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all disabled:opacity-50"
            placeholder="E.g. Jane Doe"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-700">Bio</label>
            <span className={`text-xs font-medium ${bio.length > 400 ? "text-red-500" : "text-zinc-400"}`}>
              {bio.length}/400
            </span>
          </div>
          <textarea
            required
            maxLength={400}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isSubmitting}
            className="w-full p-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none h-32 disabled:opacity-50"
            placeholder="Tell your fans about yourself and what exclusive content they can expect..."
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
