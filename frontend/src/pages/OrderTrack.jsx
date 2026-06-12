import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { api, BACKEND_URL, money } from "../lib/api";

const STEPS = [
  { k: "pending", label: "Placed" },
  { k: "confirmed", label: "Confirmed" },
  { k: "preparing", label: "Preparing" },
  { k: "ready", label: "Ready" },
  { k: "served", label: "Served" },
];

export default function OrderTrack() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => api.get(`/orders/${orderId}`).then((r) => { if (!stop) setOrder(r.data); }).catch(() => {});
    load();
    const i = setInterval(load, 5000);
    // websocket
    let ws;
    api.get(`/orders/${orderId}`).then((r) => {
      const wsUrl = `${BACKEND_URL.replace(/^http/, "ws")}/ws/${r.data.restaurant_id}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.order?.id === orderId) setOrder(m.order);
        } catch {}
      };
    });
    return () => { stop = true; clearInterval(i); if (ws) ws.close(); };
  }, [orderId]);

  if (!order) return <div className="min-h-screen bg-ink text-white flex items-center justify-center">Loading…</div>;
  const idx = STEPS.findIndex((s) => s.k === order.status);

  return (
    <div className="min-h-screen bg-ink text-white px-6 py-10 max-w-md mx-auto">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Order {order.order_number}</div>
      <h1 className="font-display font-black text-3xl mt-1">Live tracking</h1>
      <div className="text-neutral-400 text-sm mt-1">Table {order.table_number} · {money(order.total_amount)}</div>

      <div className="mt-10 space-y-1">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <motion.div key={s.k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 py-3"
              data-testid={`track-step-${s.k}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${done ? "bg-ok border-ok" : current ? "bg-brand border-brand" : "bg-surface border-surface2"}`}>
                {done ? <Check className="w-5 h-5 text-white" strokeWidth={3} /> : current ? <Clock className="w-5 h-5 text-white animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-neutral-600" />}
              </div>
              <div>
                <div className={`font-display font-bold ${done || current ? "text-white" : "text-neutral-600"}`}>{s.label}</div>
                {current && <div className="text-xs text-brand font-bold mt-0.5">In progress…</div>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-10 bg-surface rounded-2xl border border-surface2 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold mb-3">Items</div>
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm py-1">
            <span>{it.quantity} × {it.name}</span>
            <span className="font-num text-neutral-400">{money(it.line_total)}</span>
          </div>
        ))}
        {order.special_instructions && (
          <div className="mt-3 pt-3 border-t border-surface2 text-xs text-neutral-400">
            <span className="text-neutral-500">Notes: </span>{order.special_instructions}
          </div>
        )}
      </div>
    </div>
  );
}
