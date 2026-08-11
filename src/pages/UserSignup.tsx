import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { userSignup } from "../lib/auth";
import { BrandIcon } from "../components/BrandMark";

export default function UserSignup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    const response = await userSignup(email.trim(), name.trim(), password, redirect);
    setLoading(false);
    if (response.error) return setError(response.error);
    navigate("/userotpverify", { state: { email: email.trim(), redirect } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-100/50 p-7">
        <BrandIcon size="md" className="mb-6" />
        <h1 className="text-2xl font-bold text-zinc-900">Join MalluCupid</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-7">Create a user account to connect with creators.</p>
        {error && <div className="mb-5 bg-red-50 text-red-600 rounded-xl p-3 text-sm flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Field icon={User} label="Name"><input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Your name" /></Field>
          <Field icon={Mail} label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@example.com" /></Field>
          <Field icon={Lock} label="Password">
            <input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="field pr-12" placeholder="Minimum 8 characters" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-4 bottom-3.5 text-zinc-400">{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
          </Field>
          <button disabled={loading} className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}</button>
        </form>
        <p className="text-center text-sm text-zinc-500 mt-6">Already registered? <Link to={`/userlogin?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-rose-500">Login</Link></p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return <label className="relative block"><span className="text-sm font-semibold text-zinc-800">{label}</span><Icon className="absolute left-4 bottom-3.5 w-5 h-5 text-zinc-400" /><div className="mt-2 [&_.field]:w-full [&_.field]:h-12 [&_.field]:pl-12 [&_.field]:pr-4 [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-zinc-200 [&_.field]:bg-zinc-50 [&_.field]:focus:outline-none [&_.field]:focus:border-rose-500">{children}</div></label>;
}
