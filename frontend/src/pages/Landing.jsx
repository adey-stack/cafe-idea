import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QrCode, ArrowRight, Flame } from "lucide-react";
import { api } from "../lib/api";

export default function Landing() {
  const [rid, setRid] = useState("");
  useEffect(() => {
    api.get("/restaurants/default").then((r) => setRid(r.data.id)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-ink text-white relative overflow-hidden grain">
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{ background: "radial-gradient(600px 400px at 85% -10%, rgba(255,107,0,0.25), transparent 60%), radial-gradient(500px 300px at 10% 110%, rgba(255,107,0,0.18), transparent 60%)" }}
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-16">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-brand" strokeWidth={2.5} />
          <span className="font-display font-black tracking-tight text-lg">Ember & Oak</span>
        </div>
        <Link
          to="/admin/login"
          data-testid="landing-admin-link"
          className="text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
        >
          Admin login →
        </Link>
      </header>

      <main className="relative z-10 px-6 md:px-16 pt-10 md:pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold tracking-[0.2em] uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" /> Live Ordering System
          </div>
          <h1 className="font-display font-black tracking-tight text-4xl sm:text-5xl lg:text-7xl leading-[0.95]">
            Scan the table.<br />
            <span className="text-brand">Order in seconds.</span>
          </h1>
          <p className="mt-6 text-neutral-400 text-base md:text-lg max-w-xl leading-relaxed">
            A fully working QR ordering platform — from the dining room floor to the kitchen line. Live kanban, menu CRUD, QR generation, and realtime WebSockets.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to={rid ? `/menu?restaurant=${rid}&table=1` : "#"}
              data-testid="landing-demo-menu"
              className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white px-6 py-4 rounded-xl font-bold transition-all active:scale-95"
            >
              <QrCode className="w-5 h-5" /> Try Customer Menu · Table 1
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/admin/login"
              data-testid="landing-admin-cta"
              className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface2 border border-surface2 text-white px-6 py-4 rounded-xl font-semibold transition-all"
            >
              Open Admin Dashboard
            </Link>
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-3xl">
            {[
              { k: "Kanban", v: "Live orders flow" },
              { k: "WebSockets", v: "Instant kitchen sync" },
              { k: "QR Codes", v: "One per table · auto" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-surface/60 border border-surface2 p-5 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">{s.k}</div>
                <div className="mt-2 font-display text-xl font-bold">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-xs text-neutral-500">
            Demo login: <span className="text-neutral-300 font-mono">owner@demo.com</span> / <span className="text-neutral-300 font-mono">owner123</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
