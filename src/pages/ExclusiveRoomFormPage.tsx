import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Loader2, AlertCircle, ImagePlus } from "lucide-react";
import {
  createExclusiveRoom,
  getCreatorVerification,
  getExclusiveRooms,
  updateExclusiveRoom,
  uploadExclusiveThumbnail,
  type ExclusiveRoom,
} from "../lib/auth";

export default function ExclusiveRoomFormPage() {
  const { username, roomId } = useParams<{ username: string; roomId?: string }>();
  const navigate = useNavigate();
  const base = `/${username}`;
  const isEdit = Boolean(roomId && roomId !== "new");

  const [name, setName] = useState("");
  const [fee, setFee] = useState("99");
  const [thumbPreview, setThumbPreview] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<ExclusiveRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      // Editing existing rooms also requires an active badge (backend-enforced).
      const gate = await getCreatorVerification();
      if (!gate.verification?.badge_active) {
        navigate(`${base}/verification`, { replace: true });
        return;
      }
      if (!isEdit || !roomId) {
        setLoading(false);
        return;
      }
      const res = await getExclusiveRooms();
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      const room = (res.rooms || []).find((r) => r.id === roomId);
      if (!room) {
        setError("Room not found");
        return;
      }
      setExisting(room);
      setName(room.name);
      setFee(String(room.entry_fee));
      setThumbPreview(room.thumbnail_url || "");
    })();
  }, [base, isEdit, navigate, roomId]);

  const onPickThumb = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setError("Thumbnail must be JPG, PNG, or WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Thumbnail must be under 5MB");
      return;
    }
    setError("");
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 10) {
      setError("Room name must be 1–10 characters");
      return;
    }
    const feeNum = Number(fee);
    if (!Number.isFinite(feeNum) || feeNum < 10) {
      setError("Monthly entry fee must be at least ₹10");
      return;
    }
    if (!isEdit && !thumbFile) {
      setError("Add a thumbnail for this room");
      return;
    }

    setSaving(true);
    try {
      let room: ExclusiveRoom | undefined;
      if (isEdit && roomId) {
        const updated = await updateExclusiveRoom({
          room_id: roomId,
          name: trimmed,
          entry_fee: feeNum,
        });
        if (updated.error) throw new Error(updated.error);
        room = updated.room;
      } else {
        const created = await createExclusiveRoom({
          name: trimmed,
          entry_fee: feeNum,
        });
        if (created.error) throw new Error(created.error);
        room = created.room;
      }

      if (thumbFile && room?.id) {
        const up = await uploadExclusiveThumbnail(room.id, thumbFile);
        if (up.error) throw new Error(up.error);
        room = up.room || room;
      }

      navigate(`${base}/exclusive/${room?.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save room");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-20 md:py-10">
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(isEdit && roomId ? `${base}/exclusive/${roomId}` : base)}
            className="p-2 -ml-2 rounded-full hover:bg-zinc-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-rose-500" />
            {isEdit ? "Edit exclusive room" : "New exclusive room"}
          </h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-zinc-200 p-5 space-y-5 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center hover:border-rose-300"
            >
              {thumbPreview ? (
                <img src={thumbPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-8 h-8 text-zinc-400" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onPickThumb(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-zinc-500">Thumbnail (required for new rooms)</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Room name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 10))}
              maxLength={10}
              placeholder="Exclusive"
              className="mt-1.5 w-full h-12 rounded-xl border border-zinc-200 px-4 text-zinc-900 font-medium"
            />
            <p className="mt-1 text-xs text-zinc-400">{name.trim().length}/10</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Monthly entry fee (₹)</label>
            <input
              type="number"
              min={10}
              step="1"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="mt-1.5 w-full h-12 rounded-xl border border-zinc-200 px-4 text-zinc-900 font-medium"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Fans pay this once per month for full access to everything in this room.
              {existing ? ` Current: ₹${existing.entry_fee}/mo` : ""}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create room"}
          </button>
        </form>
      </div>
    </div>
  );
}
