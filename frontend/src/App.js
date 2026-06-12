import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import CustomerMenu from "./pages/CustomerMenu";
import OrderTrack from "./pages/OrderTrack";
import OrderSuccess from "./pages/OrderSuccess";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import LiveOrders from "./pages/admin/LiveOrders";
import OrderHistory from "./pages/admin/OrderHistory";
import MenuManagement from "./pages/admin/MenuManagement";
import TablesQR from "./pages/admin/TablesQR";
import Stats from "./pages/admin/Stats";
import Landing from "./pages/Landing";
import "./index.css";

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-white">
        <div className="text-sm text-neutral-400">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#1A1A1A", color: "#fff", border: "1px solid #2A2A2A" } }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/track/:orderId" element={<OrderTrack />} />
          <Route path="/order/success/:orderId" element={<OrderSuccess />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
            <Route index element={<Navigate to="live" replace />} />
            <Route path="live" element={<LiveOrders />} />
            <Route path="history" element={<OrderHistory />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="tables" element={<TablesQR />} />
            <Route path="stats" element={<Stats />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
