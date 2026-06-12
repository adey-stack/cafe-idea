import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, Plus, Minus, X, Languages, Flame } from "lucide-react";
import { toast } from "sonner";
import { api, absUrl, money } from "../lib/api";

const STR = {
  en: {
    search: "Search dishes…",
    veg: "Veg", nonveg: "Non-veg",
    addCart: "Add", viewCart: "View Cart", placeOrder: "Place Order",
    yourCart: "Your Cart", empty: "Cart is empty", special: "Special instructions (optional)",
    total: "Total", table: "Table", unavailable: "Unavailable",
  },
  hi: {
    search: "व्यंजन खोजें…",
    veg: "शाकाहारी", nonveg: "मांसाहारी",
    addCart: "जोड़ें", viewCart: "कार्ट देखें", placeOrder: "ऑर्डर करें",
    yourCart: "आपका कार्ट", empty: "कार्ट खाली है", special: "विशेष निर्देश (वैकल्पिक)",
    total: "कुल", table: "टेबल", unavailable: "उपलब्ध नहीं",
  },
};

function VegDot({ veg }) {
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 ${veg ? "border-veg" : "border-nonveg"}`}>
      <span className={`w-2 h-2 rounded-full ${veg ? "bg-veg" : "bg-nonveg"}`} />
    </span>
  );
}

export default function CustomerMenu() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const restaurantId = params.get("restaurant");
  const tableNumber = params.get("table") || "1";
  const [data, setData] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState({}); // item_id -> { item, qty }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const t = STR[lang];

  useEffect(() => {
    if (!restaurantId) {
      // fetch default restaurant
      api.get("/restaurants/default").then((r) => {
        const u = new URL(window.location.href);
        u.searchParams.set("restaurant", r.data.id);
        if (!u.searchParams.get("table")) u.searchParams.set("table", "1");
        window.location.replace(u.toString());
      });
      return;
    }
    api.get(`/menu/${restaurantId}`).then((r) => {
      setData(r.data);
      if (r.data.categories?.[0]) setActiveCat(r.data.categories[0].id);
    });
  }, [restaurantId]);

  const tables = useMemo(() => data?.categories || [], [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((it) => {
      const matchCat = !activeCat || it.category_id === activeCat;
      const matchQ = !q || it.name.toLowerCase().includes(q.toLowerCase());
      return matchCat && matchQ;
    });
  }, [data, activeCat, q]);

  const cartArr = Object.values(cart);
  const cartCount = cartArr.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cartArr.reduce((s, c) => s + c.qty * c.item.price, 0);

  const addToCart = (it) => {
    if (!it.is_available) return;
    setCart((c) => ({ ...c, [it.id]: { item: it, qty: (c[it.id]?.qty || 0) + 1 } }));
    toast.success(`${it.name} added`, { duration: 1200 });
  };
  const decrement = (id) => {
    setCart((c) => {
      const cur = c[id];
      if (!cur) return c;
      if (cur.qty <= 1) { const n = { ...c }; delete n[id]; return n; }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  };

  const place = async () => {
    if (!cartArr.length) return;
    setPlacing(true);
    try {
      // resolve table_id from tables list
      const tbls = (await api.get(`/tables/public?restaurant_id=${restaurantId}`)).data;
      const match = tbls.find((x) => String(x.table_number) === String(tableNumber));
      if (!match) throw new Error("Table not found");
      const body = {
        restaurant_id: restaurantId,
        table_id: match.id,
        items: cartArr.map((c) => ({ menu_item_id: c.item.id, quantity: c.qty, price: c.item.price, name: c.item.name })),
        special_instructions: notes,
      };
      const { data: order } = await api.post("/orders", body);
      setCart({}); setNotes(""); setDrawerOpen(false);
      navigate(`/order/success/${order.id}`);
    } catch (e) {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  if (!data) return <div className="min-h-screen bg-ink text-white flex items-center justify-center text-sm text-neutral-500">Loading menu…</div>;

  return (
    <div className="min-h-screen bg-ink text-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink/80 border-b border-surface2">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
              <Flame className="w-4 h-4 text-brand" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-black leading-tight">{data.restaurant.name}</div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-bold">Scan · Order · Enjoy</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
              data-testid="lang-toggle"
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-surface border border-surface2 flex items-center gap-1"
            >
              <Languages className="w-3.5 h-3.5" /> {lang === "en" ? "EN" : "हि"}
            </button>
            <div data-testid="table-badge" className="bg-brand/10 text-brand border border-brand/20 px-3 py-1.5 rounded-full text-xs font-bold">
              {t.table} {tableNumber}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5 border border-surface2">
            <Search className="w-4 h-4 text-neutral-500" />
            <input
              data-testid="menu-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-neutral-600"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
          {tables.map((c) => (
            <button
              key={c.id}
              data-testid={`cat-tab-${c.id}`}
              onClick={() => setActiveCat(c.id)}
              className={`snap-start whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCat === c.id ? "bg-brand text-white" : "bg-surface text-neutral-300 border border-surface2"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu items */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-3">
        <AnimatePresence>
          {filtered.map((it, idx) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`bg-surface rounded-2xl border border-surface2 overflow-hidden flex ${!it.is_available ? "opacity-40" : ""}`}
              data-testid={`menu-item-${it.id}`}
            >
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <VegDot veg={it.is_veg} />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">
                    {it.is_veg ? t.veg : t.nonveg}
                  </span>
                </div>
                <div className="font-display font-bold text-base leading-tight">{it.name}</div>
                <div className="text-xs text-neutral-400 mt-1 line-clamp-2">{it.description}</div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-num text-lg font-bold">{money(it.price)}</div>
                  {!it.is_available ? (
                    <span className="text-xs text-nonveg font-bold">{t.unavailable}</span>
                  ) : cart[it.id] ? (
                    <div className="flex items-center gap-1 bg-brand/10 border border-brand/30 rounded-full px-1">
                      <button data-testid={`dec-${it.id}`} onClick={() => decrement(it.id)} className="w-7 h-7 flex items-center justify-center text-brand">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-brand w-5 text-center font-num">{cart[it.id].qty}</span>
                      <button data-testid={`inc-${it.id}`} onClick={() => addToCart(it)} className="w-7 h-7 flex items-center justify-center text-brand">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={`add-${it.id}`}
                      onClick={() => addToCart(it)}
                      className="bg-brand hover:bg-brand-hover text-white text-xs font-bold px-4 py-2 rounded-full transition-all active:scale-95 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t.addCart}
                    </button>
                  )}
                </div>
              </div>
              {it.image_url && (
                <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
                  <img src={absUrl(it.image_url)} alt={it.name} className="w-full h-full object-cover" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center text-neutral-500 py-12 text-sm">No items found</div>
        )}
      </main>

      {/* Cart bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            data-testid="view-cart-btn"
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-4 left-4 right-4 z-40 max-w-xl mx-auto bg-brand text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(255,107,0,0.35)] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span className="font-bold">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-num font-bold text-lg">{money(cartTotal)}</span>
              <span className="text-xs font-bold">{t.viewCart} →</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 z-40"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl border-t border-surface2 max-h-[85vh] flex flex-col"
              data-testid="cart-drawer"
            >
              <div className="p-5 flex items-center justify-between border-b border-surface2">
                <div className="font-display font-bold text-xl">{t.yourCart}</div>
                <button data-testid="close-drawer" onClick={() => setDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                {cartArr.length === 0 && <div className="text-neutral-500 text-center py-10">{t.empty}</div>}
                {cartArr.map((c) => (
                  <div key={c.item.id} className="flex items-center justify-between bg-ink rounded-xl p-3 border border-surface2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1"><VegDot veg={c.item.is_veg} /><div className="font-semibold text-sm">{c.item.name}</div></div>
                      <div className="text-xs text-neutral-500 font-num">{money(c.item.price)} × {c.qty}</div>
                    </div>
                    <div className="flex items-center gap-1 bg-brand/10 border border-brand/30 rounded-full px-1">
                      <button onClick={() => decrement(c.item.id)} className="w-7 h-7 flex items-center justify-center text-brand"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="text-sm font-bold text-brand w-5 text-center font-num">{c.qty}</span>
                      <button onClick={() => addToCart(c.item)} className="w-7 h-7 flex items-center justify-center text-brand"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {cartArr.length > 0 && (
                  <textarea
                    data-testid="special-instructions"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.special}
                    className="w-full bg-ink border border-surface2 rounded-xl p-3 text-sm mt-3 outline-none focus:border-brand/50"
                    rows={2}
                  />
                )}
              </div>
              <div className="p-5 border-t border-surface2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400 text-sm">{t.total}</span>
                  <span className="font-display font-black text-2xl font-num">{money(cartTotal)}</span>
                </div>
                <button
                  data-testid="place-order-btn"
                  onClick={place}
                  disabled={placing || cartArr.length === 0}
                  className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 rounded-xl transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {placing ? "Placing…" : t.placeOrder}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
