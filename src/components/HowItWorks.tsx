import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { UserPlus, Smartphone, Share2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, type MouseEvent, type ReactNode } from "react";

type Step = {
  icon: ReactNode;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: <UserPlus className="w-9 h-9 text-white" />,
    title: "Sign Up",
    description: "Register with us and set up your free personal fan app."
  },
  {
    icon: <Smartphone className="w-9 h-9 text-white" />,
    title: "Create your own app in less than 30 seconds",
    description: "Complete your basic info, create your memberships, start posting content, and get your personalised app link."
  },
  {
    icon: <Share2 className="w-9 h-9 text-white" />,
    title: "Share your app & start earning",
    description: "Most creators start earning in minutes of launching their app."
  }
];

function TiltCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [14, -14]), { stiffness: 150, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 150, damping: 16 });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: 0.15 + index * 0.12, duration: 0.6 }}
      className="flex flex-col items-center text-center group"
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative mb-10 w-32 h-32"
      >
        {/* Glow blob behind */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-400/60 via-purple-400/40 to-cyan-300/30 blur-2xl rounded-full scale-110 animate-pulse-glow" />

        {/* Orbit ring */}
        <div className="absolute inset-0 rounded-full border border-rose-200/40 animate-spin-slow">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_4px_rgba(255,45,111,0.6)]" />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1.5 w-1.5 rounded-full bg-purple-500 shadow-[0_0_10px_3px_rgba(168,85,247,0.6)]" />
        </div>

        {/* Glass orb with icon */}
        <div
          className="relative w-full h-full rounded-full glass shadow-2xl shadow-rose-200/50 flex items-center justify-center"
          style={{ transform: "translateZ(40px)" }}
        >
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-center justify-center">{step.icon}</div>
          {/* Highlight */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full bg-white/40 blur-md" />
        </div>

        {/* Step number */}
        <div
          className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-white shadow-xl border border-rose-100 flex items-center justify-center font-display font-bold text-rose-600 text-sm"
          style={{ transform: "translateZ(60px)" }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </motion.div>

      <h3 className="text-xl font-bold font-display text-zinc-900 mb-4 max-w-[280px]">
        {step.title}
      </h3>
      <p className="text-zinc-600 text-sm md:text-base leading-relaxed max-w-[320px]">
        {step.description}
      </p>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 mesh-bg opacity-60 pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-rose-200/30 via-purple-200/30 to-cyan-200/30 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-6 shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">3 steps to launch</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-display font-bold text-zinc-900 tracking-tight mb-6"
          >
            How it <span className="text-gradient-rose">works</span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-full border-2 border-rose-500 px-8 py-3 text-base font-semibold text-rose-500 transition-all hover:bg-rose-500 hover:text-white hover:scale-105 active:scale-95 shadow-lg shadow-rose-100/50"
            >
              Register Now
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-20 md:gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <TiltCard key={index} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
