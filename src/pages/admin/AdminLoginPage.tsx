import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, Loader2, AlertCircle, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../../lib/admin";
import { useAuth } from "../../lib/useAuth";
import { BrandLogo } from "../../components/BrandMark";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, loading, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user?.user_metadata?.role === "admin" && user.id) {
      navigate(`/admin${user.id}`, { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setIsLoading(true);
    const response = await adminLogin(email.trim(), password);
    setIsLoading(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    await refreshSession();
    const path = response.redirect_path || (response.admin_id ? `/admin${response.admin_id}` : "");
    if (path) navigate(path, { replace: true });
    else setError("Login succeeded but admin route was missing.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 sm:p-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandLogo className="h-12 w-auto" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold mb-3">
            <Shield className="w-3.5 h-3.5" /> Admin console
          </div>
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-zinc-400 text-sm mt-1">Platform operations only</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl flex items-center gap-2 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                placeholder="admin@company.com"
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>
      </motion.div>
    </div>
  );
}
