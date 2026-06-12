import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { formatApiError } from "../lib/api";

export default function AdminLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState("owner123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/admin/live");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white flex items-center justify-center px-6 grain">
      <div className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: "radial-gradient(600px 400px at 50% -20%, rgba(255,107,0,0.18), transparent 60%)" }} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-surface rounded-3xl border border-surface2 p-8"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-brand" />
          </div>
          <div>
            <div className="font-display font-black text-lg leading-tight">Ember & Oak</div>
            <div className="text-xs text-neutral-500 font-bold tracking-[0.15em] uppercase">Admin Console</div>
          </div>
        </div>
        <h1 className="font-display font-black text-3xl mb-1">Welcome back</h1>
        <p className="text-neutral-400 text-sm mb-6">Sign in to manage orders, menu & tables.</p>

        <label className="block mb-3">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Email</span>
          <input
            data-testid="login-email"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="mt-1 w-full bg-ink border border-surface2 rounded-xl px-4 py-3 outline-none focus:border-brand/60 text-sm"
          />
        </label>
        <label className="block mb-6">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Password</span>
          <input
            data-testid="login-password"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="mt-1 w-full bg-ink border border-surface2 rounded-xl px-4 py-3 outline-none focus:border-brand/60 text-sm"
          />
        </label>
        <button
          data-testid="login-submit"
          type="submit" disabled={loading}
          className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3.5 rounded-xl inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" /> {loading ? "Signing in…" : "Sign in"}
        </button>
        <div className="mt-4 text-xs text-center text-neutral-500">
          Demo: <span className="text-neutral-300 font-mono">owner@demo.com / owner123</span>
        </div>
      </motion.form>
    </div>
  );
}
