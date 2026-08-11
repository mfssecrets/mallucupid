import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Gift, Loader2, MessageCircle, MessageCircleOff, Mic, MicOff,
  MoreHorizontal, RefreshCw, Send, Share2, SwitchCamera, Users, Video, VideoOff,
  X, CheckCircle2, AlertCircle, LogIn, Radio, TrendingUp, Crown, LockKeyhole,
} from 'lucide-react';
import {
  checkoutLiveStreamBooking, endLiveStream, getLiveStream, getLiveStreamBookingStatus,
  getLiveStreamChat, getLiveStreamGiftCatalog, getLiveStreamStats, heartbeatLiveStream,
  sendLiveStreamChat, startLiveStream, updateLiveStreamSettings, verifyLiveStreamBooking,
  verifyLiveStreamGift, checkoutLiveStreamGift,
  type LiveStream, type LiveStreamChatMessage, type LiveStreamGift, type LiveStreamStats,
  type PaymentBreakdown,
} from '../lib/auth';
import { loadRazorpay, type RazorpaySuccess } from '../lib/razorpay';
import { useAuth } from '../lib/useAuth';
import PaymentDialog from '../components/PaymentDialog';
import PaymentResultScreen from '../components/PaymentResultScreen';

const rupee = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/**
 * LiveStreamPage — the creator-side and viewer-side stream UI.
 *
 * Creator controls: start live, mute mic, toggle comments, flip camera, end
 * live, "more" panel (active viewers, total earnings).
 * Viewer controls: book paid entry (Razorpay), chat (if enabled), gift
 * (Razorpay).
 *
 * Frontend never trusts itself for access — every entry check goes through
 * /live-stream/book-status, and the actual capture confirmation is done
 * server-side via /live-stream/book-verify + Razorpay webhook.
 */
