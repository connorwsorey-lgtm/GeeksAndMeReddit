import IntentBadge from "./IntentBadge";
import ScoreIndicator from "./ScoreIndicator";

const STATUS_OPTIONS = ["new", "viewed", "actioned", "dismissed"];

const STATUS_STYLES = {
  new: "bg-blue-500/15 text-blue-400",
  viewed: "bg-slate-500/15 text-slate-400",
  actioned: "bg-emerald-500/15 text-emerald-400",
  dismissed: "bg-red-500/10 text-red-400/60",
};

export default function SignalCard({ signal, onStatusChange }) {
  const glowClass =
    signal.relevance_score >= 80
      ? "card-glow-high"
      : signal.relevance_score >= 60
      ? "card-glow-medium"
      : "";

  const gapClass = signal.thread_gap_detected ? "gap-pulse" : "";

  return (
    <div
      className={`bg-surface-raised border border-surface-border rounded-lg p-4
        transition-all duration-200 hover:border-slate-600/50 animate-slide-up
        ${glowClass} ${gapClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
              r/{signal.community}
            </span>

            {signal.thread_gap_detected && (
              <span className="text-xs font-mono font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded ring-1 ring-accent-teal/20">
                CONTENT GAP
              </span>
            )}

            <span className="text-xs text-slate-400 font-mono ml-auto">
              {timeAgo(signal.post_created_at)}
            </span>
          </div>

          {/* Title */}
          <a
            href={signal.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-slate-200 hover:text-accent-teal transition-colors line-clamp-2 block mb-1.5"
          >
            {signal.post_title}
          </a>

          {/* Summary */}
          {signal.signal_summary && (
            <p className="text-xs text-slate-500 mb-2.5 line-clamp-2 leading-relaxed">
              {signal.signal_summary}
            </p>
          )}

          {/* Intent badges */}
          <div className="flex flex-wrap gap-1.5">
            {(signal.intent_labels || []).map((intent) => (
              <IntentBadge key={intent} intent={intent} />
            ))}
          </div>
        </div>

        {/* Right: score + status */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">
          <ScoreIndicator score={signal.relevance_score} />

          <select
            value={signal.status}
            onChange={(e) => onStatusChange(signal.id, e.target.value)}
            className={`text-xs font-mono font-medium px-2 py-1 rounded border-0
              cursor-pointer appearance-none ${
                STATUS_STYLES[signal.status] || "bg-slate-500/15 text-slate-400"
              }`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-mono">
            {signal.engagement_score} eng
          </span>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const then = new Date(dateStr);
  const hours = Math.floor((now - then) / 3600000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d";
  return `${days}d`;
}
