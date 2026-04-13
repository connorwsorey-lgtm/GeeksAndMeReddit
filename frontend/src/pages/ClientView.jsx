import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  updateClient,
  analyzeWebsite,
  auditSuggestions,
  getClientDashboard,
  getClient,
  getSearches,
  getSignals,
  updateSignalStatus,
  getGscAuthUrl,
  getGscProperties,
  selectGscProperty,
  getGscTopQueries,
  disconnectGsc,
  getPhrases,
  createPhrase,
  togglePhrase,
  deletePhrase,
  generatePhrases,
  toggleGscKeyword,
} from "../api";
import SignalCard from "../components/SignalCard";

export default function ClientView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [client, setClient] = useState(null);
  const [searches, setSearches] = useState([]);
  const [recentSignals, setRecentSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // GSC
  const [gscProperties, setGscProperties] = useState(null);
  const [gscQueries, setGscQueries] = useState(null);
  const [gscLoading, setGscLoading] = useState(false);

  // Website analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState(new Set());
  const [showScrapedData, setShowScrapedData] = useState(false);
  const [auditing, setAuditing] = useState(false);

  // Edit client
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Phrases
  const [phrases, setPhrases] = useState([]);
  const [newPhrase, setNewPhrase] = useState("");
  const [generatingPhrases, setGeneratingPhrases] = useState(false);

  useEffect(() => {
    loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dash, cl, srch, sigs, ph] = await Promise.all([
        getClientDashboard(id),
        getClient(id),
        getSearches(id),
        getSignals({ client_id: id, limit: 10 }),
        getPhrases(id),
      ]);
      setDashboard(dash);
      setClient(cl);
      setSearches(srch);
      setRecentSignals(sigs);
      setPhrases(ph);

      if (cl.gsc_tokens && cl.gsc_property) {
        try {
          const q = await getGscTopQueries(id);
          setGscQueries(q.queries);
        } catch {}
      }
      if (searchParams.get("gsc") === "connected" && cl.gsc_tokens && !cl.gsc_property) {
        await loadProperties();
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const loadProperties = async () => {
    setGscLoading(true);
    try {
      const result = await getGscProperties(id);
      setGscProperties(result.properties);
    } catch (e) {
      setError("Failed to load GSC properties: " + e.message);
    }
    setGscLoading(false);
  };

  const handleConnectGsc = async () => {
    try {
      const result = await getGscAuthUrl(id);
      window.location.href = result.auth_url;
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSelectProperty = async (url) => {
    try {
      await selectGscProperty(id, url);
      setGscProperties(null);
      const q = await getGscTopQueries(id);
      setGscQueries(q.queries);
      const cl = await getClient(id);
      setClient(cl);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDisconnectGsc = async () => {
    if (!confirm("Disconnect Google Search Console?")) return;
    try {
      await disconnectGsc(id);
      setGscQueries(null);
      setGscProperties(null);
      const cl = await getClient(id);
      setClient(cl);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExcludeAllGsc = async () => {
    if (!gscQueries) return;
    const allQueries = gscQueries.map((q) => q.query);
    setClient((prev) => ({ ...prev, gsc_excluded_queries: allQueries }));
    for (const q of allQueries) {
      try { await toggleGscKeyword(id, q, true); } catch {}
    }
  };

  const handleEnableAllGsc = async () => {
    setClient((prev) => ({ ...prev, gsc_excluded_queries: [] }));
    for (const q of (client.gsc_excluded_queries || [])) {
      try { await toggleGscKeyword(id, q, false); } catch {}
    }
  };

  const handleToggleGscQuery = async (query, currentlyExcluded) => {
    // Optimistic update — flip immediately in UI
    const newExcluded = currentlyExcluded
      ? (client.gsc_excluded_queries || []).filter((q) => q !== query)
      : [...(client.gsc_excluded_queries || []), query];
    setClient((prev) => ({ ...prev, gsc_excluded_queries: newExcluded }));

    try {
      await toggleGscKeyword(id, query, !currentlyExcluded);
    } catch (e) {
      // Revert on failure
      setClient((prev) => ({
        ...prev,
        gsc_excluded_queries: currentlyExcluded
          ? [...(prev.gsc_excluded_queries || []), query]
          : (prev.gsc_excluded_queries || []).filter((q) => q !== query),
      }));
      setError(e.message);
    }
  };

  const handleAddPhrase = async (e) => {
    e.preventDefault();
    if (!newPhrase.trim()) return;
    try {
      await createPhrase({ client_id: Number(id), phrase: newPhrase.trim() });
      setNewPhrase("");
      setPhrases(await getPhrases(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleTogglePhrase = async (phraseId) => {
    try {
      await togglePhrase(phraseId);
      setPhrases(await getPhrases(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeletePhrase = async (phraseId) => {
    try {
      await deletePhrase(phraseId);
      setPhrases(await getPhrases(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleGeneratePhrases = async () => {
    setGeneratingPhrases(true);
    try {
      await generatePhrases(id);
      setPhrases(await getPhrases(id));
    } catch (e) {
      setError("Phrase generation failed: " + e.message);
    }
    setGeneratingPhrases(false);
  };

  const handleStatusChange = async (signalId, newStatus) => {
    try {
      await updateSignalStatus(signalId, newStatus);
      setRecentSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, status: newStatus } : s))
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAnalyzeWebsite = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeWebsite(id);
      setAnalysisResult(result);
      // Refresh client data (may have been auto-updated)
      const cl = await getClient(id);
      setClient(cl);
      // Pre-fill edit form if user wants to review
      if (result.fields_updated?.length > 0) {
        setEditForm({
          name: cl.name || "",
          website: cl.website || "",
          location: cl.location || "",
          vertical: cl.vertical || "",
          products_services: cl.products_services || "",
          competitors: cl.competitors || "",
        });
      }
    } catch (e) {
      setError("Website analysis failed: " + e.message);
    }
    setAnalyzing(false);
  };

  const toggleSub = (s) => setSelectedSubs((prev) => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const toggleKeyword = (k) => setSelectedKeywords((prev) => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const selectAllSubs = () => {
    if (analysisResult?.suggested_subreddits) {
      setSelectedSubs(new Set(analysisResult.suggested_subreddits));
    }
  };

  const selectAllKeywords = () => {
    if (analysisResult?.suggested_keywords) {
      setSelectedKeywords(new Set(analysisResult.suggested_keywords));
    }
  };

  const handleInsertIntoSearch = () => {
    const subs = [...selectedSubs].join(", ");
    const kws = [...selectedKeywords].join(", ");
    const text = [subs && `Subreddits: ${subs}`, kws && `Keywords: ${kws}`].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    alert(`Copied to clipboard!\n\nPaste into a search form:\n${text}`);
  };

  const [auditResult, setAuditResult] = useState(null);

  const handleClaudeAudit = async () => {
    setAuditing(true);
    setAuditResult(null);
    try {
      const result = await auditSuggestions(id, [...selectedSubs], [...selectedKeywords]);
      setAuditResult(result);
    } catch (e) {
      setError("Audit failed: " + e.message);
    }
    setAuditing(false);
  };

  const openEditClient = () => {
    setEditForm({
      name: client.name || "",
      website: client.website || "",
      location: client.location || "",
      vertical: client.vertical || "",
      products_services: client.products_services || "",
      competitors: client.competitors || "",
    });
    setShowEdit(true);
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    try {
      await updateClient(id, editForm);
      const cl = await getClient(id);
      setClient(cl);
      setShowEdit(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const setField = (field) => (e) =>
    setEditForm((f) => ({ ...f, [field]: e.target.value }));

  if (loading)
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
          Loading...
        </div>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg text-sm">
        {error}
      </div>
    );

  if (!dashboard || !client) return null;

  const excluded = client.gsc_excluded_queries || [];
  const gscConnected = !!client.gsc_tokens;
  const gscPropertySet = !!client.gsc_property;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clients" className="text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors">
          CLIENTS
        </Link>
        <span className="text-slate-500">/</span>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">{client.name}</h1>
        {client.vertical && (
          <span className="text-xs font-mono bg-canvas-200 text-slate-400 px-2 py-0.5 rounded ring-1 ring-surface-border">
            {client.vertical}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {client.website && (
            <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-mono text-accent-teal/70 hover:text-accent-teal transition-colors">
              {client.website}
            </a>
          )}
          {client.website && (
            <button
              onClick={handleAnalyzeWebsite}
              disabled={analyzing}
              className="text-xs font-mono text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg
                ring-1 ring-violet-500/20 hover:ring-violet-500/40 transition-colors disabled:opacity-30"
            >
              {analyzing ? "ANALYZING..." : "SCAN WEBSITE"}
            </button>
          )}
          <button
            onClick={openEditClient}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg
              ring-1 ring-surface-border hover:ring-slate-500 transition-colors"
          >
            EDIT CLIENT
          </button>
        </div>
      </div>

      {/* Website analysis result */}
      {analysisResult && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-mono font-semibold text-violet-400">WEBSITE ANALYSIS</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowScrapedData(!showScrapedData)}
                className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showScrapedData ? "HIDE RAW DATA" : "VIEW RAW DATA"}
              </button>
              <button onClick={() => { setAnalysisResult(null); setAuditResult(null); setSelectedSubs(new Set()); setSelectedKeywords(new Set()); }}
                className="text-xs font-mono text-slate-500 hover:text-slate-300">DISMISS</button>
            </div>
          </div>

          <p className="text-sm text-slate-200 mb-3">{analysisResult.description}</p>

          {analysisResult.service_areas?.length > 0 && (
            <p className="text-sm text-slate-400 mb-3">
              <span className="text-slate-500">Service areas:</span> {analysisResult.service_areas.join(", ")}
            </p>
          )}

          {analysisResult.fields_updated?.length > 0 && (
            <p className="text-xs text-emerald-400 mb-3">Auto-updated fields: {analysisResult.fields_updated.join(", ")}</p>
          )}

          {/* Raw scraped data viewer */}
          {showScrapedData && (
            <div className="bg-canvas/50 border border-surface-border rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
              <p className="text-xs font-mono text-slate-500 mb-2">
                PAGES VISITED: {(analysisResult._pages_visited || []).join(", ")}
              </p>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                {analysisResult._scraped_homepage}
                {analysisResult._scraped_pages && "\n\n" + analysisResult._scraped_pages}
              </pre>
            </div>
          )}

          {/* Subreddits — selectable */}
          {analysisResult.suggested_subreddits?.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-slate-400">SUBREDDITS</span>
                <button onClick={selectAllSubs} className="text-xs font-mono text-accent-teal/70 hover:text-accent-teal transition-colors">SELECT ALL</button>
                <button onClick={() => setSelectedSubs(new Set())} className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors">CLEAR</button>
                <span className="text-xs font-mono text-slate-500">{selectedSubs.size} selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisResult.suggested_subreddits.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSub(s)}
                    className={`text-xs font-mono px-3 py-1.5 rounded ring-1 transition-all ${
                      selectedSubs.has(s)
                        ? "bg-accent-teal/20 ring-accent-teal/40 text-accent-teal"
                        : "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {s.startsWith("r/") ? s : `r/${s}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keywords — selectable */}
          {analysisResult.suggested_keywords?.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-slate-400">KEYWORDS</span>
                <button onClick={selectAllKeywords} className="text-xs font-mono text-blue-400/70 hover:text-blue-400 transition-colors">SELECT ALL</button>
                <button onClick={() => setSelectedKeywords(new Set())} className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors">CLEAR</button>
                <span className="text-xs font-mono text-slate-500">{selectedKeywords.size} selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisResult.suggested_keywords.map((k) => (
                  <button
                    key={k}
                    onClick={() => toggleKeyword(k)}
                    className={`text-xs font-mono px-3 py-1.5 rounded ring-1 transition-all ${
                      selectedKeywords.has(k)
                        ? "bg-blue-500/20 ring-blue-500/40 text-blue-300"
                        : "bg-canvas-200 ring-surface-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action bar */}
          {(selectedSubs.size > 0 || selectedKeywords.size > 0) && (
            <div className="flex items-center gap-3 pt-3 border-t border-violet-500/20">
              <button
                onClick={handleInsertIntoSearch}
                className="bg-accent-teal/15 text-accent-teal px-4 py-2 rounded-lg text-xs font-mono font-medium
                  hover:bg-accent-teal/25 transition-colors ring-1 ring-accent-teal/20"
              >
                COPY SELECTED ({selectedSubs.size + selectedKeywords.size})
              </button>
              <button
                onClick={handleClaudeAudit}
                disabled={auditing}
                className="bg-violet-500/15 text-violet-400 px-4 py-2 rounded-lg text-xs font-mono font-medium
                  hover:bg-violet-500/25 transition-colors ring-1 ring-violet-500/20 disabled:opacity-30"
              >
                {auditing ? "AUDITING..." : "CLAUDE AUDIT SELECTED"}
              </button>
            </div>
          )}

          {/* Audit results */}
          {auditResult && (
            <div className="mt-4 pt-4 border-t border-violet-500/20">
              <span className="text-sm font-mono font-semibold text-violet-400 block mb-3">CLAUDE AUDIT</span>

              {auditResult.subreddits?.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs font-mono text-slate-400 block mb-2">SUBREDDITS</span>
                  <div className="space-y-1.5">
                    {auditResult.subreddits.map((s) => (
                      <div key={s.name} className="flex items-center gap-3 text-xs">
                        <span className={`font-mono font-medium w-12 ${
                          s.verdict === "keep" ? "text-emerald-400" : s.verdict === "maybe" ? "text-amber-400" : "text-red-400"
                        }`}>{s.verdict.toUpperCase()}</span>
                        <span className="text-slate-200 font-mono w-32">{s.name.startsWith("r/") ? s.name : `r/${s.name}`}</span>
                        <span className="text-slate-400 flex-1">{s.reason}</span>
                        <span className={`font-mono text-xs ${
                          s.estimated_volume === "high" ? "text-emerald-400" : s.estimated_volume === "medium" ? "text-amber-400" : "text-slate-500"
                        }`}>{s.estimated_volume}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {auditResult.keywords?.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs font-mono text-slate-400 block mb-2">KEYWORDS</span>
                  <div className="space-y-1.5">
                    {auditResult.keywords.map((k) => (
                      <div key={k.term} className="flex items-center gap-3 text-xs">
                        <span className={`font-mono font-medium w-12 ${
                          k.verdict === "keep" ? "text-emerald-400" : k.verdict === "maybe" ? "text-amber-400" : "text-red-400"
                        }`}>{k.verdict.toUpperCase()}</span>
                        <span className="text-slate-200 w-48">{k.term}</span>
                        <span className="text-slate-400 flex-1">{k.reason}</span>
                        {k.suggested_alternative && (
                          <span className="text-blue-400 font-mono">{k.suggested_alternative}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {auditResult.missing?.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-amber-400 block mb-2">MISSING — Claude suggests adding:</span>
                  <div className="flex flex-wrap gap-2">
                    {auditResult.missing.map((m) => (
                      <span key={m} className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded ring-1 ring-amber-500/20">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit client modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <form
            onSubmit={handleEditClient}
            className="bg-canvas-100 border border-surface-border rounded-xl shadow-2xl p-6 w-full max-w-lg"
          >
            <h2 className="text-lg font-bold text-slate-100 mb-5">Edit Client</h2>

            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">NAME *</span>
              <input required value={editForm.name} onChange={setField("name")} className="form-input" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">WEBSITE</span>
              <input value={editForm.website} onChange={setField("website")} placeholder="fuelresults.com" className="form-input" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">LOCATION</span>
              <input value={editForm.location} onChange={setField("location")} placeholder="Purvis, MS" className="form-input" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">VERTICAL</span>
              <input value={editForm.vertical} onChange={setField("vertical")} className="form-input" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">PRODUCTS / SERVICES</span>
              <textarea value={editForm.products_services} onChange={setField("products_services")} rows={2} className="form-input" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-400 font-mono block mb-1.5">COMPETITORS</span>
              <textarea value={editForm.competitors} onChange={setField("competitors")} rows={2} className="form-input" />
            </label>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="bg-accent-teal/15 text-accent-teal px-5 py-2 rounded-lg text-sm font-medium hover:bg-accent-teal/25 transition-colors ring-1 ring-accent-teal/20">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6 stagger">
        <StatCard label="TOTAL SIGNALS" value={dashboard.total_signals} />
        <StatCard label="ACTIONED" value={dashboard.actioned} color="text-emerald-400" />
        <StatCard label="ACTION RATE" value={`${dashboard.action_rate}%`}
          color={dashboard.action_rate >= 20 ? "text-emerald-400" : "text-slate-300"} />
        <StatCard label="AVG SCORE" value={dashboard.average_score} />
      </div>

      {/* GSC Panel */}
      <div className="bg-surface border border-surface-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-slate-400 font-mono font-medium">GOOGLE SEARCH CONSOLE</h2>
          {gscConnected ? (
            <div className="flex items-center gap-3">
              {gscPropertySet && <span className="text-xs font-mono text-slate-400">{client.gsc_property}</span>}
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />CONNECTED
              </span>
              <button onClick={handleDisconnectGsc}
                className="text-xs font-mono text-slate-500 hover:text-red-400 transition-colors">
                DISCONNECT
              </button>
            </div>
          ) : (
            <button onClick={handleConnectGsc}
              className="bg-blue-500/15 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-mono font-medium hover:bg-blue-500/25 transition-colors ring-1 ring-blue-500/20">
              CONNECT GSC
            </button>
          )}
        </div>

        {gscProperties && !gscPropertySet && (
          <div className="mt-3">
            <p className="text-xs text-slate-400 mb-2">Select a property:</p>
            <div className="space-y-1.5">
              {gscProperties.map((p) => (
                <button key={p.url} onClick={() => handleSelectProperty(p.url)}
                  className="block w-full text-left bg-canvas-200 border border-surface-border rounded px-3 py-2 text-sm text-slate-300 hover:border-blue-500/40 transition-colors">
                  {p.url}
                  <span className="text-xs text-slate-500 ml-2">{p.permission}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GSC keywords with toggle */}
        {gscQueries && gscQueries.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">
                KEYWORDS — click to include/exclude
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">
                  {gscQueries.filter((q) => !excluded.includes(q.query)).length} / {gscQueries.length} active
                </span>
                <button
                  onClick={handleEnableAllGsc}
                  className="text-xs font-mono text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  ENABLE ALL
                </button>
                <button
                  onClick={handleExcludeAllGsc}
                  className="text-xs font-mono text-red-400/70 hover:text-red-400 transition-colors"
                >
                  DISABLE ALL
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
              {gscQueries.map((q) => {
                const isExcluded = excluded.includes(q.query);
                return (
                  <button
                    key={q.query}
                    onClick={() => handleToggleGscQuery(q.query, isExcluded)}
                    className={`px-3 py-1.5 rounded text-xs font-mono ring-1 transition-all ${
                      isExcluded
                        ? "bg-canvas-200 ring-surface-border text-slate-500 line-through opacity-40"
                        : "bg-accent-teal/10 ring-accent-teal/20 text-accent-teal"
                    }`}
                    title={`${q.clicks} clicks, ${q.impressions} impressions, pos ${q.position}`}
                  >
                    {q.query}
                    <span className="ml-1.5 text-xs opacity-50">{q.clicks}c</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!gscConnected && (
          <p className="text-xs text-slate-500">Connect GSC to pull search queries and boost scan accuracy.</p>
        )}
      </div>

      {/* Seed Phrases Panel */}
      <div className="bg-surface border border-surface-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-slate-400 font-mono font-medium">
            SEED PHRASES
            <span className="ml-2 text-slate-500">
              ({phrases.filter((p) => p.is_active).length} active)
            </span>
          </h2>
          <button
            onClick={handleGeneratePhrases}
            disabled={generatingPhrases}
            className="bg-violet-500/15 text-violet-400 px-3 py-1.5 rounded-lg text-xs font-mono font-medium
              hover:bg-violet-500/25 transition-colors disabled:opacity-30 ring-1 ring-violet-500/20"
          >
            {generatingPhrases ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                GENERATING...
              </span>
            ) : (
              "AI GENERATE"
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Example posts people would write when they need this client's services. The scanner uses these to recognize similar posts even with different wording.
        </p>

        {/* Add phrase form */}
        <form onSubmit={handleAddPhrase} className="flex gap-2 mb-3">
          <input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder="e.g. I got hurt in a car accident and can't afford an attorney"
            className="form-input flex-1 !mt-0"
          />
          <button
            type="submit"
            disabled={!newPhrase.trim()}
            className="bg-accent-teal/15 text-accent-teal px-3 py-2 rounded-lg text-xs font-mono font-medium
              hover:bg-accent-teal/25 transition-colors disabled:opacity-30 ring-1 ring-accent-teal/20 shrink-0"
          >
            ADD
          </button>
        </form>

        {/* Phrase list */}
        {phrases.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No phrases yet. Add manually or hit AI Generate.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {phrases.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm group transition-colors ${
                  p.is_active
                    ? "bg-canvas-200/50 text-slate-300"
                    : "bg-canvas-200/20 text-slate-600"
                }`}
              >
                <button
                  onClick={() => handleTogglePhrase(p.id)}
                  className={`w-4 h-4 rounded border shrink-0 transition-colors ${
                    p.is_active
                      ? "bg-accent-teal/20 border-accent-teal/40"
                      : "bg-transparent border-slate-600"
                  }`}
                >
                  {p.is_active && (
                    <span className="text-accent-teal text-xs flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </button>
                <span className={`flex-1 text-xs ${!p.is_active && "line-through opacity-50"}`}>
                  {p.phrase}
                </span>
                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                  {p.source}
                </span>
                <button
                  onClick={() => handleDeletePhrase(p.id)}
                  className="text-slate-600 hover:text-red-400 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  DEL
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h2 className="text-xs text-slate-400 font-mono font-medium mb-3">TOP COMMUNITIES</h2>
          {dashboard.top_communities.length === 0 ? (
            <p className="text-xs text-slate-500">No data yet</p>
          ) : (
            <div className="space-y-2">
              {dashboard.top_communities.map((c, i) => (
                <div key={c.community} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 w-4">{i + 1}.</span>
                    <span className="text-sm text-slate-300 font-mono">r/{c.community}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-surface border border-surface-border rounded-lg p-4">
          <h2 className="text-xs text-slate-400 font-mono font-medium mb-3">SEARCHES</h2>
          {searches.length === 0 ? (
            <p className="text-xs text-slate-500">No searches configured</p>
          ) : (
            <div className="space-y-2">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? "bg-emerald-400" : "bg-slate-500"}`} />
                    <span className="text-sm text-slate-300">{s.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{s.scan_frequency.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent signals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-slate-400 font-mono font-medium">RECENT SIGNALS</h2>
          <Link to={`/?client_id=${id}`}
            className="text-xs font-mono text-accent-teal/70 hover:text-accent-teal transition-colors">
            VIEW ALL
          </Link>
        </div>
        {recentSignals.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-surface-border rounded-lg">
            <p className="text-slate-400 text-sm">No signals yet. Run a scan from Searches.</p>
          </div>
        ) : (
          <div className="space-y-2.5 stagger">
            {recentSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-100" }) {
  return (
    <div className="bg-surface border border-surface-border rounded-lg p-4 animate-slide-up">
      <p className="text-xs text-slate-400 font-mono mb-1.5">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
