import React, { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api, absUrl, money } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function MenuManagement() {
  const { user } = useAuth();
  const rid = user?.restaurant_id;
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [itemModal, setItemModal] = useState(null); // item or {new:true, category_id}
  const [catModal, setCatModal] = useState(null);
  const fileRef = useRef(null);

  const reload = async () => {
    if (!rid) return;
    const { data } = await api.get(`/menu/${rid}`);
    setCats(data.categories); setItems(data.items);
    if (!activeCat && data.categories[0]) setActiveCat(data.categories[0].id);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [rid]);

  const saveCategory = async (form) => {
    try {
      if (form.id) {
        await api.put(`/menu/category/${form.id}`, { name: form.name, sort_order: +form.sort_order || 0 });
      } else {
        await api.post("/menu/category", { name: form.name, sort_order: +form.sort_order || 0, restaurant_id: rid });
      }
      setCatModal(null); reload(); toast.success("Saved");
    } catch { toast.error("Failed"); }
  };

  const delCategory = async (id) => {
    if (!window.confirm("Delete category and its items?")) return;
    await api.delete(`/menu/category/${id}`); reload();
    if (activeCat === id) setActiveCat(null);
  };

  const saveItem = async (form) => {
    try {
      const body = {
        name: form.name, description: form.description, price: +form.price,
        image_url: form.image_url, category_id: form.category_id,
        is_veg: !!form.is_veg, is_available: !!form.is_available, restaurant_id: rid,
      };
      if (form.id) await api.put(`/menu/item/${form.id}`, body);
      else await api.post("/menu/item", body);
      setItemModal(null); reload(); toast.success("Saved");
    } catch { toast.error("Failed"); }
  };

  const delItem = async (id) => {
    if (!window.confirm("Delete item?")) return;
    await api.delete(`/menu/item/${id}`); reload();
  };

  const toggleItem = async (id) => {
    await api.patch(`/menu/item/${id}/toggle`); reload();
  };

  const uploadImage = async (file, onDone) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/upload/menu-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
    onDone(data.url);
  };

  const shownItems = items.filter((i) => !activeCat || i.category_id === activeCat);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">Catalog</div>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1">Menu Management</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCatModal({})} data-testid="add-category"
            className="bg-surface2 hover:bg-surface px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Category
          </button>
          <button onClick={() => setItemModal({ new: true, category_id: activeCat, is_veg: true, is_available: true })}
            data-testid="add-item"
            className="bg-brand hover:bg-brand-hover px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Item
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5">
        {cats.map((c) => (
          <div key={c.id} className={`group flex items-center gap-1 pr-1 rounded-full border ${activeCat === c.id ? "bg-brand border-brand text-white" : "bg-surface border-surface2 text-neutral-300"}`}>
            <button onClick={() => setActiveCat(c.id)} className="px-4 py-2 text-xs font-bold">{c.name}</button>
            <button onClick={() => setCatModal(c)} className="w-6 h-6 flex items-center justify-center opacity-60 hover:opacity-100">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => delCategory(c.id)} className="w-6 h-6 flex items-center justify-center opacity-60 hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shownItems.map((it) => (
          <div key={it.id} className="bg-surface rounded-2xl border border-surface2 overflow-hidden flex" data-testid={`admin-item-${it.id}`}>
            {it.image_url && <img src={absUrl(it.image_url)} alt="" className="w-28 h-28 object-cover" />}
            <div className="flex-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display font-bold">{it.name}</div>
                  <div className="text-xs text-neutral-500 line-clamp-1">{it.description}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${it.is_veg ? "bg-veg" : "bg-nonveg"}`} />
                    <span className="font-num font-bold text-sm">{money(it.price)}</span>
                  </div>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={it.is_available} onChange={() => toggleItem(it.id)} data-testid={`toggle-${it.id}`} className="sr-only peer" />
                  <div className="w-8 h-5 bg-surface2 peer-checked:bg-ok rounded-full relative transition-colors">
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-3" />
                  </div>
                </label>
              </div>
              <div className="mt-3 flex gap-1">
                <button onClick={() => setItemModal(it)} className="text-xs bg-surface2 hover:bg-ink px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => delItem(it.id)} className="text-xs bg-surface2 hover:bg-nonveg/20 px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {shownItems.length === 0 && <div className="text-neutral-500 text-sm">No items in this category yet.</div>}
      </div>

      {/* Category Modal */}
      {catModal && (
        <Modal onClose={() => setCatModal(null)} title={catModal.id ? "Edit Category" : "New Category"}>
          <CategoryForm initial={catModal} onSave={saveCategory} />
        </Modal>
      )}
      {itemModal && (
        <Modal onClose={() => setItemModal(null)} title={itemModal.new ? "New Item" : "Edit Item"}>
          <ItemForm
            initial={itemModal} cats={cats}
            onSave={saveItem}
            onUpload={(file, cb) => uploadImage(file, cb)}
            fileRef={fileRef}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-surface2 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-display font-bold text-xl">{title}</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface2">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CategoryForm({ initial, onSave }) {
  const [name, setName] = useState(initial.name || "");
  const [order, setOrder] = useState(initial.sort_order || 0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...initial, name, sort_order: order }); }} className="space-y-3">
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required className="inp" data-testid="cat-name" /></Field>
      <Field label="Sort order"><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="inp" /></Field>
      <button type="submit" data-testid="save-cat" className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-lg font-bold">Save</button>
      <style>{`.inp{width:100%;background:#0F0F0F;border:1px solid #2A2A2A;border-radius:10px;padding:10px 12px;color:#fff;outline:none;font-size:14px}.inp:focus{border-color:#FF6B00}`}</style>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ItemForm({ initial, cats, onSave, onUpload, fileRef }) {
  const [f, setF] = useState({
    id: initial.id || null,
    name: initial.name || "",
    description: initial.description || "",
    price: initial.price || 0,
    image_url: initial.image_url || "",
    category_id: initial.category_id || cats[0]?.id || "",
    is_veg: initial.is_veg ?? true,
    is_available: initial.is_available ?? true,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file, (url) => set("image_url", url));
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3">
      <Field label="Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} required className="inp" data-testid="item-name" /></Field>
      <Field label="Description"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} className="inp" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₹)"><input type="number" step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} required className="inp" data-testid="item-price" /></Field>
        <Field label="Category">
          <select value={f.category_id} onChange={(e) => set("category_id", e.target.value)} className="inp">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Image">
        <div className="flex items-center gap-2">
          {f.image_url && <img src={absUrl(f.image_url)} alt="" className="w-16 h-16 object-cover rounded-lg" />}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} className="bg-surface2 px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload
          </button>
          <input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="or paste URL" className="inp flex-1" />
        </div>
      </Field>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_veg} onChange={(e) => set("is_veg", e.target.checked)} /> Vegetarian</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_available} onChange={(e) => set("is_available", e.target.checked)} /> Available</label>
      </div>
      <button type="submit" data-testid="save-item" className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-lg font-bold">Save item</button>
      <style>{`.inp{width:100%;background:#0F0F0F;border:1px solid #2A2A2A;border-radius:10px;padding:10px 12px;color:#fff;outline:none;font-size:14px}.inp:focus{border-color:#FF6B00}`}</style>
    </form>
  );
}
