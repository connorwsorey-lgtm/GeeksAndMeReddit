import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClients, createClient, updateClient, deleteClient } from "../api";

const EMPTY_FORM = {
  name: "",
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + New Client
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg"
          >
            <h2 className="text-lg font-bold mb-4">
              {editing ? "Edit Client" : "New Client"}
            </h2>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Name *</span>
              <input
                required
                value={form.name}
                onChange={set("name")}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Location</span>
              <input
                value={form.location}
                onChange={set("location")}
                placeholder="e.g. New Orleans, LA"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Vertical</span>
              <input
                value={form.vertical}
                onChange={set("vertical")}
                placeholder="e.g. Skincare, Legal, Construction"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">
                Products / Services
              </span>
              <textarea
                value={form.products_services}
                onChange={set("products_services")}
                rows={2}
                placeholder="Key products or services this client offers"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700">Competitors</span>
              <textarea
                value={form.competitors}
                onChange={set("competitors")}
                rows={2}
                placeholder="Known competitors (comma-separated)"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
              >
                {editing ? "Save Changes" : "Create Client"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-gray-400 text-sm">No clients yet. Create one to get started.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.location || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.vertical || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-gray-500 hover:text-blue-600 mr-3 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-400 hover:text-red-600 text-xs"
                    >
                      Delete
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
