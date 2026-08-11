import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { userForgot, userReset } from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { BrandIcon } from "../components/BrandMark";

export default function UserPasswordReset() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshSession } = useAuth();
  const redirect = params.get("redirect") || "";
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    const response = await userForgot(email.trim(), redirect);
    setLoading(false);
    if (response.error) return setError(response.error);
    setStep(2);
  };
  const reset = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    const response = await userReset(email.trim(), otp, password);
    setLoading(false);
    if (response.error) return setError(response.error);
    await refreshSession();
    navigate(redirect ? `/${redirect}` : "/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/50 p-7">
        <BrandIcon size="md" className="mb-6" />
        <h1 className="text-2xl font-bold text-zinc-900">{step === 1 ? "Reset password" : "Create new password"}</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-7">{step === 1 ? "We'll send a 6-digit OTP to your email." : "Enter the OTP and your new password."}</p>
        {error && <div className="mb-5 bg-red-50 text-red-600 rounded-xl p-3 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        {step === 1 ? (
          <form onSubmit={send} className="space-y-5">
            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-rose-500" placeholder="you@example.com" /></div>
            <button disabled={loading} className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP"}</button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4">
            <input inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="w-full h-12 rounded-xl border border-zinc-200 bg-zinc-50 text-center tracking-[0.45em] text-lg font-bold focus:outline-none focus:border-rose-500" placeholder="000000" />
            <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" /><input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 pl-12 pr-12 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-rose-500" placeholder="New password" /><button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div>
            <button disabled={loading} className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset & Login"}</button>
          </form>
        )}
        <p className="text-center mt-6"><Link to={`/userlogin?redirect=${encodeURIComponent(redirect)}`} className="text-sm font-bold text-rose-500">Back to user login</Link></p>
      </div>
    </div>
  );
}
