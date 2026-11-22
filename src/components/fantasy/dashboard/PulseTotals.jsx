import React from "react";
import { Trophy, Flame } from "lucide-react";
import GlossaryChip from "@/components/hud/GlossaryChip";

// Whole-league season totals with your team's share of the pie.
export default function PulseTotals({ totals, myTeam }) {
  const winShare = totals.wins ? Math.round(((myTeam?.wins || 0) / totals.wins) * 100) : 0;
  const ptsShare = totals.pointsFor
    ? Math.round(((myTeam?.pointsFor || 0) / totals.pointsFor) * 1000) / 10
    : 0;

  const stat = (label, value, sub) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center">
      <p className="font-mono text-base font-bold leading-none text-white">{value}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-white/70">{label}</p>
      {sub && <p className="mt-0.5 text-sm text-white/60">{sub}</p>}
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {stat("League wins", totals.wins, `${totals.teams} teams`)}
        {stat("Points scored", totals.pointsFor, `${totals.weeksPlayed} wk in the books`)}
        {stat("Your cut", `${winShare}%`, `of wins · ${ptsShare}% of pts`)}
      </div>
      <p className="mt-2 text-sm leading-snug text-white/60">
        Combined across all {totals.teams} teams — every win and every{" "}
        <GlossaryChip term="points for">point scored</GlossaryChip> banked so far this season.
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-white/60">
        <Flame className="h-3 w-3 text-amber-400" />
        <span>Every game one manager wins, another one loses</span>
        <Trophy className="h-3 w-3 text-emerald-400/70" />
      </div>
    </div>
  );
}