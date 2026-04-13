import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClients, createClient, updateClient, deleteClient } from "../api";

const EMPTY_FORM = {
  name: "",
  website: "",
  location: "",
  vertical: "",
  products_services: "",
  competitors: "",
};

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setClients(await getClients());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (client) => {
    setEditing(client);
    setForm({
      name: client.name,
      website: client.website || "",
      location: client.location || "",
      vertical: client.vertical || "",
      products_services: client.products_services || "",
      competitors: client.competitors || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await updateClient(editing.id, form);
      } else {
        await createClient(form);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this client and all associated searches/signals?")) return;
    try {
      await deleteClient(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Clients
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {clients.length} registered
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent-teal/15 text-accent-teal px-4 py-2 rounded-lg text-sm font-medium
            hover:bg-accent-teal/25 transition-colors ring-1 ring-accent-teal/20"
        >
          + New Client
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-canvas-100 border border-surface-border rounded-xl shadow-2xl p-6 w-full max-w-lg"
          >
            <h2 className="text-lg font-bold text-slate-100 mb-5">
              {editing ? "Edit Client" : "New Client"}
            </h2>

            <FormField label="Name" required>
              <input
                required
                value={form.name}
                onChange={set("name")}
                className="form-input"
              />
            </FormField>

            <FormField label="Website">
              <input
                value={form.website}
                onChange={set("website")}
                placeholder="e.g. seanreganlaw.com"
                className="form-input"
              />
            </FormField>

            <FormField label="Location">
              <input
                value={form.location}
                onChange={set("location")}
                placeholder="e.g. New Orleans, LA"
                className="form-input"
              />
            </FormField>

            <FormField label="Vertical">
              <input
                value={form.vertical}
                onChange={set("vertical")}
                placeholder="e.g. Skincare, Legal, Construction"
                className="form-input"
              />
            </FormField>

            <FormField label="Products / Services">
              <textarea
                value={form.products_services}
                onChange={set("products_services")}
                rows={2}
                placeholder="Key products or services this client offers"
                className="form-input"
              />
            </FormField>

            <FormField label="Competitors">
              <textarea
                value={form.competitors}
                onChange={set("competitors")}
                rows={2}
                placeholder="Known competitors (comma-separated)"
                className="form-input"
              />
            </FormField>

            <div className="flex justify-end gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-accent-teal/15 text-accent-teal px-5 py-2 rounded-lg text-sm font-medium
                  hover:bg-accent-teal/25 transition-colors ring-1 ring-accent-teal/20"
              >
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2 text-slate-600 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
            Loading...
          </div>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-lg">
          <p className="text-slate-500 text-sm">No clients yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-mono font-medium">
                  NAME
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-mono font-medium">
                  LOCATION
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-mono font-medium">
                  VERTICAL
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-mono font-medium">
                  GSC
                </th>
                <th className="px-4 py-3 text-left text-xs text-slate-400 font-mono font-medium">
                  CREATED
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-400 font-mono font-medium">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-surface-border row-hover"
                >
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="text-accent-teal hover:text-accent-teal/80 transition-colors"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.vertical || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.gsc_tokens ? (
                      <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ON
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-slate-500 hover:text-slate-300 text-xs font-mono mr-3 transition-colors"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-600 hover:text-red-400 text-xs font-mono transition-colors"
                    >
                      DEL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <label className="block mb-4">
      <span className="text-xs text-slate-500 font-mono block mb-1.5">
        {label.toUpperCase()}
        {required && <span className="text-accent-teal ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
