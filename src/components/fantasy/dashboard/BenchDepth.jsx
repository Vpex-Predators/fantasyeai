import React from "react";
import InjuryBadge from "./InjuryBadge";
import { usePlayerNames } from "@/components/PlayerNameProvider";

// Depth points: actuals if the player's game is live/over, projection otherwise.
const eff = p => (p && p.livePoints != null ? p.livePoints : (p && p.weeklyProj) || 0);

function BenchColumn({ title, tone, players }) {
  const short = usePlayerNames();
  const sorted = [...(players || [])].sort((a, b) => eff(b) - eff(a));
  return (
    <div className="min-w-0 flex-1">
      <p className={`mb-1.5 truncate text-sm font-bold uppercase tracking-wider ${tone}`}>{title}</p>
      <div className="space-y-1">
        {sorted.length === 0 && <p className="text-sm text-white/35">Empty bench</p>}
        {sorted.slice(0, 6).map(p => (
          <div key={p.id} className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate text-white/70">{short(p.name)}</span>
            <InjuryBadge status={p.injuryStatus} />
            <span className="ml-auto shrink-0 font-mono text-white/50">{eff(p).toFixed(1)}</span>
          </div>
        ))}
        {sorted.length > 6 && <p className="text-sm text-white/30">+{sorted.length - 6} more</p>}
      </div>
    </div>
  );
}

// Side-by-side bench comparison — who has the stronger depth this week.
export default function BenchDepth({ myBench, oppBench, myName, oppName }) {
  const myTotal = (myBench || []).reduce((s, p) => s + eff(p), 0);
  const oppTotal = (oppBench || []).reduce((s, p) => s + eff(p), 0);
  const diff = myTotal - oppTotal;
  const myPct = Math.round((myTotal / Math.max(myTotal + oppTotal, 1)) * 100);

  const verdict =
    diff >= 1 ? `You have the stronger bench — +${diff.toFixed(1)} projected points of depth.`
    : diff <= -1 ? `They have the stronger bench — +${Math.abs(diff).toFixed(1)} projected points of depth.`
    : "Benches are about even.";

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40">Bench depth</h3>
        <span className="text-sm text-white/40">{myTotal.toFixed(1)} vs {oppTotal.toFixed(1)}</span>
      </div>
      <div className="flex gap-3">
        <BenchColumn title={myName} tone="text-emerald-300/90" players={myBench} />
        <BenchColumn title={oppName} tone="text-rose-300/90" players={oppBench} />
      </div>
      <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-white/10">
        <div className="bg-emerald-400" style={{ width: myPct + "%" }} />
        <div className="flex-1 bg-rose-400/70" />
      </div>
      <p className="mt-2 text-sm font-semibold text-white/75">{verdict}</p>
      <p className="text-sm text-white/35">Bench points don't count toward the matchup totals.</p>
    </div>
  );
}