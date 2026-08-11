import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { signup, checkUsername, USERNAME_REGEX } from "../lib/auth";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'validating' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [usernameMessage, setUsernameMessage] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  const localFormatError = (value: string): string | null => {
    if (value.length < 6) return 'Username must be at least 6 characters.';
    if (value.length > 25) return 'Username must be 25 characters or fewer.';
    if (!USERNAME_REGEX.test(value)) return 'Only letters, numbers, and _ . - are allowed. No spaces.';
    return null;
  };

  // Real-time availability check against the backend (debounced).
  // A username is never shown as available until the server confirms it.
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameMessage("");
      return;
    }

    const formatError = localFormatError(username);
    if (formatError) {
      setUsernameStatus('invalid');
      setUsernameMessage(formatError);
      return;
    }

    setUsernameStatus('validating');
    setUsernameMessage("");
    let cancelled = false;

    const timer = setTimeout(async () => {
      const response = await checkUsername(username);
      if (cancelled) return;
      if (response.available === true) {
        setUsernameStatus('available');
        setUsernameMessage('This username is available.');
      } else if (response.reason === 'taken') {
        setUsernameStatus('taken');
        setUsernameMessage(response.error || 'Username already taken. Choose a different one.');
      } else if (response.reason === 'invalid') {
        setUsernameStatus('invalid');
        setUsernameMessage(response.error || 'Invalid username.');
      } else {
        setUsernameStatus('error');
        setUsernameMessage('Could not check username. Check your connection and try again.');
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove spaces
    const val = e.target.value.replace(/\s/g, '');
    setUsername(val);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus !== 'available') return;
    
    setError(null);
    setSuccess(null);
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    (async () => {
      setIsLoading(true);
      const response = await signup(email, password, username);
      setIsLoading(false);
      if (response?.error) {
        setError(response.error || 'Signup failed');
        // The backend is the source of truth: reflect a taken username inline too
        if (typeof response.error === 'string' && response.error.toLowerCase().includes('taken')) {
          setUsernameStatus('taken');
          setUsernameMessage(response.error);
        }
        return;
      }
      setSuccess('Account created! Check your email to verify.');
      navigate('/verify-otp', { replace: true, state: { email } });
    })();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-rose-100/50 border border-zinc-100 p-8 sm:p-10"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-bold text-zinc-900 mb-2">Create Account</h1>
        <p className="text-zinc-500">Start monetizing your exclusive content</p>
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

      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Username</label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-zinc-400 font-medium">@</span>
            <input 
              type="text" 
              required
              value={username}
              onChange={handleUsernameChange}
              disabled={isLoading || !!success}
              className={`w-full h-12 pl-10 pr-12 rounded-xl border bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                usernameStatus === 'invalid' || usernameStatus === 'taken' 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 text-red-900' 
                  : usernameStatus === 'available'
                  ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                  : 'border-zinc-200 focus:border-rose-500 focus:ring-rose-500/20'
              }`}
              placeholder="username"
            />
            <div className="absolute right-4 flex items-center justify-center">
              {usernameStatus === 'validating' && <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />}
              {usernameStatus === 'available' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {(usernameStatus === 'invalid' || usernameStatus === 'taken') && <XCircle className="w-5 h-5 text-red-500" />}
            </div>
          </div>
          {(usernameStatus === 'invalid' || usernameStatus === 'taken' || usernameStatus === 'error') && usernameMessage && (
            <p className="text-xs text-red-500 mt-1">{usernameMessage}</p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-xs text-emerald-600 mt-1">{usernameMessage}</p>
          )}
          {usernameStatus === 'validating' && (
            <p className="text-xs text-zinc-400 mt-1">Checking availability…</p>
          )}
        </div>

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
          <p className="text-xs text-zinc-500 mt-1">Must be at least 8 characters.</p>
        </div>

        <button 
          type="submit"
          disabled={usernameStatus !== 'available' || isLoading || !!success}
          className={`group relative mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg disabled:opacity-50 disabled:pointer-events-none ${
            usernameStatus === 'available' 
              ? 'bg-rose-500 hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] shadow-rose-500/20' 
              : 'bg-rose-300 cursor-not-allowed shadow-none'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign Up
              <ArrowRight className={`w-4 h-4 transition-transform ${usernameStatus === 'available' ? 'group-hover:translate-x-1' : ''}`} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-sm text-zinc-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-rose-500 hover:text-rose-600 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
