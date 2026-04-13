import { useEffect, useState } from "react";
import {
  getSearches,
  getClients,
  createSearch,
  updateSearch,
  deleteSearch,
  getSuggestions,
} from "../api";
import { useScan } from "../ScanContext";

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
  const { scanning, scanResult, startScan, stopScan } = useScan();

  // Suggestion state
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
    setSuggestions(null);
    setForm({ ...EMPTY_FORM, client_id: clients[0]?.id || "" });
    setShowForm(true);
  };

  const openEdit = (search) => {
    setEditing(search);
    setSuggestions(null);
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

  const handleScan = (id) => {
    setError(null);
    startScan(id);
  };

  const handleGetSuggestions = async () => {
    if (!form.client_id) return;
    setLoadingSuggestions(true);
    setSuggestions(null);
    try {
      const result = await getSuggestions(form.client_id);
      setSuggestions(result);
      // Auto-fill name if empty
      if (!form.name && result.search_name_suggestion) {
        setForm((f) => ({ ...f, name: result.search_name_suggestion }));
      }
    } catch (e) {
      setError("Suggestions failed: " + e.message);
    }
    setLoadingSuggestions(false);
  };

  const addSubreddit = (sub) => {
    const current = splitList(form.subreddits);
    if (!current.includes(sub)) {
      setForm((f) => ({
        ...f,
        subreddits: [...current, sub].join(", "),
      }));
    }
  };

  const addKeyword = (kw) => {
    const current = splitList(form.keywords);
    if (!current.includes(kw)) {
      setForm((f) => ({
        ...f,
        keywords: [...current, kw].join(", "),
      }));
    }
  };

  const addNegativeKeyword = (kw) => {
    const current = splitList(form.negative_keywords);
    if (!current.includes(kw)) {
      setForm((f) => ({
        ...f,
        negative_keywords: [...current, kw].join(", "),
      }));
    }
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

  const currentSubs = splitList(form.subreddits);
  const currentKeywords = splitList(form.keywords);
  const currentNegKeywords = splitList(form.negative_keywords);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Searches
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {searches.length} configured
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={clients.length === 0}
          className="bg-accent-teal/15 text-accent-teal px-4 py-2 rounded-lg text-sm font-medium
            hover:bg-accent-teal/25 transition-colors disabled:opacity-30 ring-1 ring-accent-teal/20"
        >
          + New Search
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {clients.length === 0 && !loading && (
        <p className="text-slate-400 text-sm mb-4">
          Create a client first before adding searches.
        </p>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-canvas-100 border border-surface-border rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-slate-100 mb-5">
              {editing ? "Edit Search" : "New Search"}
            </h2>

            {/* Client + suggest row */}
            <div className="flex gap-3 mb-4">
              <label className="block flex-1">
                <span className="text-xs text-slate-400 font-mono block mb-1.5">
                  CLIENT <span className="text-accent-teal">*</span>
                </span>
                <select
                  required
                  value={form.client_id}
                  onChange={(e) => {
                    set("client_id")(e);
                    setSuggestions(null);
                  }}
                  className="form-input"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.vertical ? ` (${c.vertical})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={!form.client_id || loadingSuggestions}
                  className="bg-violet-500/15 text-violet-400 px-4 py-2 rounded-lg text-sm font-medium
                    hover:bg-violet-500/25 transition-colors disabled:opacity-30 ring-1 ring-violet-500/20
                    whitespace-nowrap"
                >
                  {loadingSuggestions ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                      Generating...
                    </span>
                  ) : (
                    "AI Suggest"
                  )}
                </button>
              </div>
            </div>

            <FormField label="Search Name" required>
              <input
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. PI Attorney — NOLA area subs"
                className="form-input"
              />
            </FormField>

            {/* Keywords with suggestions */}
            <FormField label="Keywords" required hint="Comma-separated. Click suggestions below to add.">
              <input
                required
                value={form.keywords}
                onChange={set("keywords")}
                placeholder="personal injury lawyer, car accident attorney"
                className="form-input"
              />
            </FormField>

            {suggestions?.keywords && (
              <div className="mb-4 -mt-2">
                {suggestions.keywords.primary?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-violet-400/70 font-mono">PRIMARY</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.keywords.primary.map((kw) => (
                        <SuggestionChip
                          key={kw}
                          label={kw}
                          active={currentKeywords.includes(kw)}
                          onClick={() => addKeyword(kw)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.keywords.long_tail?.length > 0 && (
                  <div>
                    <span className="text-xs text-violet-400/70 font-mono">LONG TAIL</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.keywords.long_tail.map((kw) => (
                        <SuggestionChip
                          key={kw}
                          label={kw}
                          active={currentKeywords.includes(kw)}
                          onClick={() => addKeyword(kw)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Negative keywords with suggestions */}
            <FormField label="Negative Keywords" hint="Comma-separated">
              <input
                value={form.negative_keywords}
                onChange={set("negative_keywords")}
                placeholder="recipe, DIY, meme"
                className="form-input"
              />
            </FormField>

            {suggestions?.negative_keywords?.length > 0 && (
              <div className="mb-4 -mt-2">
                <span className="text-xs text-violet-400/70 font-mono">SUGGESTED EXCLUSIONS</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {suggestions.negative_keywords.map((kw) => (
                    <SuggestionChip
                      key={kw}
                      label={kw}
                      active={currentNegKeywords.includes(kw)}
                      onClick={() => addNegativeKeyword(kw)}
                      variant="red"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Subreddits with categorized suggestions */}
            <FormField label="Subreddits" hint="Comma-separated. Empty = all of Reddit.">
              <input
                value={form.subreddits}
                onChange={set("subreddits")}
                placeholder="legaladvice, personalinjury, NewOrleans"
                className="form-input"
              />
            </FormField>

            {suggestions?.subreddits && (
              <div className="mb-4 -mt-2 space-y-2">
                {suggestions.subreddits.vertical?.length > 0 && (
                  <div>
                    <span className="text-xs text-violet-400/70 font-mono">INDUSTRY</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.subreddits.vertical.map((sub) => (
                        <SuggestionChip
                          key={sub}
                          label={`r/${sub}`}
                          active={currentSubs.includes(sub)}
                          onClick={() => addSubreddit(sub)}
                          variant="orange"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.subreddits.location?.length > 0 && (
                  <div>
                    <span className="text-xs text-violet-400/70 font-mono">LOCATION</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.subreddits.location.map((sub) => (
                        <SuggestionChip
                          key={sub}
                          label={`r/${sub}`}
                          active={currentSubs.includes(sub)}
                          onClick={() => addSubreddit(sub)}
                          variant="blue"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.subreddits.general?.length > 0 && (
                  <div>
                    <span className="text-xs text-violet-400/70 font-mono">GENERAL</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.subreddits.general.map((sub) => (
                        <SuggestionChip
                          key={sub}
                          label={`r/${sub}`}
                          active={currentSubs.includes(sub)}
                          onClick={() => addSubreddit(sub)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-2">
                INTENT FILTERS
              </span>
              <div className="flex flex-wrap gap-2">
                {INTENT_OPTIONS.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => toggleIntent(intent)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ring-1 ${
                      form.intent_filters.includes(intent)
                        ? "bg-accent-teal/15 ring-accent-teal/30 text-accent-teal"
                        : "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {intent.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <FormField label="Alert Threshold" hint="Min score 0-100">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.alert_threshold}
                  onChange={set("alert_threshold")}
                  className="form-input"
                />
              </FormField>

              <FormField label="Scan Frequency">
                <select
                  value={form.scan_frequency}
                  onChange={set("scan_frequency")}
                  className="form-input"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <label className="flex items-center gap-2.5 mb-5">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="accent-accent-teal"
              />
              <span className="text-sm text-slate-300">Active</span>
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
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
          <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
            Loading...
          </div>
        </div>
      ) : searches.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-lg">
          <p className="text-slate-400 text-sm">No searches configured yet.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {["NAME", "CLIENT", "KEYWORDS", "SUBS", "FREQ", "THRESHOLD", "STATUS", "LAST SCAN", "ACTIONS"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs text-slate-400 font-mono font-medium ${
                        h === "ACTIONS" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-surface-border row-hover"
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {clientName(s.client_id)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.keywords.slice(0, 2).map((k) => (
                        <span
                          key={k}
                          className="bg-canvas-200 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono"
                        >
                          {k}
                        </span>
                      ))}
                      {s.keywords.length > 2 && (
                        <span className="text-slate-500 text-xs font-mono">
                          +{s.keywords.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {(s.subreddits || []).length || "all"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {s.scan_frequency.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {s.alert_threshold}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(s)}
                      className={`text-xs font-mono font-medium px-2 py-0.5 rounded ring-1 transition-colors ${
                        s.is_active
                          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 ring-slate-500/20"
                      }`}
                    >
                      {s.is_active ? "ACTIVE" : "PAUSED"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {s.last_scan_at
                      ? new Date(s.last_scan_at).toLocaleString()
                      : "never"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleScan(s.id)}
                      disabled={scanning === s.id}
                      className="text-accent-teal/80 hover:text-accent-teal text-xs font-mono mr-3 disabled:opacity-30 transition-colors"
                    >
                      {scanning === s.id ? "SCANNING..." : "SCAN"}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="text-slate-400 hover:text-slate-200 text-xs font-mono mr-3 transition-colors"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-slate-500 hover:text-red-400 text-xs font-mono transition-colors"
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

function FormField({ label, required, hint, children }) {
  return (
    <label className="block mb-4">
      <span className="text-xs text-slate-400 font-mono block mb-1.5">
        {label.toUpperCase()}
        {required && <span className="text-accent-teal ml-1">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-slate-500 font-mono mt-1 block">
          {hint}
        </span>
      )}
    </label>
  );
}

const CHIP_VARIANTS = {
  default: {
    active: "bg-accent-teal/20 ring-accent-teal/40 text-accent-teal",
    inactive: "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200 hover:ring-slate-500",
  },
  orange: {
    active: "bg-orange-500/20 ring-orange-500/40 text-orange-300",
    inactive: "bg-canvas-200 ring-surface-border text-slate-400 hover:text-orange-300 hover:ring-orange-500/30",
  },
  blue: {
    active: "bg-blue-500/20 ring-blue-500/40 text-blue-300",
    inactive: "bg-canvas-200 ring-surface-border text-slate-400 hover:text-blue-300 hover:ring-blue-500/30",
  },
  red: {
    active: "bg-red-500/20 ring-red-500/40 text-red-300",
    inactive: "bg-canvas-200 ring-surface-border text-slate-400 hover:text-red-300 hover:ring-red-500/30",
  },
};

function SuggestionChip({ label, active, onClick, variant = "default" }) {
  const styles = CHIP_VARIANTS[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs font-mono ring-1 transition-all cursor-pointer ${
        active ? styles.active : styles.inactive
      }`}
    >
      {active ? "+" : ""}{label}
    </button>
  );
}
