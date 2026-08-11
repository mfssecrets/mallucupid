import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { userLogin } from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { BrandIcon } from "../components/BrandMark";

export default function UserLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshSession } = useAuth();
  const redirect = params.get("redirect") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const response = await userLogin(email.trim(), password);
    setLoading(false);
    if (response.error) return setError(response.error);
    await refreshSession();
    navigate(redirect ? `/${redirect}` : "/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/50 p-7">
        <BrandIcon size="md" className="mb-6" />
        <h1 className="text-2xl font-bold text-zinc-900">Welcome back</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-7">Login to follow, chat, and unlock content.</p>
        {error && <div className="mb-5 bg-red-50 text-red-600 rounded-xl p-3 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-zinc-800">Email</span>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 pl-12 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-rose-500" placeholder="you@example.com" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-zinc-800">Password</span>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 pl-12 pr-12 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-rose-500" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
          </label>
          <div className="text-right"><Link to={`/userpasswordreset?redirect=${encodeURIComponent(redirect)}`} className="text-sm font-semibold text-rose-500">Forgot password?</Link></div>
          <button disabled={loading} className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Login <ArrowRight className="w-4 h-4" /></>}</button>
        </form>
        <p className="text-center text-sm text-zinc-500 mt-6">New here? <Link to={`/usersignup?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-rose-500">Create account</Link></p>
      </div>
    </div>
  );
}
