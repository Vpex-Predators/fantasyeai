import React from "react";

// Compact whole-league leaderboard, sorted by record then points for.
export default function PulseLeaderboard({ teams, myTeamId }) {
  const sorted = [...teams].sort((a, b) =>
    ((b.wins + (b.ties || 0) * 0.5) - (a.wins + (a.ties || 0) * 0.5)) || (b.pointsFor - a.pointsFor)
  );
  if (!sorted.length) return null;
  const maxPts = Math.max(...sorted.map(t => t.pointsFor || 0), 1);

  return (
    <div>
      <h3 className="mb-1.5 font-heading text-sm font-bold uppercase tracking-[0.2em] text-white/70">
        League standings
      </h3>
      <ul className="space-y-1">
        {sorted.map((t, i) => {
          const mine = t.id === myTeamId;
          return (
            <li key={t.id} className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
              <div
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 ${mine ? "bg-emerald-400/15" : "bg-white/[0.06]"}`}
                style={{ width: `${Math.max(6, ((t.pointsFor || 0) / maxPts) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between gap-2 text-sm">
                <span className={`truncate font-semibold ${mine ? "text-emerald-300" : "text-white"}`}>
                  {i + 1}. {t.name}
                </span>
                <span className="shrink-0 font-mono text-sm text-white/70">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""} · {t.pointsFor} pts
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}