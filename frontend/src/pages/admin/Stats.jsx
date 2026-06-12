import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { IndianRupee, ShoppingBag, Clock, TrendingUp } from "lucide-react";
import { api, money } from "../../lib/api";

function Stat({ icon: I, label, value, tint }) {
  return (
    <div className="bg-surface rounded-2xl border border-surface2 p-5">
      <div className={`w-10 h-10 rounded-xl ${tint} flex items-center justify-center mb-3`}>
        <I className="w-5 h-5" />
      </div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
      <div className="font-display font-black text-3xl mt-1 font-num">{value}</div>
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const load = () => api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  if (!stats) return <div className="text-neutral-500 text-sm">Loading…</div>;

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Today</div>
        <h1 className="font-display font-black text-3xl md:text-4xl mt-1">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={IndianRupee} label="Revenue" value={money(stats.today_revenue)} tint="bg-brand/10 text-brand" />
        <Stat icon={ShoppingBag} label="Orders" value={stats.today_orders} tint="bg-blue-500/10 text-blue-400" />
        <Stat icon={Clock} label="Pending" value={stats.pending_orders} tint="bg-yellow-500/10 text-yellow-400" />
        <Stat icon={TrendingUp} label="Top Item" value={stats.popular_items[0]?.name?.split(" ")[0] || "—"} tint="bg-ok/10 text-ok" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-surface2 p-5 lg:col-span-2">
          <div className="font-display font-bold mb-4">Orders per hour (today)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.hourly}>
              <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fill: "#737373", fontSize: 11 }} />
              <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A" }} />
              <Line type="monotone" dataKey="orders" stroke="#FF6B00" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
          <div className="font-display font-bold mb-4">Most ordered</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.popular_items} layout="vertical">
              <XAxis type="number" tick={{ fill: "#737373", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#A3A3A3", fontSize: 11 }} width={100} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A" }} />
              <Bar dataKey="count" fill="#FF6B00" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {stats.popular_items.length === 0 && <div className="text-neutral-500 text-xs text-center py-10">No data yet</div>}
        </div>
      </div>
    </div>
  );
}
