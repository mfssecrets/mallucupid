import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowRight, ArrowLeft, Lock, EyeOff, Eye, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, resetPassword } from "../lib/auth";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    (async () => {
      setIsLoading(true);
      const response = await forgotPassword(email);
      setIsLoading(false);
      if (response?.error) {
        setError(response.error || 'Failed to send reset code');
        return;
      }
      setSuccess('Reset code sent to your email!');
      setTimeout(() => {
        setSuccess(null);
        setStep(2);
      }, 1500);
    })();
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    
    (async () => {
      setIsLoading(true);
      const response = await resetPassword(email, otp, password);
      setIsLoading(false);
      if (response?.error) {
        setError(response.error || 'Failed to reset password');
        return;
      }
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    })();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-8 sm:p-10"
    >
      <div className="mb-8">
        <button 
          onClick={() => step === 2 ? setStep(1) : navigate("/login")}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-3xl font-display font-bold text-zinc-900 mb-2">
          {step === 1 ? "Forgot Password" : "Set New Password"}
        </h1>
        <p className="text-zinc-500">
          {step === 1 
            ? "Enter your email to receive a password reset code"
            : "Enter the code sent to your email and your new password"}
        </p>
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

      {step === 1 ? (
        <form onSubmit={handleSendOtp} className="space-y-6">
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

          <button 
            type="submit"
            disabled={isLoading || !!success}
            className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send Reset Code
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Reset Code (OTP)</label>
            <input 
              type="text" 
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={isLoading || !!success}
              className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-center tracking-widest font-mono text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">New Password</label>
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
            <p className="text-xs text-zinc-500 mt-1">Must be at least 8 characters.</p>
          </div>

          <button 
            type="submit"
            disabled={isLoading || !!success}
            className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 mt-6 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Reset & Login
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      )}
    </motion.div>
  );
}
