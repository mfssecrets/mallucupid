import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  LogOut, LayoutDashboard, Bell, ShieldCheck, Wallet, Inbox, ArrowLeft,
  AlertCircle, Check, Loader2, Upload, FileImage, BadgeCheck,
} from "lucide-react";
import {
  getCreatorVerification,
  requestVerificationUploadUrls,
  submitCreatorVerification,
  uploadFileWithProgress,
  type CreatorVerificationStatus,
} from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { VerifiedBadge } from "../components/VerifiedBadge";

const ID_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_ID_SIZE = 10 * 1024 * 1024;

function yearsFromDob(dob: string): number {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function IdUploadField({
  label,
  file,
  progress,
  previewUrl,
  disabled,
  onPick,
}: {
  label: string;
  file: File | null;
  progress: number | null;
  previewUrl: string;
  disabled: boolean;
  onPick: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 w-full rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors p-4 text-left disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileImage className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {file ? file.name : "Choose image (JPG, PNG, WebP)"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Max 10MB · government-issued ID</p>
            {progress != null && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                  <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">{progress}% uploaded</p>
              </div>
            )}
          </div>
          <Upload className="w-4 h-4 text-zinc-400 shrink-0" />
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
    </div>
  );
}

export default function VerificationPage() {
  const { username } = useParams<{ username: string }>();
  const base = `/${username}`;
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<CreatorVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [frontProgress, setFrontProgress] = useState<number | null>(null);
  const [backProgress, setBackProgress] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getCreatorVerification();
      if (res.verification) setStatus(res.verification);
      if (res.error) setError(res.error);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [frontPreview, backPreview]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const pickFront = (f: File | null) => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontFile(f);
    setFrontPreview(f ? URL.createObjectURL(f) : "");
    setFrontProgress(null);
  };

  const pickBack = (f: File | null) => {
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(f);
    setBackPreview(f ? URL.createObjectURL(f) : "");
    setBackProgress(null);
  };

  const isVerified = status?.badge_active === true;
  const isSuspended = status?.status === "suspended" || status?.status === "rejected";
  const isPending = status?.status === "pending" || status?.needs_admin_approval === true;
  const canSubmit = !isVerified && !isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const name = legalName.trim();
    if (name.length < 2) {
      setError("Enter your full legal name as on your government ID.");
      return;
    }
    if (!dob) {
      setError("Date of birth is required.");
      return;
    }
    const age = yearsFromDob(dob);
    if (age < 18) {
      setError("You must be at least 18 years old to get a verification badge.");
      return;
    }
    if (!frontFile || !backFile) {
      setError("Upload both the front and back of your government ID.");
      return;
    }
    for (const file of [frontFile, backFile]) {
      if (!ID_TYPES.includes(file.type)) {
        setError("ID images must be JPG, PNG, or WebP.");
        return;
      }
      if (file.size <= 0 || file.size > MAX_ID_SIZE) {
        setError("Each ID image must be 10MB or smaller.");
        return;
      }
    }
    if (!terms) {
      setError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    setSubmitting(true);
    setFrontProgress(0);
    setBackProgress(0);

    try {
      const urls = await requestVerificationUploadUrls([
        { side: "front", content_type: frontFile.type, size: frontFile.size },
        { side: "back", content_type: backFile.type, size: backFile.size },
      ]);
      if (urls.error || !urls.uploads?.length) {
        setError(urls.error || "Failed to prepare ID upload.");
        setSubmitting(false);
        return;
      }

      const frontUp = urls.uploads.find((u) => u.side === "front");
      const backUp = urls.uploads.find((u) => u.side === "back");
      if (!frontUp || !backUp) {
        setError("Failed to prepare ID upload.");
        setSubmitting(false);
        return;
      }

      await uploadFileWithProgress(frontUp.upload_url, frontFile, frontFile.type, (loaded) => {
        setFrontProgress(Math.min(100, Math.round((loaded / frontFile.size) * 100)));
      });
      setFrontProgress(100);

      await uploadFileWithProgress(backUp.upload_url, backFile, backFile.type, (loaded) => {
        setBackProgress(Math.min(100, Math.round((loaded / backFile.size) * 100)));
      });
      setBackProgress(100);

      const submitted = await submitCreatorVerification({
        legal_full_name: name,
        date_of_birth: dob,
        id_front_path: frontUp.path,
        id_back_path: backUp.path,
        terms_accepted: true,
      });

      if (submitted.error) {
        setError(submitted.error);
        setSubmitting(false);
        return;
      }

      if (submitted.verification) {
        setStatus(submitted.verification);
        setSuccess(true);
        setFrontFile(null);
        setBackFile(null);
        setFrontProgress(null);
        setBackProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const successPending = status?.status === "pending";

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-20 md:pt-0 md:pb-0 md:pl-20">
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-zinc-200 flex-col items-center py-6 z-40">
        <Link to={base} className="p-3 text-zinc-500 hover:bg-zinc-50 rounded-xl"><LayoutDashboard className="w-6 h-6" /></Link>
        <Link to={`${base}/inbox`} className="p-3 text-zinc-500 hover:bg-zinc-50 rounded-xl mt-2"><Inbox className="w-6 h-6" /></Link>
        <Link to={`${base}/notifications`} className="p-3 text-zinc-500 hover:bg-zinc-50 rounded-xl mt-2"><Bell className="w-6 h-6" /></Link>
        <Link to={`${base}/wallet`} className="p-3 text-zinc-500 hover:bg-zinc-50 rounded-xl mt-2"><Wallet className="w-6 h-6" /></Link>
        <Link to={`${base}/verification`} className="p-3 bg-zinc-100 text-zinc-900 rounded-xl mt-2"><ShieldCheck className="w-6 h-6" /></Link>
        <button onClick={handleSignOut} className="mt-auto p-3 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl"><LogOut className="w-6 h-6" /></button>
      </div>

      <main className="container mx-auto px-4 max-w-xl py-6 md:py-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(base)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 md:hidden" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-900">Verification</h1>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-rose-500" /></div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border p-5 mb-4 ${
                isVerified
                  ? "bg-sky-50 border-sky-100"
                  : isPending
                    ? "bg-violet-50 border-violet-100"
                    : isSuspended
                      ? "bg-amber-50 border-amber-100"
                      : "bg-white border-zinc-100 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isVerified ? "bg-sky-500 text-white" : isPending ? "bg-violet-500 text-white" : isSuspended ? "bg-amber-500 text-white" : "bg-rose-50 text-rose-600"
                }`}>
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-zinc-900">
                      {isVerified
                        ? "Verified creator"
                        : isPending
                          ? "Badge request on preview"
                          : isSuspended
                            ? "Badge suspended"
                            : "Get your verification badge"}
                    </h2>
                    <VerifiedBadge verified={isVerified} size="sm" />
                  </div>
                  <p className="text-sm text-zinc-600 mt-1 leading-6">
                    {isVerified
                      ? `Your profile shows a verified badge. ID: ${status?.public_id || "—"}`
                      : isPending
                        ? "Your badge request is on preview. Please wait for admin approval. Your posts and Exclusive Rooms stay locked for fans until an admin verifies you."
                        : isSuspended
                          ? `An admin suspended your badge. You can re-submit your ID. Auto-verify remaining after suspension: ${status?.auto_reverifies_remaining ?? 0} of 3. The 4th resubmit needs admin approval. Posts and Exclusive Rooms are locked for fans until you are verified again.`
                          : "Verification is required before you can publish posts or create Exclusive Rooms. Submit once to get your badge immediately. Upload a government-approved ID (front and back)."}
                  </p>
                </div>
              </div>
            </motion.div>

            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 mb-4 text-center"
              >
                <p className="font-semibold text-zinc-900">Waiting for admin approval</p>
                <p className="text-sm text-zinc-500 mt-2 leading-6">
                  You used all 3 automatic re-verifications after suspension. An admin must manually approve this request before your badge returns.
                </p>
              </motion.div>
            )}

            {canSubmit && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6"
              >
                <h2 className="font-bold text-zinc-900 mb-1">Identity verification</h2>
                <p className="text-sm text-zinc-500 mb-5">
                  Use your name exactly as printed on a government-approved document. You must be 18 or older.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">
                      <Check className="w-4 h-4 shrink-0" />{" "}
                      {successPending
                        ? "Submitted. Your badge request is on preview — wait for admin approval."
                        : "Verification submitted. Your badge is now active."}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-zinc-700">Full name (as per govt approved document)</label>
                    <input
                      required
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      disabled={submitting}
                      placeholder="Legal name on ID"
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-700">Date of birth</label>
                    <input
                      required
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      disabled={submitting}
                      max={new Date().toISOString().slice(0, 10)}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Must be at least 18 years old.</p>
                  </div>

                  <IdUploadField
                    label="ID front"
                    file={frontFile}
                    progress={frontProgress}
                    previewUrl={frontPreview}
                    disabled={submitting}
                    onPick={pickFront}
                  />
                  <IdUploadField
                    label="ID back"
                    file={backFile}
                    progress={backProgress}
                    previewUrl={backPreview}
                    disabled={submitting}
                    onPick={pickBack}
                  />

                  <label className="flex items-start gap-3 text-sm text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      disabled={submitting}
                      className="mt-1 rounded border-zinc-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span>
                      I confirm the documents are mine and I accept the{" "}
                      <Link to="/terms-and-conditions" className="text-rose-600 hover:underline" target="_blank">Terms of Service</Link>
                      {" "}and{" "}
                      <Link to="/privacy-policy" className="text-rose-600 hover:underline" target="_blank">Privacy Policy</Link>.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit for verification"}
                  </button>
                </form>
              </motion.div>
            )}

            <p className="text-center text-xs text-zinc-500 mt-6">
              Payout bank details live on your{" "}
              <Link to={`${base}/wallet`} className="text-rose-600 hover:underline">Wallet</Link> page.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
