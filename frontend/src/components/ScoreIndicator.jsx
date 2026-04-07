export default function ScoreIndicator({ score }) {
  const color =
    score >= 80
      ? "text-red-600"
      : score >= 60
      ? "text-orange-500"
      : score >= 40
      ? "text-yellow-500"
      : "text-gray-400";

  return <span className={`font-bold text-lg ${color}`}>{score}</span>;
}
