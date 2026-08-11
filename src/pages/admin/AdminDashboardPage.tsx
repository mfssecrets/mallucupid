import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard, Users, Image, LifeBuoy, Flag, Wallet, LogOut, Menu, X,
  Loader2, Trash2, CheckCircle2, XCircle, RefreshCw, Eye, IndianRupee,
  BadgeIndianRupee, CreditCard, BadgeCheck,
} from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import {
  type AdminTab, type AdminStats, type AdminUserRow, type AdminUserDetail,
  type AdminPostRow, type AdminPostView, type AdminTicketRow,
  type AdminPostReportRow, type AdminUserReportRow, type AdminWithdrawalRow,
  type AdminPaymentRow, type AdminSettlementRow, type AdminVerificationRow,
  getAdminStats, getAdminUsers, getAdminUserDetail, getAdminPosts, getAdminPostView,
  adminDeletePost, getAdminTickets, adminUpdateTicket, getAdminPostReports,
  getAdminUserReports, getAdminWithdrawals, adminProcessWithdrawal,
  adminCompleteWithdrawal, getAdminPayments, getAdminSettlements,
  getAdminVerifications, getAdminVerificationDetail, adminUpdateVerification,
} from "../../lib/admin";
import { BrandLogo } from "../../components/BrandMark";

const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "posts", label: "Posts", icon: Image },
  { id: "verification", label: "Verification", icon: BadgeCheck },
  { id: "payments", label: "Wallet & Payments", icon: CreditCard },
  { id: "settlements", label: "Creator Settlements", icon: BadgeIndianRupee },
  { id: "withdrawals", label: "Withdrawals", icon: Wallet },
  { id: "help", label: "Help", icon: LifeBuoy },
  { id: "reports", label: "Reports", icon: Flag },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const Avatar = ({ url, name }: { url?: string; name: string }) => (
  <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center text-sm font-bold text-zinc-300">
    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
  </div>
);

