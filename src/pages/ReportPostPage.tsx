import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Flag, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getPost, reportPost, REPORT_REASONS, type PostDetail } from "../lib/auth";

const MAX_DETAILS = 750;

export default function ReportPostPage() {
  const { username, postId } = useParams<{ username?: string; postId: string }>();
  const navigate = useNavigate();
  const viewerPath = username ? `/${username}/post/${postId}` : `/view/${postId}`;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const response = await getPost(postId);
      if (cancelled) return;
      if (response.error && /unauthorized|login/i.test(response.error)) {
        const login = username ? "/login" : "/userlogin";
        const redirect = username ? `${username}/post/${postId}/report` : `report/${postId}`;
        navigate(`${login}?redirect=${encodeURIComponent(redirect)}`, { replace: true });
        return;
      }
      if (response.post) {
        if (response.post.is_owner) {
          // Owners can't report their own posts
          navigate(viewerPath, { replace: true });
          return;
        }
        setPost(response.post);
      } else {
        setError(response.error || "Failed to load post");
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, navigate, viewerPath, username]);

  const handleSubmit = async () => {
    if (!post || isSubmitting) return;
    setSubmitError("");

    if (!reason) {
      setSubmitError("Please select a reason");
      return;
    }
    if (details.length > MAX_DETAILS) {
      setSubmitError(`Additional details must be ${MAX_DETAILS} characters or fewer`);
      return;
    }

    setIsSubmitting(true);
    const response = await reportPost(post.public_id, reason, details.trim());
    if (response.error && /unauthorized|login/i.test(response.error)) {
      const login = username ? "/login" : "/userlogin";
      const redirect = username ? `${username}/post/${postId}/report` : `report/${postId}`;
      navigate(`${login}?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      setIsSubmitting(false);
      return;
    }
    if (response.status === "report_submitted") {
      setIsSubmitted(true);
    } else {
      setSubmitError(response.error || "Failed to submit report");
    }
    setIsSubmitting(false);
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
          <h1 className="text-xl font-bold text-zinc-900">Report post</h1>
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
              onClick={() => navigate(username ? `/${username}` : "/")}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-bold transition-colors"
            >
              Go to profile
            </button>
          </div>
        ) : isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-zinc-200 p-8 text-center shadow-sm"
          >
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Report submitted</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Thank you for helping keep MalluCupid safe. Our team will review this post.
            </p>
            <button
              onClick={() => navigate(username ? `/${username}` : viewerPath)}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-bold transition-colors"
            >
              Done
            </button>
          </motion.div>
        ) : post ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  Reporting {post.owner?.username ? `@${post.owner.username}` : "this post"}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {post.caption || "No caption"}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">Select a reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 appearance-none"
              >
                <option value="" disabled>Choose a reason…</option>
                {REPORT_REASONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">Additional details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
                rows={5}
                placeholder="Tell us more about the issue (optional)…"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 resize-none"
              />
              <p className="text-right text-xs text-zinc-400 mt-1">{details.length}/{MAX_DETAILS}</p>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-rose-600 text-xs font-medium">{submitError}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors shadow-md shadow-rose-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              Submit report
            </button>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
