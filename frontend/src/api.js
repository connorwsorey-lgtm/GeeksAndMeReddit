const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Clients
export const getClients = () => request("/clients");
export const getClient = (id) => request(`/clients/${id}`);
export const createClient = (data) =>
  request("/clients", { method: "POST", body: JSON.stringify(data) });
export const updateClient = (id, data) =>
  request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteClient = (id) =>
  request(`/clients/${id}`, { method: "DELETE" });

// Searches
export const getSearches = (clientId) =>
  request(`/searches${clientId ? `?client_id=${clientId}` : ""}`);
export const getSearch = (id) => request(`/searches/${id}`);
export const createSearch = (data) =>
  request("/searches", { method: "POST", body: JSON.stringify(data) });
export const updateSearch = (id, data) =>
  request(`/searches/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSearch = (id) =>
  request(`/searches/${id}`, { method: "DELETE" });
export const triggerScan = (id) =>
  request(`/searches/${id}/scan`, { method: "POST" });

// Signals
export const getSignals = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "")
  ).toString();
  return request(`/signals${query ? `?${query}` : ""}`);
};
export const getSignal = (id) => request(`/signals/${id}`);
export const updateSignalStatus = (id, status) =>
  request(`/signals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const getSignalStats = (clientId) =>
  request(`/signals/stats${clientId ? `?client_id=${clientId}` : ""}`);

// Notifications
export const getNotificationConfigs = (clientId) =>
  request(`/notifications/config/${clientId}`);
export const createNotificationConfig = (data) =>
  request("/notifications/config", { method: "POST", body: JSON.stringify(data) });
export const updateNotificationConfig = (id, data) =>
  request(`/notifications/config/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const deleteNotificationConfig = (id) =>
  request(`/notifications/config/${id}`, { method: "DELETE" });
export const testNotification = () =>
  request("/notifications/test", { method: "POST" });
export const getWhatsAppGroups = () =>
  request("/notifications/whatsapp-groups");

// Suggestions
export const getSuggestions = (clientId) =>
  request(`/suggestions/suggest?client_id=${clientId}`, { method: "POST" });

// Phrases
export const getPhrases = (clientId) => request(`/phrases/${clientId}`);
export const createPhrase = (data) =>
  request("/phrases", { method: "POST", body: JSON.stringify(data) });
export const togglePhrase = (id) =>
  request(`/phrases/${id}/toggle`, { method: "PATCH" });
export const deletePhrase = (id) =>
  request(`/phrases/${id}`, { method: "DELETE" });
export const generatePhrases = (clientId) =>
  request(`/phrases/generate?client_id=${clientId}`, { method: "POST" });
export const toggleGscKeyword = (clientId, query, exclude) =>
  request(
    `/phrases/gsc-exclude?client_id=${clientId}&query=${encodeURIComponent(query)}&exclude=${exclude}`,
    { method: "POST" }
  );

// GSC
export const getGscAuthUrl = (clientId) =>
  request(`/gsc/auth-url?client_id=${clientId}`);
export const getGscProperties = (clientId) =>
  request(`/gsc/properties?client_id=${clientId}`);
export const selectGscProperty = (clientId, propertyUrl) =>
  request(
    `/gsc/select-property?client_id=${clientId}&property_url=${encodeURIComponent(propertyUrl)}`,
    { method: "POST" }
  );
export const getGscTopQueries = (clientId, days = 28) =>
  request(`/gsc/top-queries?client_id=${clientId}&days=${days}`);
export const getGscTopPages = (clientId, days = 28) =>
  request(`/gsc/top-pages?client_id=${clientId}&days=${days}`);
export const disconnectGsc = (clientId) =>
  request(`/gsc/disconnect?client_id=${clientId}`, { method: "DELETE" });

// Browser
export const analyzeWebsite = (clientId) =>
  request(`/browser/analyze-website?client_id=${clientId}`, { method: "POST" });
export const discoverSubreddits = (subreddit) =>
  request(`/browser/discover-subreddits?subreddit=${encodeURIComponent(subreddit)}`);
export const auditSuggestions = (clientId, subreddits, keywords) =>
  request(`/browser/audit-suggestions?client_id=${clientId}`, {
    method: "POST",
    body: JSON.stringify({ subreddits, keywords }),
  });

// Dashboard
export const getDashboardOverview = () => request("/dashboard/overview");
export const getClientDashboard = (id) => request(`/dashboard/client/${id}`);