export default function LiveStreamPage() {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Stream media state (creator only)
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Chat
  const [messages, setMessages] = useState<LiveStreamChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // More panel
  const [moreOpen, setMoreOpen] = useState(false);
  const [stats, setStats] = useState<LiveStreamStats | null>(null);

  // Gift panel
  const [gifts, setGifts] = useState<LiveStreamGift[]>([]);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);

  // Booking payment dialog (paid entry)
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payBreakdown, setPayBreakdown] = useState<PaymentBreakdown | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  // Gift payment dialog
  const [giftPayOpen, setGiftPayOpen] = useState(false);
  const [giftPayBreakdown, setGiftPayBreakdown] = useState<PaymentBreakdown | null>(null);
  const [giftPayLoading, setGiftPayLoading] = useState(false);
  const [giftPayError, setGiftPayError] = useState('');

  // Result screen
  const [resultOpen, setResultOpen] = useState(false);
  const [resultKind, setResultKind] = useState<'success' | 'failed'>('success');
  const [resultContext, setResultContext] = useState<'booking' | 'gift'>('booking');

  // ── Load stream + access ────────────────────────────────────────────────
  const loadStream = useCallback(async () => {
    if (!publicId) return;
    const res = await getLiveStream(publicId);
    if (res.error || !res.stream) {
      setError(res.error || 'Stream not found');
      setLoading(false);
      return;
    }
    const s = res.stream;
    setStream(s);
    setIsCreator(s.creator_id === user?.id);
    setCommentsEnabled(s.comments_enabled);
    const creator = s.creator_id === user?.id;
    if (creator) {
      setHasAccess(true);
    } else if (!s.is_paid) {
      setHasAccess(true);
    } else {
      const status = await getLiveStreamBookingStatus(publicId);
      setHasAccess(Boolean(status.has_access));
    }
    setLoading(false);
  }, [publicId, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/userlogin?redirect=live/${publicId}`);
      return;
    }
    loadStream();
  }, [authLoading, user, publicId, navigate, loadStream]);

  // ── Refresh chat periodically when live ─────────────────────────────────
  useEffect(() => {
    if (!stream || stream.status !== 'live') return;
    let cancelled = false;
    const refresh = async () => {
      const res = await getLiveStreamChat(stream.public_id);
      if (!cancelled && res.messages) setMessages(res.messages);
      if (!cancelled && typeof res.comments_enabled === 'boolean') setCommentsEnabled(res.comments_enabled);
    };
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stream]);

  // ── Viewer heartbeat ────────────────────────────────────────────────────
  useEffect(() => {
    if (!stream || stream.status !== 'live' || isCreator) return;
    let cancelled = false;
    const beat = async () => {
      const r = await heartbeatLiveStream(stream.public_id);
      if (cancelled) return;
      if (typeof r.active_viewers === 'number') {
        setStream((prev) => prev ? { ...prev, active_viewers: r.active_viewers || 0 } : prev);
      }
    };
    beat();
    const interval = setInterval(beat, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [stream, isCreator]);

  // ── Creator: start camera when live ─────────────────────────────────────
  useEffect(() => {
    if (!isCreator || !stream || stream.status !== 'live') return;
    let cancelled = false;
    const startCam = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (!cameraOn) return;
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing },
          audio: micOn,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Camera/mic error:', err);
      }
    };
    startCam();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isCreator, stream?.status, cameraOn, micOn, cameraFacing]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Creator actions ─────────────────────────────────────────────────────
  const handleStartLive = async () => {
    if (!stream) return;
    const res = await startLiveStream(stream.public_id);
    if (res.stream) setStream(res.stream);
  };

  const handleEndLive = async () => {
    if (!stream) return;
    if (!confirm('End this live stream? Viewers will be disconnected.')) return;
    const res = await endLiveStream(stream.public_id);
    if (res.stream) {
      setStream(res.stream);
      setMoreOpen(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleToggleComments = async () => {
    if (!stream) return;
    const next = !commentsEnabled;
    setCommentsEnabled(next);
    const res = await updateLiveStreamSettings(stream.public_id, { comments_enabled: next });
    if (res.stream) setStream(res.stream);
  };

  const handleFlipCamera = () => {
    setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'));
  };

  const handleLoadStats = async () => {
    if (!stream) return;
    const res = await getLiveStreamStats(stream.public_id);
    if (res.stats) setStats(res.stats);
  };

  useEffect(() => {
    if (moreOpen && isCreator && stream) handleLoadStats();
  }, [moreOpen, isCreator, stream]);

  // ── Share ───────────────────────────────────────────────────────────────
  const shareUrl = stream ? `${window.location.origin}/live/${stream.public_id}` : '';
  const handleShare = async () => {
    if (!stream) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: stream.title,
          text: `Join my live stream: ${stream.title}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Stream link copied!');
    }
  };

  // ── Booking payment (paid entry) ────────────────────────────────────────
  const handleBookEntry = async () => {
    if (!stream) return;
    setPayError('');
    setPayBreakdown(null);
    setPayLoading(true);
    setPayDialogOpen(true);
    const res = await checkoutLiveStreamBooking(stream.public_id);
    setPayLoading(false);
    if (res.already_booked) {
      setPayDialogOpen(false);
      setHasAccess(true);
      const fresh = await getLiveStream(stream.public_id);
      if (fresh.stream) setStream(fresh.stream);
      return;
    }
    if (res.error || !res.order_id || !res.key_id) {
      setPayError(res.error || 'Unable to start payment.');
      return;
    }
    setPayBreakdown(res);
  };

  const handleBookPaySuccess = async (payment: RazorpaySuccess) => {
    if (!stream) return;
    setPayDialogOpen(false);
    setResultContext('booking');
    const verified = await verifyLiveStreamBooking({
      public_id: stream.public_id,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    });
    if (verified.status === 'paid') {
      setHasAccess(true);
      setResultKind('success');
      setResultOpen(true);
      const fresh = await getLiveStream(stream.public_id);
      if (fresh.stream) setStream(fresh.stream);
      return;
    }
    for (let i = 0; i < 8; i++) {
      const s = await getLiveStreamBookingStatus(stream.public_id, payment.razorpay_order_id);
      if (s.has_access || s.status === 'paid') {
        setHasAccess(true);
        setResultKind('success');
        setResultOpen(true);
        const fresh = await getLiveStream(stream.public_id);
        if (fresh.stream) setStream(fresh.stream);
        return;
      }
      if (i < 7) await new Promise((r) => setTimeout(r, 1500));
    }
    setResultKind('failed');
    setResultOpen(true);
  };

  const handleBookPayDismiss = async () => {
    if (!stream) return;
    for (let i = 0; i < 4; i++) {
      const s = await getLiveStreamBookingStatus(stream.public_id, payBreakdown?.order_id || '');
      if (s.has_access || s.status === 'paid') {
        setPayDialogOpen(false);
        setHasAccess(true);
        setResultContext('booking');
        setResultKind('success');
        setResultOpen(true);
        return;
      }
      if (i < 3) await new Promise((r) => setTimeout(r, 1200));
    }
    setPayError('');
  };

  // ── Gift payment ────────────────────────────────────────────────────────
  const handleSendGift = async (gift: LiveStreamGift) => {
    if (!stream) return;
    setGiftPayError('');
    setGiftPayBreakdown(null);
    setGiftPayLoading(true);
    setGiftPayOpen(true);
    setGiftPanelOpen(false);
    const res = await checkoutLiveStreamGift(stream.public_id, gift.code);
    setGiftPayLoading(false);
    if (res.error || !res.order_id || !res.key_id) {
      setGiftPayError(res.error || 'Unable to start gift payment.');
      return;
    }
    setGiftPayBreakdown(res);
  };

  const handleGiftPaySuccess = async (payment: RazorpaySuccess) => {
    setGiftPayOpen(false);
    setResultContext('gift');
    const verified = await verifyLiveStreamGift({
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    });
    if (verified.status === 'paid') {
      setResultKind('success');
      setResultOpen(true);
      // Bump local earnings for snappy UI
      if (stream && giftPayBreakdown?.final_amount_paise) {
        setStream((prev) => prev ? {
          ...prev,
          total_earnings_paise: prev.total_earnings_paise + (giftPayBreakdown.final_amount_paise || 0),
        } : prev);
      }
      return;
    }
    setResultKind('failed');
    setResultOpen(true);
  };

  const handleGiftPayDismiss = () => {
    setGiftPayOpen(false);
    setGiftPayError('');
  };

  // ── Chat send ───────────────────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!stream || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    const res = await sendLiveStreamChat(stream.public_id, text);
    if (res.message) {
      setMessages((prev) => [...prev, res.message!]);
    } else if (res.error) {
      setChatInput(text);
      alert(res.error);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
      </div>
    );
  }
  if (error || !stream) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white px-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold">{error || 'Stream not found'}</h1>
          <button
            onClick={() => navigate(-1)}
            className="mt-5 px-5 h-11 rounded-xl bg-rose-500 text-white font-semibold text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const liveNow = stream.status === 'live';
  const showPaywall = !hasAccess && stream.is_paid && !isCreator;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-zinc-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {liveNow ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-[11px] font-bold uppercase">
              <Radio className="w-3 h-3" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-bold uppercase">
              <Radio className="w-3 h-3" /> {stream.status}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <Users className="w-3.5 h-3.5" /> {stream.active_viewers}
          </div>
        </div>
        <button onClick={handleShare} className="p-2 rounded-full hover:bg-zinc-800">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Stream info bar */}
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <h1 className="text-base font-bold leading-tight line-clamp-1">{stream.title}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          by @{stream.creator_username} · {new Date(stream.scheduled_start).toLocaleString()} · {stream.duration_minutes}m
          {stream.is_paid && <> · Entry {rupee(stream.entry_fee_paise)}</>}
        </p>
      </div>

      {/* Stream viewport */}
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-[40vh]">
        {isCreator && liveNow && cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : isCreator && liveNow ? (
          <div className="text-center text-zinc-500">
            <VideoOff className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Camera is off</p>
          </div>
        ) : liveNow ? (
          hasAccess ? (
            <div className="text-center text-zinc-500 px-6">
              <Radio className="w-12 h-12 mx-auto mb-2 text-rose-500 animate-pulse" />
              <p className="text-sm font-semibold">Watching @{stream.creator_username}</p>
              <p className="text-xs mt-1 text-zinc-600">Live preview stream</p>
            </div>
          ) : (
            <div className="text-center text-zinc-500 px-6">
              <LockKeyhole className="w-12 h-12 mx-auto mb-3 text-rose-500" />
              <p className="text-sm font-semibold">Paid stream</p>
              <p className="text-xs mt-1 text-zinc-600">Pay the entry fee to watch live.</p>
            </div>
          )
        ) : (
          <div className="text-center text-zinc-500 px-6">
            <Radio className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm font-semibold capitalize">{stream.status}</p>
            <p className="text-xs mt-1 text-zinc-600">
              {stream.status === 'scheduled'
                ? `Starts ${new Date(stream.scheduled_start).toLocaleString()}`
                : stream.status === 'ended'
                ? 'This stream has ended.'
                : 'Stream unavailable.'}
            </p>
            {isCreator && stream.status === 'scheduled' && (
              <button
                onClick={handleStartLive}
                className="mt-5 px-6 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm flex items-center gap-2 mx-auto"
              >
                <Radio className="w-4 h-4" /> Start Live Now
              </button>
            )}
          </div>
        )}

        {/* Creator controls overlay (bottom) */}
        {isCreator && liveNow && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
            <button
              onClick={() => setMicOn((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${micOn ? 'bg-zinc-800' : 'bg-rose-500'}`}
              title={micOn ? 'Mute' : 'Unmute'}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setCameraOn((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${cameraOn ? 'bg-zinc-800' : 'bg-rose-500'}`}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={handleFlipCamera}
              className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center"
              title="Flip camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
            <button
              onClick={handleToggleComments}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${commentsEnabled ? 'bg-zinc-800' : 'bg-rose-500'}`}
              title={commentsEnabled ? 'Comments on' : 'Comments off'}
            >
              {commentsEnabled ? <MessageCircle className="w-5 h-5" /> : <MessageCircleOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMoreOpen(true)}
              className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center"
              title="More"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Paywall CTA (viewer, paid, no access) */}
      {showPaywall && (
        <div className="px-4 py-4 bg-gradient-to-br from-rose-500 to-pink-500 shrink-0">
          <p className="text-xs text-rose-100 font-semibold mb-1">Paid entry required</p>
          <p className="text-sm text-white mb-3">Book your slot to watch live.</p>
          <button
            onClick={handleBookEntry}
            className="w-full h-12 rounded-xl bg-white text-rose-600 font-bold text-sm"
          >
            Pay {rupee(stream.entry_fee_paise)} to enter
          </button>
        </div>
      )}

      {/* Chat (viewers + creator when live) */}
      {liveNow && !showPaywall && (
        <div className="border-t border-zinc-800 bg-zinc-900 shrink-0 max-h-[35vh] flex flex-col">
          <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {commentsEnabled ? 'Live chat' : 'Chat disabled by creator'}
            </span>
            <span className="text-xs text-zinc-500">{messages.length} msgs</span>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">
                {commentsEnabled ? 'Be the first to say hi 👋' : 'Creator has turned off comments.'}
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex gap-2 text-xs">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {m.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-semibold text-rose-400">@{m.username}</span>{' '}
                  <span className="text-zinc-200 break-words">{m.body}</span>
                </div>
              </div>
            ))}
          </div>
          {commentsEnabled && (
            <div className="px-3 py-2 border-t border-zinc-800 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={500}
                placeholder="Send a message…"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                className="flex-1 h-10 rounded-full bg-zinc-800 border border-zinc-700 px-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gift button (viewer, live) */}
      {liveNow && !isCreator && hasAccess && (
        <button
          onClick={async () => {
            if (!gifts.length) {
              const r = await getLiveStreamGiftCatalog();
              if (r.gifts) setGifts(r.gifts);
            }
            setGiftPanelOpen(true);
          }}
          className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 shadow-xl shadow-rose-500/40 flex items-center justify-center z-50"
        >
          <Gift className="w-6 h-6" />
        </button>
      )}

      {/* More panel (creator) */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-zinc-900 text-white rounded-t-3xl p-6 pb-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Stream insights</h2>
                <button onClick={() => setMoreOpen(false)} className="p-2 rounded-full bg-zinc-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {stats ? (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-zinc-800 rounded-2xl p-4">
                    <Users className="w-5 h-5 text-rose-400 mb-2" />
                    <p className="text-2xl font-bold">{stats.active_viewers}</p>
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Active now</p>
                  </div>
                  <div className="bg-zinc-800 rounded-2xl p-4">
                    <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold">{rupee(stats.total_earnings_paise)}</p>
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Total earnings</p>
                  </div>
                  <div className="bg-zinc-800 rounded-2xl p-4">
                    <Crown className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="text-2xl font-bold">{stats.peak_viewers}</p>
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Peak viewers</p>
                  </div>
                  <div className="bg-zinc-800 rounded-2xl p-4">
                    <Gift className="w-5 h-5 text-pink-400 mb-2" />
                    <p className="text-2xl font-bold">{stats.bookings_count}</p>
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Bookings</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>
              )}
              <button
                onClick={handleLoadStats}
                className="w-full h-10 rounded-xl bg-zinc-800 text-white text-sm font-semibold flex items-center justify-center gap-2 mb-3"
              >
                <RefreshCw className="w-4 h-4" /> Refresh stats
              </button>
              <button
                onClick={handleEndLive}
                className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                End Live Session
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gift panel (viewer) */}
      <AnimatePresence>
        {giftPanelOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGiftPanelOpen(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-zinc-900 text-white rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-zinc-900 pb-2">
                <h2 className="text-lg font-bold">Send a gift</h2>
                <button onClick={() => setGiftPanelOpen(false)} className="p-2 rounded-full bg-zinc-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                Each gift includes a 3% platform charge. Creator receives the gift value.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {gifts.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSendGift(g)}
                    className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-3 text-center transition-colors"
                  >
                    <div className="text-3xl mb-1">{g.emoji}</div>
                    <p className="text-xs font-semibold truncate">{g.name}</p>
                    <p className="text-[11px] text-rose-400 font-bold mt-0.5">{rupee(g.amount_paise)}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking payment dialog */}
      <PaymentDialog
        open={payDialogOpen}
        breakdown={payBreakdown}
        loading={payLoading}
        error={payError}
        onClose={() => { setPayDialogOpen(false); setPayBreakdown(null); setPayError(''); }}
        onPaySuccess={handleBookPaySuccess}
        onPayDismiss={handleBookPayDismiss}
        prefill={{ email: user?.email || '', name: user?.user_metadata?.name || '' }}
        brandName="MalluCupid"
        description={`Live stream entry: ${stream.title.slice(0, 40)}`}
      />

      {/* Gift payment dialog */}
      <PaymentDialog
        open={giftPayOpen}
        breakdown={giftPayBreakdown}
        loading={giftPayLoading}
        error={giftPayError}
        onClose={() => { setGiftPayOpen(false); setGiftPayBreakdown(null); setGiftPayError(''); }}
        onPaySuccess={handleGiftPaySuccess}
        onPayDismiss={handleGiftPayDismiss}
        prefill={{ email: user?.email || '', name: user?.user_metadata?.name || '' }}
        brandName="MalluCupid"
        description={`Gift to @${stream.creator_username}`}
      />

      {/* Result screen */}
      <PaymentResultScreen
        open={resultOpen}
        result={resultKind}
        amountLabel={
          resultContext === 'booking'
            ? payBreakdown ? rupee(payBreakdown.final_amount_paise ?? 0) : undefined
            : giftPayBreakdown ? rupee(giftPayBreakdown.final_amount_paise ?? 0) : undefined
        }
        contentName={resultContext === 'booking' ? payBreakdown?.content_name : giftPayBreakdown?.content_name}
        onRetry={resultKind === 'failed' ? () => {
          setResultOpen(false);
          if (resultContext === 'booking') handleBookEntry();
          else if (giftPayBreakdown) {
            // Restart gift checkout with same code — find gift in catalog
            const g = gifts.find((x) => giftPayBreakdown.content_name?.includes(x.name));
            if (g) handleSendGift(g);
          }
        } : undefined}
        onDone={() => {
          setResultOpen(false);
          if (resultKind === 'success' && resultContext === 'gift') {
            // Stay on stream page after sending a gift
            return;
          }
          if (resultKind === 'failed') {
            // Stay on stream page so user can retry later
            return;
          }
          // For successful booking, refresh access
          loadStream();
        }}
        doneLabel={resultContext === 'gift' ? 'Continue watching' : 'Watch live'}
      />
    </div>
  );
}
