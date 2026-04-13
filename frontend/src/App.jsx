import { Routes, Route, NavLink } from "react-router-dom";
import SignalFeed from "./pages/SignalFeed";
import SearchManager from "./pages/SearchManager";
import ClientManager from "./pages/ClientManager";
import ClientView from "./pages/ClientView";
import NotificationSettings from "./pages/NotificationSettings";
import { useScan } from "./ScanContext";
import { useEffect, useRef } from "react";

const navItems = [
  { to: "/", label: "Signals", icon: "◆" },
  { to: "/searches", label: "Searches", icon: "⌕" },
  { to: "/clients", label: "Clients", icon: "◎" },
  { to: "/notifications", label: "Alerts", icon: "⚡" },
];

export default function App() {
  const { scanning, scanLogs, stopScan, clearLogs } = useScan();
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [scanLogs]);

  const showLog = scanning || scanLogs.length > 0;

  return (
    <div className="min-h-screen bg-canvas bg-dotgrid bg-noise">
      <nav className="scanline sticky top-0 z-40 bg-canvas-50/80 backdrop-blur-xl px-6 py-3 flex items-center gap-8">
        <div className="flex items-center gap-2.5 mr-4">
          <span className={`w-2 h-2 rounded-full ${scanning ? "bg-blue-400 animate-pulse" : "bg-accent-teal animate-pulse"}`} />
          <span className="font-semibold text-sm tracking-wide text-slate-100">
            SIGNAL OPS
          </span>
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "text-accent-teal"
                  : "text-slate-500 hover:text-slate-300"
              }`
            }
            end={item.to === "/"}
          >
            <span className="text-xs opacity-60">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {scanning && (
            <span className="text-xs font-mono text-blue-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              SCANNING
            </span>
          )}
          {!scanning && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="text-xs text-slate-500 font-mono">LIVE</span>
            </span>
          )}
        </div>
      </nav>

      <main className={`relative z-10 max-w-7xl mx-auto px-6 py-6 ${showLog ? "pb-72" : ""}`}>
        <Routes>
          <Route path="/" element={<SignalFeed />} />
          <Route path="/searches" element={<SearchManager />} />
          <Route path="/clients" element={<ClientManager />} />
          <Route path="/clients/:id" element={<ClientView />} />
          <Route path="/notifications" element={<NotificationSettings />} />
        </Routes>
      </main>

      {/* Global scan log panel — fixed at bottom, persists across pages */}
      {showLog && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-canvas-50 border-t border-surface-border shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
            <div className="flex items-center gap-2">
              {scanning && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
              <span className="text-xs font-mono text-slate-400">
                {scanning ? "SCAN IN PROGRESS" : "SCAN LOG"}
              </span>
              <span className="text-xs font-mono text-slate-500">
                ({scanLogs.length} events)
              </span>
            </div>
            <div className="flex items-center gap-3">
              {scanning && (
                <button
                  onClick={stopScan}
                  className="text-xs font-mono text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded ring-1 ring-red-500/20"
                >
                  STOP SCAN
                </button>
              )}
              {!scanning && scanLogs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-2 max-h-56 overflow-y-auto font-mono text-xs">
            {scanLogs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="text-slate-500 shrink-0 w-16">{log.timestamp}</span>
                <span className={`shrink-0 w-20 ${
                  log.stage === "error" ? "text-red-400" :
                  log.stage === "stopped" ? "text-amber-400" :
                  log.stage === "done" ? "text-emerald-400" :
                  log.stage === "alert" ? "text-amber-400" :
                  log.stage === "score" ? "text-violet-400" :
                  log.stage === "classify" ? "text-blue-400" :
                  log.stage === "fetch" ? "text-accent-teal" :
                  log.stage === "filter" ? "text-orange-400" :
                  log.stage === "dedup" ? "text-cyan-400" :
                  log.stage === "gsc" ? "text-emerald-400" :
                  log.stage === "phrases" ? "text-pink-400" :
                  log.stage === "init" ? "text-slate-400" :
                  "text-slate-500"
                }`}>
                  [{log.stage}]
                </span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
