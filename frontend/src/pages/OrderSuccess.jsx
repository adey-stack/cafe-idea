import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Flame } from "lucide-react";
import { api, money } from "../lib/api";

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => {
    api.get(`/orders/${orderId}`).then((r) => setOrder(r.data));
  }, [orderId]);
  if (!order) return <div className="min-h-screen bg-ink text-white flex items-center justify-center">Loading…</div>;
  return (
    <div className="min-h-screen bg-ink text-white flex flex-col items-center justify-center px-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
        className="w-20 h-20 rounded-full bg-ok/10 border-2 border-ok flex items-center justify-center mb-6">
        <Check className="w-10 h-10 text-ok" strokeWidth={3} />
      </motion.div>
      <h1 className="font-display font-black text-3xl">Order placed!</h1>
      <p className="text-neutral-400 mt-2 text-sm">Your order has been sent to the kitchen.</p>
      <div className="mt-8 bg-surface rounded-2xl border border-surface2 p-6 w-full max-w-sm">
        <div className="flex justify-between mb-2">
          <span className="text-neutral-400 text-sm">Order number</span>
          <span className="font-num font-bold">{order.order_number}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-neutral-400 text-sm">Table</span>
          <span className="font-num font-bold">{order.table_number}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-neutral-400 text-sm">Total</span>
          <span className="font-num font-bold">{money(order.total_amount)}</span>
        </div>
        <div className="flex justify-between mt-4 pt-4 border-t border-surface2">
          <span className="text-neutral-400 text-sm">Estimated time</span>
          <span className="font-num font-bold text-brand">~ 20 min</span>
        </div>
      </div>
      <Link
        to={`/track/${order.id}`}
        data-testid="track-order-btn"
        className="mt-6 bg-brand hover:bg-brand-hover px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
      >
        <Flame className="w-4 h-4" /> Track Order
      </Link>
    </div>
  );
}
