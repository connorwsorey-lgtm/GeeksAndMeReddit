const INTENT_STYLES = {
  recommendation_request: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  comparison: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
  complaint: "bg-red-500/10 text-red-400 ring-red-500/20",
  question: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  review: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  local: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  purchase_intent: "bg-pink-500/10 text-pink-400 ring-pink-500/20",
};

const INTENT_LABELS = {
  recommendation_request: "rec request",
  comparison: "comparison",
  complaint: "complaint",
  question: "question",
  review: "review",
  local: "local",
  purchase_intent: "purchase",
};

export default function IntentBadge({ intent }) {
  const style = INTENT_STYLES[intent] || "bg-slate-500/10 text-slate-400 ring-slate-500/20";
  const label = INTENT_LABELS[intent] || intent.replace("_", " ");
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ring-1 ${style}`}
    >
      {label}
    </span>
  );
}
