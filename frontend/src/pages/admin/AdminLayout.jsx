import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Flame, LayoutGrid, History, UtensilsCrossed, QrCode, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth";

const NAV = [
  { to: "/admin/live", label: "Live Orders", icon: LayoutGrid },
  { to: "/admin/history", label: "Order History", icon: History },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/tables", label: "Tables & QR", icon: QrCode },
  { to: "/admin/stats", label: "Stats", icon: BarChart3 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); nav("/admin/login"); };

  return (
    <div className="min-h-screen bg-ink text-white flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-surface2 bg-surface/40 backdrop-blur sticky top-0 h-screen">
        <div className="p-6 border-b border-surface2 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
            <Flame className="w-4 h-4 text-brand" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-black leading-tight">Ember & Oak</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-bold">Admin</div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to} to={n.to}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? "bg-brand text-white" : "text-neutral-400 hover:text-white hover:bg-surface2"}`
              }
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-surface2">
          <div className="px-3 py-2 text-xs text-neutral-500">
            <div className="text-neutral-300 font-semibold truncate">{user?.name || "Owner"}</div>
            <div className="truncate">{user?.email}</div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={doLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-surface2 transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur border-b border-surface2 flex items-center gap-2 px-4 py-2 overflow-x-auto hide-scrollbar">
        {NAV.map((n) => (
          <NavLink
            key={n.to} to={n.to}
            className={({ isActive }) =>
              `whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold ${isActive ? "bg-brand text-white" : "text-neutral-400"}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 md:p-8 p-4 pt-16 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
