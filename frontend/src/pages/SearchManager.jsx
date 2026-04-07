import { useEffect, useState } from "react";
import {
  getSearches,
  getClients,
  createSearch,
  updateSearch,
  deleteSearch,
  triggerScan,
} from "../api";

const INTENT_OPTIONS = [
  "recommendation_request",
  "comparison",
  "complaint",
  "question",
  "review",
  "local",
  "purchase_intent",
];

const FREQUENCY_OPTIONS = ["hourly", "every_6h", "daily"];

const EMPTY_FORM = {
  client_id: "",
  name: "",
  keywords: "",
  negative_keywords: "",
  subreddits: "",
  intent_filters: [],
  alert_threshold: 50,
  scan_frequency: "daily",
  is_active: true,
};

export default function SearchManager() {
  const [searches, setSearches] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getSearches(), getClients()]);
      setSearches(s);
      setClients(c);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, client_id: clients[0]?.id || "" });
    setShowForm(true);
  };

  const openEdit = (search) => {
    setEditing(search);
    setForm({
      client_id: search.client_id,
      name: search.name,
      keywords: search.keywords.join(", "),
      negative_keywords: (search.negative_keywords || []).join(", "),
      subreddits: (search.subreddits || []).join(", "),
      intent_filters: search.intent_filters || [],
      alert_threshold: search.alert_threshold,
      scan_frequency: search.scan_frequency,
      is_active: search.is_active,
    });
    setShowForm(true);
  };

  const splitList = (str) =>
    str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      client_id: Number(form.client_id),
      name: form.name,
      keywords: splitList(form.keywords),
      negative_keywords: splitList(form.negative_keywords),
      subreddits: splitList(form.subreddits),
      intent_filters: form.intent_filters,
      alert_threshold: Number(form.alert_threshold),
      scan_frequency: form.scan_frequency,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await updateSearch(editing.id, payload);
      } else {
        await createSearch(payload);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this search and all its signals?")) return;
    try {
      await deleteSearch(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleActive = async (search) => {
    try {
      await updateSearch(search.id, { is_active: !search.is_active });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleScan = async (id) => {
    setScanning(id);
    try {
      await triggerScan(id);
    } catch (e) {
      setError(e.message);
    }
    setScanning(null);
  };

  const toggleIntent = (intent) => {
    setForm((f) => ({
      ...f,
      intent_filters: f.intent_filters.includes(intent)
        ? f.intent_filters.filter((i) => i !== intent)
        : [...f.intent_filters, intent],
    }));
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Searches</h1>
        <button
          onClick={openCreate}
          disabled={clients.length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          + New Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {clients.length === 0 && !loading && (
        <p className="text-gray-400 text-sm mb-4">
          Create a client first before adding searches.
        </p>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold mb-4">
              {editing ? "Edit Search" : "New Search"}
            </h2>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Client *</span>
              <select
                required
                value={form.client_id}
                onChange={set("client_id")}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Search Name *</span>
              <input
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Goat milk soap — skincare subs"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Keywords *</span>
              <input
                required
                value={form.keywords}
                onChange={set("keywords")}
                placeholder="goat milk soap, goat milk skincare, eczema soap"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">Comma-separated</span>
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">
                Negative Keywords
              </span>
              <input
                value={form.negative_keywords}
                onChange={set("negative_keywords")}
                placeholder="recipe, DIY, homemade"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">Comma-separated</span>
            </label>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Subreddits</span>
              <input
                value={form.subreddits}
                onChange={set("subreddits")}
                placeholder="SkincareAddiction, eczema, NaturalBeauty"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">
                Comma-separated. Leave empty to search all of Reddit.
              </span>
            </label>

            <div className="mb-3">
              <span className="text-sm font-medium text-gray-700 block mb-1">
                Intent Filters
              </span>
              <div className="flex flex-wrap gap-2">
                {INTENT_OPTIONS.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => toggleIntent(intent)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      form.intent_filters.includes(intent)
                        ? "bg-blue-100 border-blue-300 text-blue-800"
                        : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    {intent.replace("_", " ")}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">
                Select which intent types to monitor. Leave empty for all.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Alert Threshold
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.alert_threshold}
                  onChange={set("alert_threshold")}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-400">Min score to alert (0-100)</span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Scan Frequency
                </span>
                <select
                  value={form.scan_frequency}
                  onChange={set("scan_frequency")}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Active</span>
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
                {editing ? "Save Changes" : "Create Search"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : searches.length === 0 ? (
        <p className="text-gray-400 text-sm">No searches yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Scan</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {clientName(s.client_id)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {s.keywords.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs"
                        >
                          {k}
                        </span>
                      ))}
                      {s.keywords.length > 3 && (
                        <span className="text-gray-400 text-xs">
                          +{s.keywords.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.scan_frequency.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.alert_threshold}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(s)}
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        s.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {s.last_scan_at
                      ? new Date(s.last_scan_at).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleScan(s.id)}
                      disabled={scanning === s.id}
                      className="text-green-600 hover:text-green-800 text-xs mr-3 disabled:opacity-50"
                    >
                      {scanning === s.id ? "Scanning..." : "Scan Now"}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="text-gray-500 hover:text-blue-600 text-xs mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
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
