import { useId, useState, useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

const TOPICS = [
  {
    title: "What is MalluCupid?",
    body: "MalluCupid is a creator platform for Malayali creators and fans. Creators publish free and paid photos and videos, open exclusive rooms with monthly entry, chat with supporters, and withdraw earnings to an Indian bank account through Razorpay.",
  },
  {
    title: "For creators",
    body: "Build a mobile creator page in minutes. Share your public link, sell one-time unlocks or exclusive room access, message fans securely, and track lifetime sales in your wallet — with a clear platform fee shown before every withdrawal.",
  },
  {
    title: "For fans",
    body: "Follow creators, unlock paid posts, enter exclusive rooms for thirty days of gallery access, and chat when you are ready. Payments are processed securely via Razorpay; digital access is delivered instantly after a successful payment.",
  },
] as const;

const FAQS = [
  {
    q: "Is MalluCupid free for creators?",
    a: "Creating an account and publishing free posts is free. You set prices on paid posts and exclusive rooms. When you withdraw earnings, MalluCupid applies a platform fee configured on the server — the fee and net payout are shown in your wallet before you confirm.",
  },
  {
    q: "How do paid posts and Exclusive Rooms work?",
    a: "Paid posts are unlocked once with a one-time Razorpay payment. Exclusive Rooms use a monthly entry fee: paying grants thirty days of access to that room’s gallery. Room posts are not sold individually — access is through the room subscription.",
  },
  {
    q: "How do creators get paid?",
    a: "Earnings from verified paid unlocks and exclusive room entries appear in the creator wallet. After a twenty-four hour hold on new sales, creators can withdraw to a saved Indian bank account (minimum ₹100). Transfers are completed by MalluCupid operations via Razorpay settlements.",
  },
  {
    q: "Is MalluCupid only for creators from Kerala?",
    a: "MalluCupid is built for the Malayali creator community and audiences who follow Mallu creators — in Kerala and worldwide. Creators and fans can join from anywhere, as long as they accept our Terms and use supported payment methods.",
  },
  {
    q: "Where can I read the policies?",
    a: "See our Terms of Service, Privacy Policy, Refund Policy, and Contact page for legal, payment, and support details. For account or payment help, email support@mallucupid.com.",
  },
] as const;

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b border-zinc-200/80">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-6 py-5 text-left transition-colors hover:text-rose-600"
        >
          <span className="font-display text-[15px] font-medium leading-snug text-zinc-900 sm:text-base">
            {question}
          </span>
          <span
            aria-hidden
            className={`mt-0.5 shrink-0 font-display text-lg leading-none text-zinc-400 transition-transform duration-300 ${
              open ? "rotate-45 text-rose-500" : ""
            }`}
          >
            +
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className={open ? "pb-5 pr-8" : undefined}
      >
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-[15px]">{answer}</p>
      </div>
    </div>
  );
}

function TiltTopic({ topic, i }: { topic: { title: string; body: string }; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 150, damping: 18 });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: i * 0.08, duration: 0.55 }}
      className="border-t border-zinc-200/90 pt-8 first:border-t-0 first:pt-0 sm:pt-10 sm:first:pt-0"
    >
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="flex gap-5 sm:gap-8 rounded-2xl p-2 -m-2 transition-shadow"
      >
        <span
          className="font-display text-xs font-medium tabular-nums tracking-widest text-rose-500"
          style={{ transform: "translateZ(30px)" }}
        >
          {String(i + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1" style={{ transform: "translateZ(20px)" }}>
          <h3 className="font-display text-lg font-medium text-zinc-900 sm:text-xl">
            {topic.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
            {topic.body}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

export function SeoSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MalluCupid",
    url: "https://www.mallucupid.com",
    logo: "https://res.cloudinary.com/dsamz0zji/image/upload/v1784680966/mallucupidlogo_a44gud.png",
    email: "support@mallucupid.com",
    telephone: "+91-9581150441",
    address: {
      "@type": "PostalAddress",
      streetAddress: "456, Gautam Nagar, JP Nagar 7th Phase",
      addressLocality: "Bengaluru",
      addressRegion: "Karnataka",
      postalCode: "560078",
      addressCountry: "IN",
    },
  };

  return (
    <section
      id="about"
      aria-labelledby="seo-heading"
      className="relative border-t border-zinc-200/80 bg-[#faf9f8] px-6 py-20 sm:py-24 lg:px-12 lg:py-28 overflow-hidden"
    >
      {/* Soft background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-rose-200/20 rounded-full blur-[80px] animate-pulse-glow" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-200/20 rounded-full blur-[90px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="lg:col-span-5"
          >
            <p className="mb-4 font-display text-[11px] font-medium uppercase tracking-[0.22em] text-rose-600">
              About the platform
            </p>
            <h2
              id="seo-heading"
              className="font-display text-3xl font-medium leading-[1.15] tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem]"
            >
              The creator platform for Mallu creators and their fans
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-base">
              MalluCupid connects Malayali creators with audiences who want free posts, paid unlocks,
              exclusive monthly rooms, and private chat — with secure Razorpay checkout and bank withdrawals
              for creators in India.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
              <Link to="/signup" className="text-rose-600 transition-colors hover:text-rose-700">
                Become a creator
              </Link>
              <Link to="/userlogin" className="text-zinc-500 transition-colors hover:text-zinc-900">
                Fan login
              </Link>
              <Link to="/contact-us" className="text-zinc-500 transition-colors hover:text-zinc-900">
                Contact support
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            className="space-y-10 lg:col-span-7"
          >
            {TOPICS.map((topic, i) => (
              <TiltTopic key={topic.title} topic={topic} i={i} />
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
          className="mt-16 border-t border-zinc-200 pt-14 sm:mt-20 sm:pt-16 lg:mt-24"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <h2 className="font-display text-2xl font-medium tracking-tight text-zinc-900 sm:text-3xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-600">
                Clear answers on pricing, payments, exclusive rooms, and who MalluCupid is for.
              </p>
            </div>
            <div className="lg:col-span-8">
              <div className="border-t border-zinc-200/80">
                {FAQS.map((item, index) => (
                  <FaqItem
                    key={item.q}
                    question={item.q}
                    answer={item.a}
                    open={openIndex === index}
                    onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
