import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, LifeBuoy, Plus, AlertCircle, CheckCircle2, Loader2, TicketCheck, X } from "lucide-react";
import { createSupportTicket, getSupportTickets, type SupportTicket } from "../lib/auth";

const STATUS_STYLES: Record<SupportTicket["status"], string> = {
  open: "bg-rose-50 text-rose-600",
  in_progress: "bg-amber-50 text-amber-600",
  resolved: "bg-emerald-50 text-emerald-600",
};

const STATUS_LABELS: Record<SupportTicket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function HelpPage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  useEffect(() => {
    (async () => {
      const response = await getSupportTickets();
      setTickets(response.tickets || []);
      setIsLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (subject.trim().length < 3) {
      setError("Subject must be at least 3 characters.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Message must be at least 10 characters.");
      return;
    }
    setIsSubmitting(true);
    const response = await createSupportTicket(subject.trim(), message.trim());
    setIsSubmitting(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    if (response.ticket) {
      setTickets((prev) => [response.ticket as SupportTicket, ...prev]);
      setSubject("");
      setMessage("");
      setIsFormOpen(false);
      setCreated(true);
      setTimeout(() => setCreated(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-16 md:py-10">
      <div className="max-w-xl mx-auto px-4 md:px-0 pt-3 md:pt-0">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(`/${username}`)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-zinc-900" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">Help & Support</h1>
        </div>

        {/* Intro / create token */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-sm mb-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-zinc-900 flex items-center gap-2 mb-1">
                <LifeBuoy className="w-5 h-5 text-rose-500" /> Contact admin
              </h2>
              <p className="text-zinc-500 text-sm">
                Create a support token to reach the MalluCupid team. Track its status below.
              </p>
            </div>
            <button
              onClick={() => { setIsFormOpen((open) => !open); setError(""); }}
              className="shrink-0 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-rose-500/20 flex items-center gap-1.5"
            >
              {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isFormOpen ? "Close" : "New token"}
            </button>
          </div>

          {created && (
            <div className="mt-4 bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Support token created. Admin will get back to you.
            </div>
          )}

          <AnimatePresence>
            {isFormOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmit}
                className="overflow-hidden"
              >
                <div className="pt-5 space-y-4">
                  {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 block mb-1.5">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={120}
                      placeholder="What do you need help with?"
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-sm font-semibold text-zinc-700">Message</label>
                      <span className="text-xs text-zinc-400 font-semibold">{message.length} / 1000</span>
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      placeholder="Describe your issue in detail…"
                      className="w-full h-28 resize-none px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-rose-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit token
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Token list */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-sm"
        >
          <h2 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
            <TicketCheck className="w-5 h-5 text-rose-500" /> Your support tokens
          </h2>

          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-rose-500 animate-spin" /></div>
          ) : tickets.length ? (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="border border-zinc-100 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="font-semibold text-zinc-900 text-sm">{ticket.subject}</h3>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-xs line-clamp-2 mb-2">{ticket.message}</p>
                  {ticket.admin_reply && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Admin reply</p>
                      <p className="text-zinc-700 text-xs">{ticket.admin_reply}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Token #{ticket.id.slice(0, 8).toUpperCase()} · {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-3 text-rose-400">
                <LifeBuoy className="w-7 h-7" />
              </div>
              <p className="text-zinc-900 font-semibold text-sm mb-1">No support tokens yet</p>
              <p className="text-zinc-500 text-xs max-w-[240px]">Create a token whenever you need help — you can check its status here anytime.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
