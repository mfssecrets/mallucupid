import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, type MouseEvent } from "react";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 18 });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <section
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative min-h-screen pt-36 pb-24 lg:pt-44 lg:pb-32 overflow-hidden mesh-bg grid-bg"
    >
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[520px] h-[520px] bg-gradient-to-br from-rose-400/40 via-pink-400/30 to-purple-500/30 blur-[100px] rounded-full animate-pulse-glow animate-blob-morph" />
        <div className="absolute top-1/3 right-1/4 w-[460px] h-[460px] bg-gradient-to-br from-purple-400/40 to-cyan-300/30 blur-[110px] rounded-full animate-pulse-glow animate-blob-morph" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/3 w-[420px] h-[420px] bg-gradient-to-tr from-fuchsia-400/30 to-rose-300/30 blur-[100px] rounded-full animate-pulse-glow animate-blob-morph" style={{ animationDelay: '4s' }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(18)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              width: `${4 + (i % 4) * 3}px`,
              height: `${4 + (i % 4) * 3}px`,
              background: i % 3 === 0 ? 'rgba(255,45,111,0.55)' : i % 3 === 1 ? 'rgba(168,85,247,0.55)' : 'rgba(34,211,238,0.55)',
              boxShadow: `0 0 ${10 + (i % 3) * 6}px currentColor`,
            }}
            animate={{ y: [0, -30, 0], x: [0, (i % 2 ? 12 : -12), 0], opacity: [0.3, 0.85, 0.3] }}
            transition={{ duration: 6 + (i % 4) * 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
          />
        ))}
      </div>

      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="container mx-auto px-6 relative z-10"
      >
        <div className="max-w-5xl mx-auto text-center" style={{ transform: "translateZ(60px)" }}>
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-8 shadow-lg shadow-rose-100/40"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-zinc-700">Creator platform for Mallu creators</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-zinc-900 mb-6 leading-[1.05]"
          >
            Turn Your Passion Into Your{" "}
            <span className="text-gradient-shine">Profession</span>
          </motion.h1>

          {/* 3D floating preview cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative mx-auto mt-12 mb-10 max-w-3xl"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="relative h-[260px] sm:h-[280px]">
              {/* Back card */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -translate-x-[55%] w-[260px] h-[180px] sm:w-[300px] sm:h-[200px] rounded-3xl glass shadow-2xl shadow-purple-200/40 rotate-[-8deg]"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/30 to-cyan-400/20 p-5">
                  <div className="text-xs font-bold text-purple-700 uppercase tracking-widest">Exclusive Rooms</div>
                  <div className="mt-2 text-2xl font-display font-bold text-zinc-900">₹10+ entry</div>
                  <div className="mt-1 text-xs text-zinc-600">30-day fan access</div>
                </div>
              </motion.div>

              {/* Middle card */}
              <motion.div
                animate={{ y: [0, 14, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 translate-x-[55%] w-[260px] h-[180px] sm:w-[300px] sm:h-[200px] rounded-3xl glass shadow-2xl shadow-rose-200/40 rotate-[8deg]"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-rose-500/30 to-pink-400/20 p-5">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-widest">Wallet</div>
                  <div className="mt-2 text-2xl font-display font-bold text-zinc-900">₹24h hold</div>
                  <div className="mt-1 text-xs text-zinc-600">Bank / UPI payout</div>
                </div>
              </motion.div>

              {/* Front card */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[200px] sm:w-[340px] sm:h-[220px] rounded-3xl glass shadow-2xl shadow-zinc-300/50 glow-rose"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/80 to-white/40 p-6 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-rose-600 uppercase tracking-widest">Verified Badge</div>
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
                  </div>
                  <div>
                    <div className="text-3xl font-display font-bold text-zinc-900">Free + Paid Posts</div>
                    <div className="mt-1 text-xs text-zinc-600">Photo · Video · Razorpay unlock</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/signup"
              className="group relative flex h-14 items-center justify-center gap-3 rounded-full bg-[#E5164B] px-10 text-sm font-bold tracking-wider uppercase text-white transition-all hover:bg-[#D41040] hover:scale-105 active:scale-95 w-full sm:w-auto shadow-lg shadow-rose-500/30 glow-rose overflow-hidden"
            >
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              </span>
              JOIN AS CREATOR
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  );
}
