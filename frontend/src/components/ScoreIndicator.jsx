export default function ScoreIndicator({ score }) {
  const color =
    score >= 80
      ? "text-emerald-400"
      : score >= 60
      ? "text-amber-400"
      : score >= 40
      ? "text-slate-400"
      : "text-slate-500";

  const bg =
    score >= 80
      ? "bg-emerald-500/10"
      : score >= 60
      ? "bg-amber-500/10"
      : "bg-slate-500/5";

  const bars = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md ${bg}`}>
      {/* Signal strength bars */}
      <div className="flex items-end gap-[2px]">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`w-[3px] rounded-sm transition-colors ${
              level <= bars
                ? score >= 80
                  ? "bg-emerald-400"
                  : score >= 60
                  ? "bg-amber-400"
                  : "bg-slate-500"
                : "bg-slate-700"
            }`}
            style={{ height: `${4 + level * 3}px` }}
          />
        ))}
      </div>
      <span className={`font-mono font-bold text-base leading-none ${color}`}>
        {score}
      </span>
    </div>
  );
}
