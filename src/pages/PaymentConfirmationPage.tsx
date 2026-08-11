import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { getPostPaymentStatus, verifyPostPayment } from "../lib/auth";
import type { RazorpaySuccess } from "../lib/razorpay";

type ConfirmationState = { payment?: RazorpaySuccess };

export default function PaymentConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const postId = params.get("post") || "";
  const orderId = params.get("order") || "";
  const payment = (location.state as ConfirmationState | null)?.payment;
  const [state, setState] = useState<"checking" | "paid" | "processing">("checking");
  const [message, setMessage] = useState("Securely confirming your payment…");
  const running = useRef(false);

  const confirm = async () => {
    if (!postId || running.current) return;
    running.current = true;
    setState("checking");
    setMessage("Securely confirming your payment…");

    if (payment?.razorpay_payment_id && payment.razorpay_signature) {
      const verified = await verifyPostPayment({
        public_id: postId,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });
      if (verified.status === "paid") {
        setState("paid");
        setMessage("Payment confirmed. Your post is permanently unlocked.");
        running.current = false;
        return;
      }
    }

    // Reconcile with Razorpay server-side. This also recovers when the browser
    // callback was interrupted after the debit.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await getPostPaymentStatus(postId, orderId);
      if (status.has_access || status.status === "paid") {
        setState("paid");
        setMessage("Payment confirmed. Your post is permanently unlocked.");
        running.current = false;
        return;
      }
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setState("processing");
    setMessage(
      "Your bank may have completed the debit, but Razorpay has not confirmed it yet. Do not pay again—tap Check again in a moment.",
    );
    running.current = false;
  };

  useEffect(() => {
    if (!postId) {
      setState("processing");
      setMessage("Missing payment details. Return to the post and try again.");
      return;
    }
    confirm();
  }, [postId, orderId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/60 p-7 text-center">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
          state === "paid" ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
        }`}>
          {state === "checking" ? <Loader2 className="w-9 h-9 animate-spin" /> : state === "paid" ? <CheckCircle2 className="w-10 h-10" /> : <Clock3 className="w-9 h-9" />}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mt-6">
          {state === "paid" ? "Payment successful" : state === "processing" ? "Confirmation pending" : "Confirming payment"}
        </h1>
        <p className="text-sm leading-6 text-zinc-500 mt-3">{message}</p>
        <div className="mt-5 rounded-xl bg-zinc-50 p-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Verified securely with Razorpay
        </div>
        {state === "paid" ? (
          <button onClick={() => navigate(`/view/${postId}`, { replace: true })} className="w-full h-12 mt-6 rounded-xl bg-rose-500 text-white font-bold">
            View unlocked post
          </button>
        ) : state === "processing" ? (
          <button onClick={confirm} className="w-full h-12 mt-6 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Check again
          </button>
        ) : null}
      </div>
    </div>
  );
}