export default function AdminDashboardPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  const adminId = username?.match(
    /^admin([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  )?.[1] || "";

  const [tab, setTab] = useState<AdminTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [postReports, setPostReports] = useState<AdminPostReportRow[]>([]);
  const [userReports, setUserReports] = useState<AdminUserReportRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [settlements, setSettlements] = useState<AdminSettlementRow[]>([]);
  const [verifications, setVerifications] = useState<AdminVerificationRow[]>([]);
  const [verificationView, setVerificationView] = useState<AdminVerificationRow | null>(null);
  const [verificationNote, setVerificationNote] = useState("");

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, AdminTicketRow["status"]>>({});

  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [postView, setPostView] = useState<AdminPostView | null>(null);
  const [wdView, setWdView] = useState<AdminWithdrawalRow | null>(null);
  const [completeForm, setCompleteForm] = useState({
    txn: "", amount: "", note: "", slipBase64: "", slipType: "",
  });

  const isAdmin = user?.user_metadata?.role === "admin";
  const idOk = Boolean(adminId && user?.id && adminId === user.id);

  const loadTab = useCallback(async (active: AdminTab) => {
    setError("");
    setBusy(true);
    try {
      if (active === "overview") {
        const r = await getAdminStats();
        if (r.error) setError(r.error);
        else setStats(r.stats || null);
      } else if (active === "users") {
        const r = await getAdminUsers();
        if (r.error) setError(r.error);
        else setUsers(r.users || []);
      } else if (active === "posts") {
        const r = await getAdminPosts();
        if (r.error) setError(r.error);
        else setPosts(r.posts || []);
      } else if (active === "payments") {
        const r = await getAdminPayments();
        if (r.error) setError(r.error);
        else setPayments(r.payments || []);
      } else if (active === "settlements") {
        const r = await getAdminSettlements();
        if (r.error) setError(r.error);
        else setSettlements(r.settlements || []);
      } else if (active === "help") {
        const r = await getAdminTickets();
        if (r.error) setError(r.error);
        else {
          const rows = r.tickets || [];
          setTickets(rows);
          const replies: Record<string, string> = {};
          const statuses: Record<string, AdminTicketRow["status"]> = {};
          for (const t of rows) {
            replies[t.id] = t.admin_reply || "";
            statuses[t.id] = t.status;
          }
          setReplyDrafts(replies);
          setStatusDrafts(statuses);
        }
      } else if (active === "reports") {
        const [pr, ur] = await Promise.all([getAdminPostReports(), getAdminUserReports()]);
        if (pr.error || ur.error) setError(pr.error || ur.error || "Failed to load reports");
        else {
          setPostReports(pr.reports || []);
          setUserReports(ur.reports || []);
        }
      } else if (active === "withdrawals") {
        const r = await getAdminWithdrawals();
        if (r.error) setError(r.error);
        else setWithdrawals(r.withdrawals || []);
      } else if (active === "verification") {
        const r = await getAdminVerifications();
        if (r.error) setError(r.error);
        else setVerifications(r.verifications || []);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAdmin && idOk) loadTab(tab);
  }, [loading, isAdmin, idOk, tab, loadTab]);

  const handleLogout = async () => {
    await signOut();
    navigate("/adminlogin", { replace: true });
  };

  const openUser = async (id: string) => {
    setBusy(true);
    const r = await getAdminUserDetail(id);
    setBusy(false);
    if (r.error) setError(r.error);
    else setUserDetail(r.user || null);
  };

  const openPost = async (publicId: string) => {
    setBusy(true);
    const r = await getAdminPostView(publicId);
    setBusy(false);
    if (r.error) setError(r.error);
    else setPostView(r.post || null);
  };

  const handleDeletePost = async (publicId: string) => {
    if (!window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    const r = await adminDeletePost(publicId);
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setPostView(null);
      loadTab("posts");
    }
  };

  const handleSaveTicket = async (ticket: AdminTicketRow) => {
    setBusy(true);
    const r = await adminUpdateTicket(
      ticket.id,
      statusDrafts[ticket.id] || ticket.status,
      replyDrafts[ticket.id] || "",
    );
    setBusy(false);
    if (r.error) setError(r.error);
    else loadTab("help");
  };

  const handleAcceptWd = async (id: string) => {
    setBusy(true);
    const r = await adminProcessWithdrawal(id, "accepted");
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      await loadTab("withdrawals");
      const refreshed = await getAdminWithdrawals();
      const row = refreshed.withdrawals?.find((w) => w.id === id);
      if (row) {
        setWdView(row);
        setCompleteForm({
          txn: "",
          amount: String(row.net_payout ?? row.amount),
          note: "",
          slipBase64: "",
          slipType: "",
        });
      }
    }
  };

  const handleRejectWd = async (id: string) => {
    if (!window.confirm("Reject this withdrawal request?")) return;
    setBusy(true);
    const r = await adminProcessWithdrawal(id, "rejected");
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setWdView(null);
      loadTab("withdrawals");
    }
  };

  const handleCompleteWd = async () => {
    if (!wdView) return;
    const amount = Number(completeForm.amount);
    if (!completeForm.txn.trim()) {
      setError("Transaction ID is required");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid transferred amount");
      return;
    }
    setBusy(true);
    const r = await adminCompleteWithdrawal({
      withdrawal_id: wdView.id,
      transfer_txn_id: completeForm.txn.trim(),
      transfer_amount: amount,
      note: completeForm.note.trim(),
      slip_base64: completeForm.slipBase64 || undefined,
      slip_content_type: completeForm.slipType || undefined,
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setWdView(null);
      loadTab("withdrawals");
    }
  };

  const onSlipFile = async (file: File | null) => {
    if (!file) {
      setCompleteForm((f) => ({ ...f, slipBase64: "", slipType: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setCompleteForm((f) => ({
        ...f,
        slipBase64: result,
        slipType: file.type || "image/jpeg",
      }));
    };
    reader.readAsDataURL(file);
  };

  const activeLabel = useMemo(() => TABS.find((t) => t.id === tab)?.label || "Admin", [tab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/adminlogin" replace />;
  if (!idOk) return <Navigate to={`/admin${user.id}`} replace />;

  const StatCard = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-zinc-800 bg-zinc-900/50 p-4">
        <BrandLogo className="h-8 w-auto mb-8" />
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-rose-500/15 text-rose-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <button type="button" onClick={() => setMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-zinc-800" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500">MalluCupid Admin</p>
            <h1 className="font-bold text-white truncate">{activeLabel}</h1>
          </div>
          <button type="button" onClick={() => loadTab(tab)} disabled={busy} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400" aria-label="Refresh">
            <RefreshCw className={`w-5 h-5 ${busy ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={handleLogout} className="lg:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400" aria-label="Sign out">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <BrandLogo className="h-8 w-auto" />
                <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800"><X className="w-5 h-5" /></button>
              </div>
              <nav className="space-y-1 flex-1 overflow-y-auto">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                        tab === t.id ? "bg-rose-500/15 text-rose-300" : "text-zinc-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 max-w-6xl w-full mx-auto">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
          )}

          {tab === "overview" && stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <StatCard label="Accounts" value={stats.users} />
              <StatCard label="Creators" value={stats.creators} />
              <StatCard label="Posts" value={stats.posts} />
              <StatCard label="Open tickets" value={stats.open_tickets} />
              <StatCard label="Post reports" value={stats.post_reports} />
              <StatCard label="User reports" value={stats.user_reports} />
              <StatCard label="Pending payouts" value={stats.pending_withdrawals} />
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3 items-start">
                  <Avatar url={u.avatar_url} name={u.name || u.email} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{u.name || u.email || u.id.slice(0, 8)}</p>
                    <p className="text-sm text-zinc-400 truncate">{u.email}</p>
                    {u.username ? <p className="text-xs text-zinc-500 mt-1">@{u.username}</p> : null}
                    <p className="text-xs text-zinc-600 mt-1">{fmtDate(u.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-zinc-800 text-zinc-300">{u.role}</span>
                    <button type="button" onClick={() => openUser(u.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 text-sm font-semibold text-zinc-200 hover:bg-zinc-700">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </div>
                </div>
              ))}
              {!users.length && !busy && <p className="text-zinc-500 text-center py-12">No users yet.</p>}
            </div>
          )}

          {tab === "posts" && (
            <div className="space-y-3">
              {posts.map((p) => (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{p.caption || "(no caption)"}</p>
                      <p className="text-sm text-zinc-400">
                        @{p.creator_username || "unknown"} · {p.media_type}
                        {p.is_paid ? ` · ₹${p.price}` : " · free"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {p.like_count} likes · {p.view_count} views · {fmtDate(p.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openPost(p.public_id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-semibold hover:bg-zinc-700">
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button type="button" onClick={() => handleDeletePost(p.public_id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-300 text-sm font-semibold hover:bg-red-500/20">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!posts.length && !busy && <p className="text-zinc-500 text-center py-12">No posts yet.</p>}
            </div>
          )}

          {tab === "verification" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 mb-2">
                First submit auto-verifies. After suspend: 3 auto re-verifies, then pending needs Approve. Suspend locks public posts and Exclusive Rooms.
              </p>
              {verifications.map((v) => (
                <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <Avatar url={v.avatar_url} name={v.username || v.legal_full_name} />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">@{v.username || "creator"}</p>
                        <p className="text-sm text-zinc-300">{v.legal_full_name}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          DOB {v.date_of_birth} · ID {v.public_id} · {fmtDate(v.submitted_at)}
                          {typeof v.auto_reverify_count === "number" ? ` · re-verifies ${v.auto_reverify_count}/3` : ""}
                        </p>
                        <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${
                          v.status === "pending"
                            ? "bg-violet-500/15 text-violet-300"
                            : v.badge_active
                              ? "bg-sky-500/15 text-sky-300"
                              : v.status === "rejected"
                                ? "bg-red-500/15 text-red-300"
                                : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {v.status === "pending"
                            ? "Needs approval"
                            : v.badge_active
                              ? "Badge active"
                              : v.status === "rejected"
                                ? "Rejected"
                                : "Suspended"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true);
                        const r = await getAdminVerificationDetail(v.id);
                        setBusy(false);
                        if (r.error) setError(r.error);
                        else {
                          setVerificationView(r.verification || null);
                          setVerificationNote(r.verification?.admin_note || "");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-semibold hover:bg-zinc-700"
                    >
                      <Eye className="w-4 h-4" /> Review
                    </button>
                  </div>
                </div>
              ))}
              {!verifications.length && !busy && <p className="text-zinc-500 text-center py-12">No verification submissions yet.</p>}
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 mb-2">All paid unlocks. Amounts become withdrawable 24 hours after payment.</p>
              {payments.map((p) => (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-bold text-white flex items-center gap-1"><IndianRupee className="w-4 h-4" />{p.amount}</p>
                      <p className="text-sm text-zinc-400">@{p.creator_username} · buyer {p.buyer_name || "—"}</p>
                      <p className="text-xs text-zinc-500 mt-1 truncate max-w-md">{p.post_caption || p.post_public_id}</p>
                      <p className="text-xs text-zinc-600 mt-1">{p.paid_at ? fmtDate(p.paid_at) : "—"} · {p.razorpay_payment_id || "no txn"}</p>
                    </div>
                    <span className={`px-2.5 py-1 h-fit rounded-full text-xs font-bold ${p.withdrawable ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {p.withdrawable ? "Withdrawable" : "24h hold"}
                    </span>
                  </div>
                </div>
              ))}
              {!payments.length && !busy && <p className="text-zinc-500 text-center py-12">No payments yet.</p>}
            </div>
          )}

          {tab === "settlements" && (
            <div className="space-y-3">
              {settlements.map((s) => (
                <div key={s.creator_id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3">
                  <Avatar url={s.avatar_url} name={s.username || s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">@{s.username || "creator"}</p>
                    <p className="text-sm text-zinc-400">{s.name || s.email}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="bg-zinc-950 rounded-xl p-2">
                        <p className="text-[10px] uppercase text-zinc-500">Earnings</p>
                        <p className="font-bold text-white text-sm">₹{s.total_earnings}</p>
                      </div>
                      <div className="bg-zinc-950 rounded-xl p-2">
                        <p className="text-[10px] uppercase text-zinc-500">Settled</p>
                        <p className="font-bold text-emerald-300 text-sm">₹{s.total_settled}</p>
                      </div>
                      <div className="bg-zinc-950 rounded-xl p-2">
                        <p className="text-[10px] uppercase text-zinc-500">To settle</p>
                        <p className="font-bold text-rose-300 text-sm">₹{s.balance_to_settle}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!settlements.length && !busy && <p className="text-zinc-500 text-center py-12">No creators yet.</p>}
            </div>
          )}

          {tab === "withdrawals" && (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <Avatar url={w.creator_avatar_url} name={w.creator_username || w.creator_name} />
                      <div>
                        <p className="font-bold text-white">₹{w.amount}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {w.fee_percent != null
                            ? `Fee ${w.fee_percent}% ₹${w.platform_fee ?? 0} · Pay ₹${w.net_payout ?? w.amount}`
                            : null}
                        </p>
                        <p className="text-sm text-zinc-400">@{w.creator_username || "creator"} · {w.creator_email}</p>
                        <p className="text-xs text-zinc-500 mt-1">{fmtDate(w.created_at)} · {w.status}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => {
                        setWdView(w);
                        setCompleteForm({
                          txn: w.transfer_txn_id || "",
                          amount: String(w.transfer_amount ?? w.net_payout ?? w.amount),
                          note: w.note || "",
                          slipBase64: "",
                          slipType: "",
                        });
                      }} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-800 text-sm font-semibold">
                        <Eye className="w-4 h-4" /> View
                      </button>
                      {(w.status === "pending") && (
                        <button type="button" onClick={() => handleAcceptWd(w.id)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-sm font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Accept
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!withdrawals.length && !busy && <p className="text-zinc-500 text-center py-12">No withdrawals.</p>}
            </div>
          )}

          {tab === "help" && (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{t.subject}</p>
                      <p className="text-sm text-zinc-400">{t.user_name || t.user_email}</p>
                    </div>
                    <select
                      value={statusDrafts[t.id] || t.status}
                      onChange={(e) => setStatusDrafts((s) => ({ ...s, [t.id]: e.target.value as AdminTicketRow["status"] }))}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{t.message}</p>
                  <textarea
                    value={replyDrafts[t.id] ?? ""}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                    placeholder="Admin reply (visible to user)"
                    rows={3}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                  <button type="button" onClick={() => handleSaveTicket(t)} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold">
                    Save reply
                  </button>
                </div>
              ))}
              {!tickets.length && !busy && <p className="text-zinc-500 text-center py-12">No support tickets.</p>}
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3">Post reports</h2>
                <div className="space-y-3">
                  {postReports.map((r) => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <p className="font-semibold text-white">{r.reason}</p>
                      <p className="text-sm text-zinc-400">Post {r.post_public_id} by @{r.owner_username} · reported by @{r.reporter_username}</p>
                      {r.details ? <p className="text-sm text-zinc-300 mt-2">{r.details}</p> : null}
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => openPost(r.post_public_id)} className="text-xs font-semibold text-rose-300">View post</button>
                        <span className="text-xs text-zinc-600">{fmtDate(r.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {!postReports.length && <p className="text-zinc-500 text-sm">No post reports.</p>}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3">User reports</h2>
                <div className="space-y-3">
                  {userReports.map((r) => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                      <p className="font-semibold text-white">{r.reason}</p>
                      <p className="text-sm text-zinc-400">@{r.reporter_username} reported @{r.reported_username}</p>
                      {r.details ? <p className="text-sm text-zinc-300 mt-2">{r.details}</p> : null}
                      <p className="text-xs text-zinc-600 mt-2">{fmtDate(r.created_at)}</p>
                    </div>
                  ))}
                  {!userReports.length && <p className="text-zinc-500 text-sm">No user reports.</p>}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* User profile modal */}
      {userDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70" onClick={() => setUserDetail(null)}>
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <Avatar url={userDetail.avatar_url} name={userDetail.name} />
                <div>
                  <p className="font-bold text-white text-lg">{userDetail.name || "—"}</p>
                  <p className="text-sm text-zinc-400">{userDetail.username ? `@${userDetail.username}` : "no username"}</p>
                </div>
              </div>
              <button onClick={() => setUserDetail(null)} className="p-2 rounded-lg hover:bg-zinc-800"><X className="w-5 h-5" /></button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><dt className="text-zinc-500 text-xs">Email</dt><dd className="text-white break-all">{userDetail.email || "—"}</dd></div>
              <div><dt className="text-zinc-500 text-xs">Role</dt><dd className="text-white uppercase">{userDetail.role}</dd></div>
              <div><dt className="text-zinc-500 text-xs">Joined</dt><dd className="text-white">{fmtDate(userDetail.joined_at)}</dd></div>
              <div><dt className="text-zinc-500 text-xs">Posts</dt><dd className="text-white">{userDetail.post_count}</dd></div>
              <div><dt className="text-zinc-500 text-xs">Followers</dt><dd className="text-white">{userDetail.followers_count}</dd></div>
              <div className="col-span-2"><dt className="text-zinc-500 text-xs">Total earnings</dt><dd className="text-white font-bold text-lg">₹{userDetail.total_earnings}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {/* Post view modal */}
      {postView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80" onClick={() => setPostView(null)}>
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <p className="font-bold text-white">@{postView.creator.username}</p>
                <p className="text-xs text-zinc-500">{postView.media_type} · {postView.is_paid ? `₹${postView.price}` : "free"}</p>
              </div>
              <button onClick={() => setPostView(null)} className="p-2 rounded-lg hover:bg-zinc-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-black min-h-[200px] flex items-center justify-center">
              {postView.media_type === "video" ? (
                <video src={postView.media_urls[0]} controls className="max-w-full max-h-[60vh]" playsInline />
              ) : (
                <div className="w-full space-y-2 p-2">
                  {postView.media_urls.map((url) => (
                    <img key={url} src={url} alt="" className="w-full max-h-[60vh] object-contain" />
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 space-y-2 border-t border-zinc-800">
              <p className="text-sm text-zinc-300">{postView.caption || "(no caption)"}</p>
              <p className="text-xs text-zinc-500">{postView.like_count} likes · {postView.view_count} views · {fmtDate(postView.created_at)}</p>
              <button type="button" onClick={() => handleDeletePost(postView.public_id)} className="w-full py-2.5 rounded-xl bg-red-500/15 text-red-300 font-bold text-sm">
                Delete post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal view / complete modal */}
      {wdView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70" onClick={() => setWdView(null)}>
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white text-xl">₹{wdView.amount} requested</p>
                <p className="text-sm text-zinc-400">@{wdView.creator_username} · {wdView.status}</p>
                {wdView.net_payout != null && (
                  <p className="text-sm text-emerald-300 mt-1">
                    Platform fee {wdView.fee_percent ?? 0}% (₹{wdView.platform_fee ?? 0}) · Transfer ₹{wdView.net_payout}
                  </p>
                )}
              </div>
              <button onClick={() => setWdView(null)} className="p-2 rounded-lg hover:bg-zinc-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-zinc-950 rounded-2xl p-3 text-sm space-y-1">
              <p className="text-zinc-500 text-xs uppercase font-bold mb-2">Bank details</p>
              <p className="text-white">{wdView.bank?.account_holder || wdView.account_holder}</p>
              <p className="text-zinc-300">{wdView.bank?.account_number_masked || `••••${wdView.account_number_last4}`}</p>
              <p className="text-zinc-300">IFSC {wdView.bank?.ifsc || wdView.ifsc}</p>
              {(wdView.bank?.upi_id || wdView.upi_id) ? <p className="text-zinc-300">UPI {wdView.bank?.upi_id || wdView.upi_id}</p> : null}
            </div>

            {(wdView.status === "pending" || wdView.status === "accepted") && (
              <div className="space-y-3 border-t border-zinc-800 pt-4">
                <p className="text-sm font-bold text-white">Mark transfer successful</p>
                <input
                  value={completeForm.txn}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, txn: e.target.value }))}
                  placeholder="Transaction / UTR ID *"
                  className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-700 px-3 text-sm text-white"
                />
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={completeForm.amount}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Amount transferred *"
                  className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-700 px-3 text-sm text-white"
                />
                <textarea
                  value={completeForm.note}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Optional note"
                  rows={2}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
                />
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Optional transfer slip</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => onSlipFile(e.target.files?.[0] || null)} className="text-sm text-zinc-400 w-full" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {wdView.status === "pending" && (
                    <button type="button" onClick={() => handleAcceptWd(wdView.id)} className="px-4 py-2.5 rounded-xl bg-zinc-800 font-bold text-sm">Accept first</button>
                  )}
                  <button type="button" onClick={handleCompleteWd} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm">Transfer successful</button>
                  <button type="button" onClick={() => handleRejectWd(wdView.id)} className="px-4 py-2.5 rounded-xl bg-red-500/15 text-red-300 font-bold text-sm flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}

            {wdView.status === "paid" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-sm space-y-1">
                <p className="text-emerald-300 font-bold">Paid</p>
                <p className="text-zinc-300">Txn: {wdView.transfer_txn_id || "—"}</p>
                <p className="text-zinc-300">Amount: ₹{wdView.transfer_amount ?? wdView.amount}</p>
                {wdView.transfer_slip_url ? (
                  <a href={wdView.transfer_slip_url} target="_blank" rel="noreferrer" className="text-rose-300 underline text-xs">View slip</a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {verificationView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70" onClick={() => setVerificationView(null)}>
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white text-lg">@{verificationView.username}</p>
                <p className="text-sm text-zinc-400">{verificationView.legal_full_name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  DOB {verificationView.date_of_birth} · {verificationView.public_id}
                </p>
              </div>
              <button onClick={() => setVerificationView(null)} className="p-2 rounded-lg hover:bg-zinc-800"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">ID front</p>
                {verificationView.id_front_url ? (
                  <a href={verificationView.id_front_url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-[4/3]">
                    <img src={verificationView.id_front_url} alt="ID front" className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <p className="text-sm text-zinc-500">Unavailable</p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">ID back</p>
                {verificationView.id_back_url ? (
                  <a href={verificationView.id_back_url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-[4/3]">
                    <img src={verificationView.id_back_url} alt="ID back" className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <p className="text-sm text-zinc-500">Unavailable</p>
                )}
              </div>
            </div>

            <textarea
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              placeholder="Admin note (optional)"
              rows={2}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
            />

            <div className="flex flex-wrap gap-2">
              {verificationView.status === "pending" && (
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const r = await adminUpdateVerification(verificationView.id, "approve", verificationNote);
                    setBusy(false);
                    if (r.error) setError(r.error);
                    else {
                      setVerificationView(null);
                      loadTab("verification");
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve badge
                </button>
              )}
              {verificationView.badge_active ? (
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const r = await adminUpdateVerification(verificationView.id, "suspend", verificationNote);
                    setBusy(false);
                    if (r.error) setError(r.error);
                    else {
                      setVerificationView(null);
                      loadTab("verification");
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/15 text-red-300 font-bold text-sm flex items-center justify-center gap-1"
                >
                  <XCircle className="w-4 h-4" /> Suspend badge
                </button>
              ) : verificationView.status !== "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      const r = await adminUpdateVerification(verificationView.id, "restore", verificationNote);
                      setBusy(false);
                      if (r.error) setError(r.error);
                      else {
                        setVerificationView(null);
                        loadTab("verification");
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Restore badge
                  </button>
                  {verificationView.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true);
                        const r = await adminUpdateVerification(verificationView.id, "reject", verificationNote);
                        setBusy(false);
                        if (r.error) setError(r.error);
                        else {
                          setVerificationView(null);
                          loadTab("verification");
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm"
                    >
                      Reject
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const r = await adminUpdateVerification(verificationView.id, "reject", verificationNote);
                    setBusy(false);
                    if (r.error) setError(r.error);
                    else {
                      setVerificationView(null);
                      loadTab("verification");
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-500/15 text-red-300 font-bold text-sm flex items-center justify-center gap-1"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
