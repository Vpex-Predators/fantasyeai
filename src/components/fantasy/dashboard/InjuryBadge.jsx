import { injuryBadge } from "@/lib/lineupOrder";

export default function InjuryBadge({ status }) {
  const badge = injuryBadge(status);
  if (!badge) return null;
  return (
    <span
      title={badge.title}
      className="inline-flex shrink-0 items-center rounded border border-rose-400/60 bg-rose-500/20 px-1 text-sm font-bold leading-4 text-rose-300"
    >
      {badge.label}
    </span>
  );
}