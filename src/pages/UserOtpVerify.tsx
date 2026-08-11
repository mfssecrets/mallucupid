import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { userResend, userVerify } from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { BrandIcon } from "../components/BrandMark";

export default function UserOtpVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();
  const email = location.state?.email as string | undefined;
  const redirect = (location.state?.redirect as string | undefined) || "";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(45);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!email) navigate(`/usersignup?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [email, navigate, redirect]);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const change = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError("");
    const response = await userVerify(email, otp.join(""));
    setLoading(false);
    if (response.error) return setError(response.error);
    await refreshSession();
    navigate(redirect ? `/${redirect}` : "/", { replace: true });
  };
  const resend = async () => {
    if (!email) return;
    setResending(true); setError("");
    const response = await userResend(email);
    setResending(false);
    if (response.error) return setError(response.error);
    setSeconds(45);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/50 p-7 text-center">
        <BrandIcon size="lg" className="mx-auto mb-5" rounded="rounded-2xl" />
        <h1 className="text-2xl font-bold text-zinc-900">Verify your email</h1>
        <p className="text-sm text-zinc-500 mt-2">Enter the 6-digit code sent to<br /><strong className="text-zinc-700">{email}</strong></p>
        {error && <div className="mt-5 bg-red-50 text-red-600 rounded-xl p-3 text-sm flex gap-2 text-left"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        <form onSubmit={submit} className="mt-7">
          <div className="flex gap-2 justify-center">
            {otp.map((digit, index) => <input key={index} ref={(el) => { refs.current[index] = el; }} inputMode="numeric" value={digit} onChange={(e) => change(index, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !digit && index > 0) refs.current[index - 1]?.focus(); }} className="w-10 h-12 rounded-xl border border-zinc-200 bg-zinc-50 text-center text-xl font-bold focus:outline-none focus:border-rose-500" />)}
          </div>
          <button disabled={loading || otp.some((d) => !d)} className="mt-7 w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Login"}</button>
        </form>
        <button onClick={resend} disabled={seconds > 0 || resending} className="mt-5 text-sm font-semibold text-rose-500 disabled:text-zinc-400">{resending ? "Sending…" : seconds > 0 ? `Resend in 00:${String(seconds).padStart(2, "0")}` : "Resend code"}</button>
      </div>
    </div>
  );
}
