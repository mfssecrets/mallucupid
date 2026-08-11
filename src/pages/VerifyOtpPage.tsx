import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyOtp, resendOtp } from "../lib/auth";
import { useAuth } from "../lib/useAuth";

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();
  const email: string | undefined = location.state?.email;

  useEffect(() => {
    if (!email) navigate('/signup', { replace: true });
  }, [email, navigate]);

  const handleResend = async () => {
    if (!email || isResending) return;
    setError(null);
    setIsResending(true);
    const response = await resendOtp(email);
    setIsResending(false);
    if (response?.error) {
      setError(response.error || 'Failed to resend code');
      return;
    }
    setTimeLeft(45);
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return; // Allow only single character
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.every(digit => digit !== "")) return;
    
    setError(null);
    setIsLoading(true);

    const otpCode = otp.join("");
    
    (async () => {
      if (!email) return;
      const response = await verifyOtp(email, otpCode);
      setIsLoading(false);
      if (response?.error) {
        setError(response.error || 'Invalid verification code');
        return;
      }
      await refreshSession();
      setSuccess('Verification successful! Redirecting...');
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1500);
    })();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-8 sm:p-10"
    >
      <div className="text-center mb-10">
        <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-3xl font-display font-bold text-zinc-900 mb-2">Verify Email</h1>
        <p className="text-zinc-500">We've sent a 6-digit code to your email</p>
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

      <form onSubmit={handleVerify} className="space-y-8">
        <div className="flex justify-center gap-2 sm:gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading || !!success}
              className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
          ))}
        </div>

        <button 
          type="submit"
          disabled={!otp.every(d => d) || isLoading || !!success}
          className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verify & Continue
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        {timeLeft > 0 ? (
          <p className="text-sm text-zinc-500">
            Resend code in <span className="font-bold text-zinc-900">00:{timeLeft.toString().padStart(2, '0')}</span>
          </p>
        ) : (
          <button 
            onClick={handleResend}
            disabled={isLoading || isResending || !!success}
            className="text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? 'Sending...' : 'Resend Code'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
