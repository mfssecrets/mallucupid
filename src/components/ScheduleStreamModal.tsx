import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, IndianRupee, Loader2, LockKeyhole, Radio, X, Sparkles } from 'lucide-react';
import { createLiveStream, type LiveStream } from '../lib/auth';

const DURATIONS = [
  { value: 15 as const, label: '15 minutes' },
  { value: 30 as const, label: '30 minutes' },
  { value: 45 as const, label: '45 minutes' },
  { value: 60 as const, label: '1 hour' },
];

export interface ScheduleStreamModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (stream: LiveStream) => void;
}

/**
 * Schedule-stream modal — collects stream title, future start time, duration,
 * and free/paid entry fee. The backend re-validates every field, so we never
 * trust the form on its own.
 */
export default function ScheduleStreamModal({ open, onClose, onCreated }: ScheduleStreamModalProps) {
  const [title, setTitle] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [isPaid, setIsPaid] = useState(false);
  const [entryFee, setEntryFee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setScheduledStart('');
    setDuration(30);
    setIsPaid(false);
    setEntryFee('');
    setError('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) return setError('Enter a stream name.');
    if (!scheduledStart) return setError('Pick a date and time.');
    const startDate = new Date(scheduledStart);
    if (!startDate.getTime() || startDate.getTime() < Date.now() - 60_000) {
      return setError('Start time must be in the future.');
    }
    if (isPaid) {
      const fee = Number(entryFee);
      if (!Number.isFinite(fee) || fee < 10) {
        return setError('Paid entry fee must be at least ₹10.');
      }
    }
    setSubmitting(true);
    const res = await createLiveStream({
      title: title.trim(),
      scheduled_start: startDate.toISOString(),
      duration_minutes: duration,
      is_paid: isPaid,
      entry_fee: isPaid ? Number(entryFee) : undefined,
    });
    setSubmitting(false);
    if (res.error || !res.stream) {
      setError(res.error || 'Failed to schedule stream.');
      return;
    }
    const stream = res.stream;
    reset();
    onCreated(stream);
  };

  // min datetime-local value = now+5min in local tz (no seconds)
  const minDateLocal = (() => {
    const d = new Date(Date.now() + 5 * 60_000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.button
            aria-label="Close schedule dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-rose-500 to-pink-500 text-white relative shrink-0">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-rose-100 font-semibold">Schedule a Live</p>
                  <h2 className="text-lg font-bold leading-tight">Plan your next stream</h2>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto">
              {/* Title */}
              <label className="block mb-4">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Live Stream Name</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Saturday night Q&A"
                  className="mt-1.5 w-full h-11 rounded-xl border border-zinc-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none px-3.5 text-sm"
                />
              </label>

              {/* Date & time */}
              <label className="block mb-4">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Select a Time
                </span>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  min={minDateLocal}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="mt-1.5 w-full h-11 rounded-xl border border-zinc-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none px-3.5 text-sm"
                />
              </label>

              {/* Duration */}
              <div className="mb-4">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duration
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDuration(d.value)}
                      className={`h-10 rounded-xl text-xs font-semibold border transition-all ${
                        duration === d.value
                          ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-rose-300'
                      }`}
                    >
                      {d.value < 60 ? `${d.value}m` : '1h'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="mb-2">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1.5">Entry Price</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaid(false)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-all ${
                      !isPaid ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-zinc-700 border-zinc-200'
                    }`}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPaid(true)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      isPaid ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <LockKeyhole className="w-3.5 h-3.5" /> Paid
                  </button>
                </div>
              </div>

              {isPaid && (
                <label className="block mt-3">
                  <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5" /> Entry Amount (₹)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={10}
                    step={1}
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    placeholder="e.g. 99"
                    className="mt-1.5 w-full h-11 rounded-xl border border-zinc-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none px-3.5 text-sm"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Users pay this entry fee (plus 3% platform charge) to book a slot or enter the live.
                  </p>
                </label>
              )}

              {error && (
                <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 bg-white border-t border-zinc-100 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Create My Stream</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
