import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Wallet, Landmark, IndianRupee, AlertCircle, CheckCircle2, Loader2, ShoppingBag, Pencil } from "lucide-react";
import {
  getWallet, savePayoutAccount, requestWithdraw,
  type PayoutAccount, type WalletSale, type WalletWithdrawal,
} from "../lib/auth";

const formatInr = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WalletPage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [sales, setSales] = useState<WalletSale[]>([]);
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawal[]>([]);
  const [available, setAvailable] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [held, setHeld] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [minWithdraw, setMinWithdraw] = useState(100);
  const [feePercent, setFeePercent] = useState(0);
  const [previewFee, setPreviewFee] = useState(0);
  const [previewNet, setPreviewNet] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [form, setForm] = useState({ account_holder: "", account_number: "", ifsc: "", upi_id: "" });

  const load = useCallback(async () => {
    const response = await getWallet();
    if (response.error) {
      setError(response.error);
      setIsLoading(false);
      return;
    }
    setAvailable(response.available_balance || 0);
    setLifetime(response.lifetime_earnings || 0);
    setHeld(response.held_balance || 0);
    setSalesCount(response.sales_count || 0);
    setMinWithdraw(response.min_withdraw || 100);
    setFeePercent(response.platform_fee_percent ?? response.withdraw_preview?.fee_percent ?? 0);
    setPreviewFee(response.withdraw_preview?.platform_fee ?? 0);
    setPreviewNet(response.withdraw_preview?.net_payout ?? response.available_balance ?? 0);
    setSales(response.sales || []);
    setWithdrawals(response.withdrawals || []);
    if (response.account) {
      setAccount(response.account);
      setForm({
        account_holder: response.account.account_holder,
        account_number: "",
        ifsc: response.account.ifsc,
        upi_id: response.account.upi_id,
      });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setIsSaving(true);
    const response = await savePayoutAccount(form);
    setIsSaving(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    if (response.account) {
      setAccount(response.account);
      setIsEditing(false);
      setSaved(true);
      setForm((f) => ({ ...f, account_number: "" }));
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleWithdraw = async () => {
    setError("");
    setWithdrawMsg("");
    if (!account?.has_account) {
      setError("Add bank details before withdrawing");
      setIsEditing(true);
      return;
    }
    if (available < minWithdraw) {
      setError(`Minimum withdrawal is ₹${minWithdraw}`);
      return;
    }
    setIsWithdrawing(true);
    const response = await requestWithdraw(available);
    setIsWithdrawing(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    setWithdrawMsg(
      response.withdrawal?.net_payout != null
        ? `Withdrawal requested. Platform fee ₹${Number(response.withdrawal.platform_fee || 0).toFixed(2)}; you receive ₹${Number(response.withdrawal.net_payout).toFixed(2)} after review.`
        : "Withdrawal requested. Funds will be sent to your bank after review.",
    );
    await load();
  };

  const showForm = isEditing || (!isLoading && !account?.has_account);

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 pb-16 md:py-10">
      <div className="max-w-xl mx-auto px-4 md:px-0 pt-3 md:pt-0">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(`/${username}`)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-zinc-900" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">Wallet</h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {withdrawMsg && (
          <div className="mb-4 bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {withdrawMsg}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-rose-500/20 mb-4"
        >
          <div className="flex items-center gap-2 text-rose-100 text-sm font-medium mb-1">
            <Wallet className="w-4 h-4" /> Available balance
          </div>
          <div className="text-4xl font-bold mb-5">
            {isLoading ? "…" : formatInr(available)}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-rose-100">
              Min ₹{minWithdraw}
              {held > 0 ? ` · ₹${held.toFixed(0)} unlocking in 24h` : " · sales unlock after 24h"}
              {feePercent > 0 ? ` · ${feePercent}% platform fee` : ""}
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isLoading || isWithdrawing || available < minWithdraw}
              className="px-5 py-2.5 bg-white/95 text-rose-600 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isWithdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
              Withdraw
            </button>
          </div>
          {!isLoading && available >= minWithdraw && feePercent > 0 && (
            <div className="mt-4 pt-3 border-t border-white/20 text-xs text-rose-50/95 space-y-1">
              <div className="flex justify-between gap-3"><span>Withdraw</span><span>{formatInr(available)}</span></div>
              <div className="flex justify-between gap-3"><span>Platform fee ({feePercent}%)</span><span>−{formatInr(previewFee)}</span></div>
              <div className="flex justify-between gap-3 font-semibold"><span>You receive</span><span>{formatInr(previewNet)}</span></div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
            <div className="text-xs text-zinc-500 font-medium mb-1">Content sales</div>
            <div className="text-2xl font-bold text-zinc-900">{isLoading ? "…" : salesCount}</div>
          </div>
          <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
            <div className="text-xs text-zinc-500 font-medium mb-1">Lifetime earnings</div>
            <div className="text-2xl font-bold text-zinc-900">{isLoading ? "…" : formatInr(lifetime)}</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-sm mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-zinc-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-rose-500" /> Bank details
            </h2>
            {account?.has_account && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-rose-500 hover:text-rose-600 text-sm font-bold flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>

          {saved && (
            <div className="mb-4 bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Bank details saved.
            </div>
          )}

          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-rose-500 animate-spin" /></div>
          ) : showForm ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-1.5">Account holder name</label>
                <input
                  type="text"
                  value={form.account_holder}
                  onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="Name as per bank account"
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 block mb-1.5">Account number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, "") })}
                  required
                  maxLength={18}
                  placeholder={account?.has_account ? `Re-enter (saved ${account.account_number_masked})` : "9-18 digit account number"}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 block mb-1.5">IFSC code</label>
                  <input
                    type="text"
                    value={form.ifsc}
                    onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                    required
                    maxLength={11}
                    placeholder="SBIN0001234"
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 block mb-1.5">UPI ID (optional)</label>
                  <input
                    type="text"
                    value={form.upi_id}
                    onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                    placeholder="name@bank"
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-zinc-50 focus:bg-white outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                {account?.has_account && (
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setError(""); }}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-rose-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save bank details
                </button>
              </div>
            </form>
          ) : account ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Account holder</span><span className="font-semibold text-zinc-900">{account.account_holder}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Account number</span><span className="font-semibold text-zinc-900">{account.account_number_masked}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">IFSC</span><span className="font-semibold text-zinc-900">{account.ifsc}</span></div>
              {account.upi_id && <div className="flex justify-between"><span className="text-zinc-500">UPI ID</span><span className="font-semibold text-zinc-900">{account.upi_id}</span></div>}
            </div>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-sm mb-4"
        >
          <h2 className="font-bold text-zinc-900 flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-rose-500" /> Content sales
          </h2>
          {sales.length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-3 text-rose-400">
                <IndianRupee className="w-7 h-7" />
              </div>
              <p className="text-zinc-900 font-semibold text-sm mb-1">No sales yet</p>
              <p className="text-zinc-500 text-xs max-w-[240px]">When fans unlock your paid posts, every sale will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {sales.map((sale) => (
                <li key={sale.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {sale.caption || `Post ${sale.post_public_id}`}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {sale.paid_at ? new Date(sale.paid_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 shrink-0">{formatInr(sale.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {withdrawals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-sm"
          >
            <h2 className="font-bold text-zinc-900 mb-4">Withdrawals</h2>
            <ul className="divide-y divide-zinc-100">
              {withdrawals.map((w) => (
                <li key={w.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{formatInr(w.amount)}</p>
                    <p className="text-xs text-zinc-500">
                      {w.net_payout != null
                        ? `Fee ${formatInr(w.platform_fee || 0)} · Net ${formatInr(w.net_payout)} · `
                        : ""}
                      {new Date(w.created_at).toLocaleString()} · ••••{w.account_number_last4}
                    </p>
                  </div>
                  <span className={`text-xs font-bold uppercase ${
                    w.status === "paid" ? "text-emerald-600" : w.status === "rejected" ? "text-red-500" : "text-amber-600"
                  }`}>{w.status}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}
