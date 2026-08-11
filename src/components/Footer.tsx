import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BrandLogo } from "./BrandMark";

export function Footer() {
  return (
    <footer className="relative border-t border-white/40 bg-gradient-to-b from-white to-rose-50/40 px-6 py-14 lg:px-12 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-rose-200/20 rounded-full blur-[90px] animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-200/20 rounded-full blur-[90px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-md"
          >
            <Link to="/" className="inline-flex" aria-label="MalluCupid home">
              <BrandLogo size="xl" />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-zinc-600">
              MalluCupid helps creators share free and paid content, chat with fans, and get paid securely via Razorpay.
            </p>
          </motion.div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-zinc-600">
            <a href="/#how-it-works" className="transition-colors hover:text-rose-600">How it works</a>
            <Link to="/signup" className="transition-colors hover:text-rose-600">Become a creator</Link>
            <Link to="/userlogin" className="transition-colors hover:text-rose-600">Fan login</Link>
            <Link to="/contact-us" className="transition-colors hover:text-rose-600">Contact</Link>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-rose-100/60 pt-6 text-sm text-zinc-500 md:flex-row md:items-center">
          <div>&copy; {new Date().getFullYear()} MalluCupid. All rights reserved.</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/privacy-policy" className="transition-colors hover:text-rose-600">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="transition-colors hover:text-rose-600">Terms of Service</Link>
            <Link to="/refund-policy" className="transition-colors hover:text-rose-600">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
