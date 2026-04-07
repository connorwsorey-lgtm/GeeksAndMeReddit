const INTENT_COLORS = {
  recommendation_request: "bg-green-100 text-green-800",
  comparison: "bg-blue-100 text-blue-800",
  complaint: "bg-red-100 text-red-800",
  question: "bg-yellow-100 text-yellow-800",
  review: "bg-purple-100 text-purple-800",
  local: "bg-orange-100 text-orange-800",
  purchase_intent: "bg-pink-100 text-pink-800",
};

export default function IntentBadge({ intent }) {
  const color = INTENT_COLORS[intent] || "bg-gray-100 text-gray-800";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {intent.replace("_", " ")}
    </span>
  );
}
