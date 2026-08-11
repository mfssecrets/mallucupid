import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../lib/auth";
import { useAuth } from "../lib/useAuth";

export default function LoginPage() {
  const { refreshSession } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    (async () => {
      setIsLoading(true);
      const response = await login(email, password);
      setIsLoading(false);
      if (response?.error) {
        setError(response.error || 'Login failed');
        return;
      }
      setSuccess('Login successful! Redirecting...');
      await refreshSession();
      const username = response?.user?.user_metadata?.username;
      navigate(username ? `/${username}` : '/dashboard', { replace: true });
    })();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-8 sm:p-10"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-bold text-zinc-900 mb-2">Welcome Back</h1>
        <p className="text-zinc-500">Log in to manage your creator profile</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium overflow-hidden"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="bg-emerald-50 text-emerald-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium overflow-hidden"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || !!success}
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="creator@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type={showPassword ? "text" : "password"} 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || !!success}
              className="w-full h-12 pl-12 pr-12 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || !!success}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 pb-4">
          <Link to="/forgot-password" className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors">
            Forgot Password?
          </Link>
        </div>

        <button 
          type="submit"
          disabled={isLoading || !!success}
          className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Login
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-sm text-zinc-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-bold text-rose-500 hover:text-rose-600 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
