import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandMark";
import { useRef, type MouseEvent } from "react";

export function CommunityCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 18 });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-rose-50/30 to-white pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-pink-300/20 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-rose-300/20 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-300/15 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '5s' }} />
      </div>

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* 3D tilt card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative order-2 lg:order-1"
          >
            <motion.div
              ref={ref}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="relative rounded-[2.5rem] glass p-10 md:p-12 shadow-2xl shadow-rose-200/40 glow-soft"
            >
              {/* Floating decorative chips */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-5 -left-5 rounded-2xl glass px-3 py-2 text-xs font-bold text-rose-600 shadow-lg"
                style={{ transform: "translateZ(60px)" }}
              >
                🔒 Secure media
              </motion.div>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-5 -right-5 rounded-2xl glass px-3 py-2 text-xs font-bold text-purple-600 shadow-lg"
                style={{ transform: "translateZ(60px)" }}
              >
                ⚡ Instant payouts
              </motion.div>

              <div
                className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 border border-rose-100 px-4 py-1.5 mb-8 shadow-sm"
                style={{ transform: "translateZ(30px)" }}
              >
                <Sparkles className="h-4 w-4 text-rose-500" />
                <span className="text-sm font-semibold text-rose-700">For Mallu creators</span>
              </div>

              <div style={{ transform: "translateZ(40px)" }} className="mb-6">
                <BrandLogo size="lg" />
              </div>

              <h3
                className="text-3xl md:text-4xl font-display font-bold text-zinc-900 mb-4 tracking-tight"
                style={{ transform: "translateZ(35px)" }}
              >
                Sell exclusive content. Chat. Get paid.
              </h3>

              <p
                className="text-zinc-600 text-lg leading-relaxed max-w-sm mb-8"
                style={{ transform: "translateZ(25px)" }}
              >
                Share free and paid posts, unlock with Razorpay, and withdraw earnings to your bank — all in one place.
              </p>

              <p
                className="text-rose-600 font-semibold"
                style={{ transform: "translateZ(20px)" }}
              >
                Built for creators and fans in Kerala and beyond
              </p>
            </motion.div>
          </motion.div>

          {/* Right column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center lg:text-left order-1 lg:order-2"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-6 shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">Your creator page</span>
            </motion.div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-zinc-900 mb-6 leading-[1.05]">
              Build your <br className="hidden lg:block" />
              <span className="text-gradient-rose">creator page</span>
            </h2>

            <p className="text-lg md:text-xl text-zinc-600 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Publish photos and videos, follow fans who unlock your paid posts, and message them securely — without leaving MalluCupid.
            </p>

            <Link
              to="/signup"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-rose-500 px-8 text-base font-bold text-white transition-all hover:bg-rose-600 hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/30 glow-rose w-full sm:w-auto relative overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
              Start creating
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
