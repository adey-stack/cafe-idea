import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Printer, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, BACKEND_URL, money, timeAgo } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const COLUMNS = [
  { key: "pending", label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { key: "confirmed", label: "Confirmed", color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "preparing", label: "Preparing", color: "text-brand", bg: "bg-brand/10" },
  { key: "ready", label: "Ready", color: "text-ok", bg: "bg-ok/10" },
  { key: "served", label: "Served", color: "text-neutral-400", bg: "bg-surface2" },
];

const NEXT_STATUS = { pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "served" };

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 220);
  } catch {}
}

function printReceipt(order) {
  const w = window.open("", "_blank", "width=340,height=600");
  if (!w) return;
  w.document.write(`<pre style="font-family: monospace; padding: 12px">
=========================
  EMBER & OAK
=========================
Order: ${order.order_number}
Table: ${order.table_number}
${new Date(order.created_at).toLocaleString()}
-------------------------
${order.items.map(i => `${i.quantity} x ${i.name}  ₹${i.line_total}`).join("\n")}
-------------------------
TOTAL: ₹${order.total_amount}
${order.special_instructions ? "\nNotes: " + order.special_instructions : ""}
=========================
   Thank you!
</pre><script>window.print();</script>`);
}

export default function LiveOrders() {
  const { user } = useAuth();
  const rid = user?.restaurant_id;
  const [orders, setOrders] = useState([]);
  const [tableFilter, setTableFilter] = useState("");
  const [newIds, setNewIds] = useState(new Set());
  const wsRef = useRef(null);

  useEffect(() => {
    if (!rid) return;
    const load = () => api.get("/orders").then((r) => setOrders(r.data)).catch(() => {});
    load();
    const poll = setInterval(load, 30000);
    const wsUrl = `${BACKEND_URL.replace(/^http/, "ws")}/ws/${rid}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "new_order") {
          beep();
          toast.success(`New order · Table ${m.order.table_number}`);
          setNewIds((s) => new Set(s).add(m.order.id));
          setTimeout(() => setNewIds((s) => { const n = new Set(s); n.delete(m.order.id); return n; }), 4000);
          setOrders((prev) => [m.order, ...prev.filter((o) => o.id !== m.order.id)]);
        } else if (m.type === "order_status_changed") {
          setOrders((prev) => prev.map((o) => (o.id === m.order.id ? m.order : o)));
        }
      } catch {}
    };
    return () => { clearInterval(poll); ws.close(); };
  }, [rid]);

  const advance = async (order) => {
  const next = NEXT_STATUS[order.status];
  if (!next) return;
  setOrders((prev) =>
    prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
  );
  try {
    await api.patch(`/orders/${order.id}/status`, { status: next });
    toast.success(`Moved to ${next}`);
  } catch {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o))
    );
    toast.error("Failed to update");
  }
};
  const visible = orders.filter((o) => !tableFilter || String(o.table_number) === String(tableFilter));
  const byStatus = (k) => visible.filter((o) => o.status === k);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Kitchen Console</div>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1">Live Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            data-testid="table-filter"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="Filter by table #"
            className="bg-surface border border-surface2 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = byStatus(col.key);
          return (
            <div key={col.key} className="bg-surface/50 rounded-2xl border border-surface2 p-3 min-h-[60vh] flex flex-col">
              <div className="flex items-center justify-between px-2 pb-3 border-b border-surface2 mb-3">
                <div className={`text-xs uppercase tracking-[0.2em] font-bold ${col.color}`}>{col.label}</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bg} ${col.color}`}>{items.length}</span>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                <AnimatePresence>
                  {items.map((o) => (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                         
                      className={`bg-ink rounded-xl border ${newIds.has(o.id) ? "border-brand pulse-orange" : "border-surface2"} p-3`}
                      data-testid={`order-card-${o.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-display font-bold text-sm">Table {o.table_number}</div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">{o.order_number}</div>
                        </div>
                        <div className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(o.created_at)}</div>
                      </div>
                      <ul className="text-xs space-y-0.5 mb-2">
                        {o.items.map((it) => (
                          <li key={it.id} className="flex justify-between text-neutral-300">
                            <span>{it.quantity}× {it.name}</span>
                          </li>
                        ))}
                      </ul>
                      {o.special_instructions && (
                        <div className="text-[11px] bg-brand/5 border border-brand/20 text-brand rounded-md p-1.5 mb-2">
                          {o.special_instructions}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface2">
                        <div className="font-num font-bold">{money(o.total_amount)}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => printReceipt(o)} className="w-7 h-7 rounded-lg bg-surface2 hover:bg-surface flex items-center justify-center" data-testid={`print-${o.id}`}>
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {NEXT_STATUS[o.status] && (
                            <button
                              data-testid={`advance-${o.id}`}
                              onClick={() => advance(o)}
                              className="bg-brand hover:bg-brand-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-all active:scale-95"
                            >
                              Next <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {items.length === 0 && <div className="text-center text-neutral-600 text-xs py-8">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
