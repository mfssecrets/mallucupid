import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, LockKeyhole, ShieldCheck, Sparkles, X, AlertCircle } from 'lucide-react';
import { loadRazorpay, type RazorpaySuccess } from '../lib/razorpay';
import type { PaymentBreakdown } from '../lib/auth';

const rupee = (paise: number | undefined) => `₹${((paise ?? 0) / 100).toFixed(2)}`;

const CONTENT_TYPE_LABEL: Record<NonNullable<PaymentBreakdown['content_type']>, string> = {
  paid: 'Exclusive / Paid Content',
  exclusive: 'Exclusive Room',
  live_stream_booking: 'Live Stream Entry',
  live_stream_gift: 'Live Stream Gift',
};

export interface PaymentDialogProps {
  open: boolean;
  breakdown: PaymentBreakdown | null;
  loading: boolean;                  // fetching the breakdown from server
  error: string;                     // breakdown-fetch / open errors
  onClose: () => void;
  onPaySuccess: (success: RazorpaySuccess) => void;
  onPayDismiss: () => void;
  /** Optional buyer info for Razorpay prefill */
  prefill?: { email?: string; name?: string };
  /** Optional brand label inside Razorpay modal */
  brandName?: string;
  /** Optional description for Razorpay modal */
  description?: string;
}

/**
 * PaymentDialog — server-issued breakdown dialog for all paid content types
 * (post unlock, exclusive room, live stream booking, live stream gift).
 *
 * The dialog NEVER trusts frontend-supplied amounts. It only renders values
 * returned by the backend `/post-checkout` / `/live-stream/book-checkout` /
 * `/live-stream/gift-checkout` / `/exclusive-room-checkout` endpoints.
 *
 * Flow:  Pay Now → loadRazorpay → open Razorpay Checkout → on success
 *        call onPaySuccess(success) → parent verifies server-side via
 *        /post-verify-payment (or equivalents). On dismiss, parent reconciles
 *        via /post-payment-status to recover debited-but-interrupted payments.
 */
export default function PaymentDialog({
  open,
  breakdown,
  loading,
  error,
  onClose,
  onPaySuccess,
  onPayDismiss,
  prefill,
  brandName = 'MalluCupid',
  description,
}: PaymentDialogProps) {
  const [opening, setOpening] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) {
      setOpening(false);
      setLocalError('');
    }
  }, [open]);

  const contentName = breakdown?.content_name || '—';
  const contentType = breakdown?.content_type || 'paid';
  const contentAmount = breakdown?.content_amount_paise ?? 0;
  const platformFee = breakdown?.platform_fee_paise ?? 0;
  const finalAmount = breakdown?.final_amount_paise ?? breakdown?.amount ?? 0;
  const feePercent = breakdown?.platform_fee_percent ?? 3;

  const handlePay = async () => {
    if (!breakdown?.order_id || !breakdown?.key_id || opening) return;
    setLocalError('');
    setOpening(true);
    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay) {
      setOpening(false);
      setLocalError('Could not load Razorpay. Check your connection and try again.');
      return;
    }
    try {
      const gateway = new window.Razorpay({
        key: breakdown.key_id,
        amount: breakdown.amount ?? breakdown.final_amount_paise,
        currency: breakdown.currency || 'INR',
        name: brandName,
        description: description || `Unlock: ${contentName.slice(0, 40)}`,
        order_id: breakdown.order_id,
        prefill: {
          email: prefill?.email || '',
          name: prefill?.name || '',
        },
        theme: { color: '#f43f5e' },
        handler: (payment: RazorpaySuccess) => {
          setOpening(false);
          onPaySuccess(payment);
        },
        modal: {
          ondismiss: () => {
            setOpening(false);
            onPayDismiss();
          },
        },
      });
      gateway.open();
    } catch (err) {
      setOpening(false);
      setLocalError(err instanceof Error ? err.message : 'Failed to open Razorpay. Try again.');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.button
            aria-label="Close payment dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-rose-500 to-pink-500 text-white relative">
              <button
                onClick={onClose}
                disabled={opening || loading}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <LockKeyhole className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-rose-100 font-semibold">Confirm Payment</p>
                  <h2 className="text-lg font-bold leading-tight">You're one step away</h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {/* Content type chip */}
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" />
                  {CONTENT_TYPE_LABEL[contentType]}
                </span>
              </div>

              {/* Content name */}
              <div className="mb-5">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Content Name</p>
                <p className="text-sm font-semibold text-zinc-900 line-clamp-3 break-words leading-snug">
                  {contentName}
                </p>
              </div>

              {/* Breakdown */}
              {loading ? (
                <div className="py-8 flex items-center justify-center text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Preparing breakdown…
                </div>
              ) : (
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center justify-between py-2.5 border-b border-dashed border-zinc-200">
                    <span className="text-sm text-zinc-600">Amount</span>
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums">{rupee(contentAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-dashed border-zinc-200">
                    <span className="text-sm text-zinc-600">
                      Platform Charge <span className="text-xs text-zinc-400">({feePercent}% of amount)</span>
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums">+ {rupee(platformFee)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 mt-1 bg-rose-50 rounded-xl px-3">
                    <span className="text-sm font-bold text-zinc-900">Final Amount</span>
                    <span className="text-lg font-extrabold text-rose-600 tabular-nums">{rupee(finalAmount)}</span>
                  </div>
                </div>
              )}

              {/* Errors */}
              {(error || localError) && !loading && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 leading-snug">{localError || error}</p>
                </div>
              )}

              {/* Security note */}
              {!loading && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-4">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Secured by Razorpay. We never store your card details.</span>
                </div>
              )}
            </div>

            {/* Footer — Pay Now */}
            <div className="px-6 pb-6 pt-2 bg-white border-t border-zinc-100">
              <button
                onClick={handlePay}
                disabled={loading || opening || !breakdown?.order_id || !!error}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 disabled:opacity-60 disabled:shadow-none transition-all"
              >
                {opening ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening Razorpay…
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Preparing…
                  </>
                ) : (
                  <>Pay {rupee(finalAmount)} Now</>
                )}
              </button>
              <p className="text-center text-[11px] text-zinc-400 mt-3">
                One-time payment · Lifetime access to this content
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
