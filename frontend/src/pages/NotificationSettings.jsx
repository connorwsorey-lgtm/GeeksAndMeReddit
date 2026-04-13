import { useEffect, useState } from "react";
import {
  getClients,
  getNotificationConfigs,
  createNotificationConfig,
  updateNotificationConfig,
  deleteNotificationConfig,
  testNotification,
  getWhatsAppGroups,
} from "../api";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "in_app", label: "In-App" },
];

const MODE_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "digest", label: "Daily Digest" },
  { value: "off", label: "Off" },
];

export default function NotificationSettings() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    channel: "whatsapp",
    recipient: "",
    mode: "immediate",
    digest_time: "",
    is_active: true,
  });
  const [testStatus, setTestStatus] = useState(null);

  // WhatsApp groups
  const [groups, setGroups] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [recipientMode, setRecipientMode] = useState("group"); // "group" | "number"

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) loadConfigs(selectedClient);
  }, [selectedClient]);

  const loadClients = async () => {
    try {
      const c = await getClients();
      setClients(c);
      if (c.length > 0) setSelectedClient(c[0].id);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const loadConfigs = async (clientId) => {
    try {
      setConfigs(await getNotificationConfigs(clientId));
    } catch (e) {
      setError(e.message);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const result = await getWhatsAppGroups();
      setGroups(result.groups);
    } catch (e) {
      setError("Failed to load groups: " + e.message);
    }
    setLoadingGroups(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      channel: "whatsapp",
      recipient: "",
      mode: "immediate",
      digest_time: "",
      is_active: true,
    });
    setRecipientMode("group");
    setShowForm(true);
    if (!groups) loadGroups();
  };

  const openEdit = (config) => {
    setEditing(config);
    const isGroup = config.recipient?.endsWith("@g.us");
    setRecipientMode(isGroup ? "group" : "number");
    setForm({
      channel: config.channel,
      recipient: config.recipient,
      mode: config.mode,
      digest_time: config.digest_time || "",
      is_active: config.is_active,
    });
    setShowForm(true);
    if (!groups) loadGroups();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      client_id: selectedClient,
      digest_time: form.mode === "digest" && form.digest_time ? form.digest_time : null,
    };
    try {
      if (editing) {
        const { client_id, ...updatePayload } = payload;
        await updateNotificationConfig(editing.id, updatePayload);
      } else {
        await createNotificationConfig(payload);
      }
      setShowForm(false);
      loadConfigs(selectedClient);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this notification config?")) return;
    try {
      await deleteNotificationConfig(id);
      loadConfigs(selectedClient);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleActive = async (config) => {
    try {
      await updateNotificationConfig(config.id, { is_active: !config.is_active });
      loadConfigs(selectedClient);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleTest = async () => {
    setTestStatus("sending");
    try {
      await testNotification();
      setTestStatus("sent");
    } catch (e) {
      setTestStatus("failed");
    }
    setTimeout(() => setTestStatus(null), 3000);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const recipientLabel = (recipient) => {
    if (!recipient) return "";
    if (recipient.endsWith("@g.us") && groups) {
      const g = groups.find((g) => g.jid === recipient);
      return g ? g.name : recipient;
    }
    return recipient;
  };

  if (loading)
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
          Loading...
        </div>
      </div>
    );

  if (clients.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight mb-4">
          Alert Settings
        </h1>
        <div className="text-center py-16 border border-dashed border-surface-border rounded-lg">
          <p className="text-slate-400 text-sm">Create a client first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Alert Settings
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure WhatsApp groups or numbers per client
          </p>
        </div>
        <button
          onClick={handleTest}
          disabled={testStatus === "sending"}
          className={`text-xs font-mono px-3 py-1.5 rounded ring-1 transition-colors ${
            testStatus === "sent"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              : testStatus === "failed"
              ? "bg-red-500/10 text-red-400 ring-red-500/20"
              : "bg-canvas-200 text-slate-400 ring-surface-border hover:text-slate-200"
          }`}
        >
          {testStatus === "sending"
            ? "SENDING..."
            : testStatus === "sent"
            ? "SENT"
            : testStatus === "failed"
            ? "FAILED"
            : "TEST DEFAULT"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Client selector + add button */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">CLIENT</span>
          <select
            value={selectedClient || ""}
            onChange={(e) => setSelectedClient(Number(e.target.value))}
            className="bg-canvas-200 border border-surface-border text-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent-teal/40"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={openCreate}
          className="bg-accent-teal/15 text-accent-teal px-4 py-1.5 rounded-lg text-sm font-medium
            hover:bg-accent-teal/25 transition-colors ring-1 ring-accent-teal/20 ml-auto"
        >
          + Add Channel
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-canvas-100 border border-surface-border rounded-xl shadow-2xl p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-bold text-slate-100 mb-5">
              {editing ? "Edit Channel" : "Add Notification Channel"}
            </h2>

            <FormField label="Channel" required>
              <select
                value={form.channel}
                onChange={set("channel")}
                className="form-input"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>

            {form.channel === "whatsapp" && (
              <>
                {/* Group vs Number toggle */}
                <div className="mb-4">
                  <span className="text-xs text-slate-400 font-mono block mb-2">
                    SEND TO
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientMode("group");
                        setForm((f) => ({ ...f, recipient: "" }));
                        if (!groups) loadGroups();
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono ring-1 transition-colors ${
                        recipientMode === "group"
                          ? "bg-accent-teal/15 ring-accent-teal/30 text-accent-teal"
                          : "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      GROUP CHAT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientMode("number");
                        setForm((f) => ({ ...f, recipient: "" }));
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono ring-1 transition-colors ${
                        recipientMode === "number"
                          ? "bg-accent-teal/15 ring-accent-teal/30 text-accent-teal"
                          : "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      PHONE NUMBER
                    </button>
                  </div>
                </div>

                {recipientMode === "group" ? (
                  <FormField label="WhatsApp Group" required>
                    {loadingGroups ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
                        Loading groups...
                      </div>
                    ) : groups && groups.length > 0 ? (
                      <select
                        required
                        value={form.recipient}
                        onChange={set("recipient")}
                        className="form-input"
                      >
                        <option value="">Select a group...</option>
                        {groups.map((g) => (
                          <option key={g.jid} value={g.jid}>
                            {g.name}
                            {g.participants ? ` (${g.participants} members)` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-slate-500 py-2">
                        No groups found. Make sure WaSender is connected and you have groups on your WhatsApp.
                        <button
                          type="button"
                          onClick={loadGroups}
                          className="text-accent-teal ml-2 hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </FormField>
                ) : (
                  <FormField label="Phone Number" required>
                    <input
                      required
                      value={form.recipient}
                      onChange={set("recipient")}
                      placeholder="15551234567 (with country code)"
                      className="form-input"
                    />
                  </FormField>
                )}
              </>
            )}

            {form.channel === "in_app" && (
              <FormField label="Recipient" required>
                <input
                  required
                  value={form.recipient}
                  onChange={set("recipient")}
                  placeholder="User identifier"
                  className="form-input"
                />
              </FormField>
            )}

            <FormField label="Mode">
              <select
                value={form.mode}
                onChange={set("mode")}
                className="form-input"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>

            {form.mode === "digest" && (
              <FormField label="Digest Time">
                <input
                  type="time"
                  value={form.digest_time}
                  onChange={set("digest_time")}
                  className="form-input"
                />
              </FormField>
            )}

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
                {editing ? "Save" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Config list */}
      {configs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-surface-border rounded-lg">
          <p className="text-slate-400 text-sm">
            No notification channels for this client.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 stagger">
          {configs.map((config) => {
            const isGroup = config.recipient?.endsWith("@g.us");
            return (
              <div
                key={config.id}
                className="bg-surface-raised border border-surface-border rounded-lg p-4 flex items-center gap-4
                  animate-slide-up hover:border-slate-600/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-sm font-semibold text-slate-200">
                      {config.channel === "whatsapp" ? "WhatsApp" : "In-App"}
                    </span>
                    {isGroup && (
                      <span className="text-xs font-mono bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded ring-1 ring-violet-500/20">
                        GROUP
                      </span>
                    )}
                    <span
                      className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ring-1 ${
                        config.is_active
                          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 ring-slate-500/20"
                      }`}
                    >
                      {config.is_active ? "ACTIVE" : "PAUSED"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {config.mode}
                      {config.mode === "digest" && config.digest_time
                        ? ` @ ${config.digest_time}`
                        : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {recipientLabel(config.recipient)}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleActive(config)}
                  className={`text-xs font-mono transition-colors ${
                    config.is_active
                      ? "text-slate-400 hover:text-amber-400"
                      : "text-emerald-400/60 hover:text-emerald-400"
                  }`}
                >
                  {config.is_active ? "PAUSE" : "ENABLE"}
                </button>
                <button
                  onClick={() => openEdit(config)}
                  className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  className="text-xs font-mono text-slate-500 hover:text-red-400 transition-colors"
                >
                  DEL
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <label className="block mb-4">
      <span className="text-xs text-slate-400 font-mono block mb-1.5">
        {label.toUpperCase()}
        {required && <span className="text-accent-teal ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
