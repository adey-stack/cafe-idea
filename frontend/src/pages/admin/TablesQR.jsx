import React, { useEffect, useState } from "react";
import { Plus, Trash2, Download, Package } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { api, absUrl, BACKEND_URL } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function TablesQR() {
  const { user } = useAuth();
  const rid = user?.restaurant_id;
  const [tables, setTables] = useState([]);
  const [newNum, setNewNum] = useState("");

  const load = () => api.get("/tables").then((r) => setTables(r.data)).catch(() => {});
  useEffect(() => { if (rid) load(); /* eslint-disable-next-line */ }, [rid]);

  const addTable = async (e) => {
    e.preventDefault();
    if (!newNum) return;
    try {
      // Backend uses request origin for QR if FRONTEND_URL not set; pass Origin via header
      await api.post("/tables", { table_number: newNum, restaurant_id: rid });
      toast.success("Table added");
      setNewNum(""); load();
    } catch { toast.error("Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete table and its QR?")) return;
    await api.delete(`/tables/${id}`); load();
  };

  const downloadOne = async (t) => {
    const url = absUrl(t.qr_code_url);
    const a = document.createElement("a");
    a.href = url; a.download = `table-${t.table_number}.png`; a.target = "_blank"; a.click();
  };

  const downloadZip = async () => {
    try {
      const zip = new JSZip();
      await Promise.all(tables.map(async (t) => {
        const res = await fetch(absUrl(t.qr_code_url));
        const blob = await res.blob();
        zip.file(`table-${t.table_number}.png`, blob);
      }));
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "tables-qr.zip");
    } catch { toast.error("Zip failed"); }
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Floor Plan</div>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1">Tables & QR Codes</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadZip} data-testid="download-zip"
            className="bg-surface2 hover:bg-surface px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2">
            <Package className="w-4 h-4" /> Download all (.zip)
          </button>
          <form onSubmit={addTable} className="flex gap-2">
            <input value={newNum} onChange={(e) => setNewNum(e.target.value)} placeholder="Table #"
              data-testid="new-table-num"
              className="bg-surface border border-surface2 rounded-lg px-3 py-2 text-sm outline-none w-28" />
            <button type="submit" data-testid="add-table"
              className="bg-brand hover:bg-brand-hover px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="bg-surface rounded-2xl border border-surface2 p-4 flex flex-col items-center" data-testid={`table-card-${t.id}`}>
            <div className="bg-white rounded-xl p-3 mb-3">
              <img src={absUrl(t.qr_code_url)} alt={`qr-${t.table_number}`} className="w-32 h-32" />
            </div>
            <div className="font-display font-black text-xl">Table {t.table_number}</div>
            <div className="text-[10px] text-neutral-500 mt-1 text-center break-all px-2">
              {t.qr_target || `${window.location.origin}/menu?restaurant=${rid}&table=${t.table_number}`}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => downloadOne(t)} className="bg-surface2 hover:bg-ink px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                <Download className="w-3 h-3" /> QR
              </button>
              <button onClick={() => del(t.id)} data-testid={`del-table-${t.id}`} className="bg-surface2 hover:bg-nonveg/20 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
