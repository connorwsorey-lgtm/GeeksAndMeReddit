export default function SourceIcon({ community }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400/80">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
      r/{community}
    </span>
  );
}
