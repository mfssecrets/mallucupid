import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';

export interface PaymentResultScreenProps {
  open: boolean;
  result: 'success' | 'failed';
  amountLabel?: string;
  contentName?: string;
  onRetry?: () => void;
  onDone: () => void;
  doneLabel?: string;
}

/**
 * Full-screen success / failed result UI shown after Razorpay closes.
 *
 * - On success: green check + "Payment successful" + Done button.
 * - On failed: red X + "Payment failed" + Retry button (re-opens PaymentDialog).
 *
 * NOTE: This screen renders the visual state. The actual access-granting
 * happens server-side via /post-verify-payment (or live-stream equivalents).
 * The parent should only set result='success' after the server confirms.
 */
export default function PaymentResultScreen({
  open,
  result,
  amountLabel,
  contentName,
  onRetry,
  onDone,
  doneLabel = 'View content',
}: PaymentResultScreenProps) {
  if (!open) return null;
  const success = result === 'success';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[210] bg-white flex items-center justify-center px-6"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        className="w-full max-w-sm text-center"
      >
        <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${
          success ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
          {success ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 14 }}
            >
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 14 }}
            >
              <XCircle className="w-14 h-14 text-red-500" />
            </motion.div>
          )}
        </div>

        <h1 className={`text-2xl font-bold mt-6 ${success ? 'text-emerald-600' : 'text-red-600'}`}>
          {success ? 'Payment successful' : 'Payment failed'}
        </h1>

        <p className="text-sm leading-6 text-zinc-500 mt-3 px-4">
          {success
            ? amountLabel
              ? `Paid ${amountLabel}. Your access is permanently unlocked.`
              : 'Your access is permanently unlocked.'
            : 'Your payment could not be completed. No money was deducted. Please try again.'}
        </p>

        {contentName && (
          <p className="text-xs text-zinc-400 mt-2 line-clamp-1">{contentName}</p>
        )}

        <div className="mt-7 space-y-2.5">
          {success ? (
            <button
              onClick={onDone}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30"
            >
              {doneLabel} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30"
                >
                  <RefreshCw className="w-4 h-4" /> Retry payment
                </button>
              )}
              <button
                onClick={onDone}
                className="w-full h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
