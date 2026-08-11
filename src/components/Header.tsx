import { motion, useScroll, useTransform } from "motion/react";
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandMark";

export function Header() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 100], [0, 0]);
  const padding = useTransform(scrollY, [0, 100], ["1rem", "0.5rem"]);
  const bg = useTransform(
    scrollY,
    [0, 60],
    ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.85)"]
  );

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ y, paddingTop: padding, paddingBottom: padding, backgroundColor: bg }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/40 shadow-[0_8px_30px_-12px_rgba(255,45,111,0.15)]"
    >
      <div className="flex items-center justify-between px-6 lg:px-12">
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex items-center gap-2"
        >
          <Link to="/" className="flex items-center gap-2" aria-label="MalluCupid home">
            <BrandLogo size="xl" />
          </Link>
        </motion.div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="/#how-it-works" className="relative text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors group">
            How it Works
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-rose-500 to-purple-500 transition-all group-hover:w-full" />
          </a>
          <Link to="/signup" className="relative text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors group">
            Become a creator
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-rose-500 to-purple-500 transition-all group-hover:w-full" />
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/30"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Get Started</span>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
