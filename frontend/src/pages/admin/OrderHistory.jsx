import React, { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api, money } from "../../lib/api";

const STATUSES = ["all", "pending", "confirmed", "preparing", "ready", "served", "cancelled"];

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");

  useEffect(() => {
    const params = {};
    if (status !== "all") params.status = status;
    if (date) params.date = date;
    api.get("/orders", { params }).then((r) => setOrders(r.data)).catch(() => {});
  }, [status, date]);

  const revenue = useMemo(
    () => orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total_amount, 0),
    [orders]
  );

  const exportCsv = () => {
    const rows = [["Order", "Table", "Status", "Total", "Created", "Items"]];
    orders.forEach((o) => {
      rows.push([
        o.order_number, o.table_number, o.status, o.total_amount, o.created_at,
        o.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${date || "all"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Archive</div>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1">Order History</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            data-testid="filter-date"
            className="bg-surface border border-surface2 rounded-lg px-3 py-2 text-sm outline-none" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            data-testid="filter-status"
            className="bg-surface border border-surface2 rounded-lg px-3 py-2 text-sm outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv} data-testid="export-csv"
            className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-sm">
        <div className="bg-surface rounded-xl border border-surface2 px-4 py-3">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Total Revenue</div>
          <div className="font-num font-black text-2xl text-brand">{money(revenue)}</div>
        </div>
        <div className="bg-surface rounded-xl border border-surface2 px-4 py-3">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Orders</div>
          <div className="font-num font-black text-2xl">{orders.length}</div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-xs uppercase tracking-wider text-neutral-400">
            <tr>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Table</th>
              <th className="text-left px-4 py-3">Items</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-surface2" data-testid={`history-row-${o.id}`}>
                <td className="px-4 py-3 font-num font-bold">{o.order_number}</td>
                <td className="px-4 py-3">{o.table_number}</td>
                <td className="px-4 py-3 text-xs text-neutral-400 truncate max-w-xs">
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-surface2 px-2 py-0.5 rounded-full">{o.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-num">{money(o.total_amount)}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="text-center text-neutral-500 py-10">No orders</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
