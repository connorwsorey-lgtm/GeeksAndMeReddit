import { useEffect, useState } from "react";
import { getSignals, getClients, updateSignalStatus, getSignalStats } from "../api";
import SignalCard from "../components/SignalCard";

const INTENT_OPTIONS = [
  "recommendation_request",
  "comparison",
  "complaint",
  "question",
  "review",
  "local",
  "purchase_intent",
];

const STATUS_OPTIONS = ["new", "viewed", "actioned", "dismissed"];

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    client_id: "",
    intent: "",
    status: "",
    min_score: "",
    max_score: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.client_id) params.client_id = filters.client_id;
      if (filters.intent) params.intent = filters.intent;
      if (filters.status) params.status = filters.status;
      if (filters.min_score) params.min_score = filters.min_score;
      if (filters.max_score) params.max_score = filters.max_score;

      const [s, c, st] = await Promise.all([
        getSignals(params),
        getClients(),
        getSignalStats(filters.client_id || undefined),
      ]);
      setSignals(s);
      setClients(c);
      setStats(st);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filters]);

  const handleStatusChange = async (signalId, newStatus) => {
    try {
      await updateSignalStatus(signalId, newStatus);
      setSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, status: newStatus } : s))
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const setFilter = (key) => (e) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  const clearFilters = () =>
    setFilters({ client_id: "", intent: "", status: "", min_score: "", max_score: "" });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Signal Feed
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {signals.length} signal{signals.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total_signals > 0 && (
        <div className="flex items-center gap-6 mb-4 bg-surface border border-surface-border rounded-lg px-5 py-3">
          <Stat label="TOTAL" value={stats.total_signals} />
          <div className="w-px h-5 bg-surface-border" />
          <Stat label="ACTIONED" value={stats.actioned} color="text-emerald-400" />
          <div className="w-px h-5 bg-surface-border" />
          <Stat label="ACTION RATE" value={`${stats.action_rate}%`} color={stats.action_rate >= 20 ? "text-emerald-400" : "text-slate-400"} />
          <div className="w-px h-5 bg-surface-border" />
          <Stat label="AVG SCORE" value={stats.average_score} />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface border border-surface-border rounded-lg p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Client"
            value={filters.client_id}
            onChange={setFilter("client_id")}
            options={[
              { value: "", label: "All clients" },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <FilterSelect
            label="Intent"
            value={filters.intent}
            onChange={setFilter("intent")}
            options={[
              { value: "", label: "All intents" },
              ...INTENT_OPTIONS.map((i) => ({
                value: i,
                label: i.replace("_", " "),
              })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={setFilter("status")}
            options={[
              { value: "", label: "All" },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />

          <label className="block">
            <span className="text-xs text-slate-400 font-mono block mb-1">
              MIN SCORE
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.min_score}
              onChange={setFilter("min_score")}
              placeholder="0"
              className="bg-canvas-200 border border-surface-border text-slate-300 rounded px-2 py-1.5 text-sm w-20 placeholder:text-slate-500 focus:outline-none focus:border-accent-teal/40"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 font-mono block mb-1">
              MAX SCORE
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.max_score}
              onChange={setFilter("max_score")}
              placeholder="100"
              className="bg-canvas-200 border border-surface-border text-slate-300 rounded px-2 py-1.5 text-sm w-20 placeholder:text-slate-500 focus:outline-none focus:border-accent-teal/40"
            />
          </label>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-mono text-slate-600 hover:text-red-400 py-1.5 transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Signal list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2 text-slate-600 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
            Scanning...
          </div>
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-surface-border rounded-lg">
          <p className="text-slate-500 text-sm mb-1">No signals detected</p>
          <p className="text-slate-500 text-xs">
            {hasFilters
              ? "Adjust filters to widen the search."
              : "Trigger a scan from the Searches page."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 stagger">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "text-slate-200" }) {
  return (
    <div>
      <span className="text-xs text-slate-400 font-mono block">{label}</span>
      <span className={`text-sm font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 font-mono block mb-1">
        {label.toUpperCase()}
      </span>
      <select
        value={value}
        onChange={onChange}
        className="bg-canvas-200 border border-surface-border text-slate-300 rounded px-2 py-1.5 text-sm min-w-[130px] focus:outline-none focus:border-accent-teal/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
