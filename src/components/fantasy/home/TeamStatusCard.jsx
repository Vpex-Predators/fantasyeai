import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import HudPanel from "@/components/hud/HudPanel";
import OpenButton from "@/components/hud/OpenButton";
import { injuryBadge } from "@/lib/lineupOrder";
import { usePlayerNames } from "@/components/PlayerNameProvider";

// My team doorway: projected lineup total plus injury risk inside the
// starting lineup. A tap opens the full My Team command deck.
export default function TeamStatusCard({ data, delay = 0 }) {
  const short = usePlayerNames();
  const { myTeam } = data;
  const starters = myTeam.starters || [];
  const bench = myTeam.bench || [];
  const proj =
    Math.round(
      starters.reduce((s, p) => s + (p.livePoints != null ? p.livePoints : p.weeklyProj || 0), 0) * 10
    ) / 10;
  const injured = starters.filter(p => injuryBadge(p.injuryStatus)).slice(0, 3);
  const injuredTotal = starters.filter(p => injuryBadge(p.injuryStatus)).length;

  const tile = (label, value) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center">
      <p className="font-mono text-base font-bold leading-none text-white">{value}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-[0.14em] text-white/70">{label}</p>
    </div>
  );

  return (
    <Link to="/dashboard" className="no-callout block rounded-2xl transition-transform duration-200 active:scale-[0.99]">
      <HudPanel label="My team status" right={`${starters.length} START`} delay={delay} compact>
        <div className="grid grid-cols-2 gap-2">
          {tile("Projected this week", proj)}
          {tile("On the bench", bench.length)}
        </div>

        <div className="mt-2">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/60">Injury watch</p>
          {injuredTotal ? (
            <ul className="mt-1.5 space-y-1">
              {injured.map(p => {
                const badge = injuryBadge(p.injuryStatus);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 py-1.5 text-sm text-white/85"
                  >
                    <span className="min-w-0 truncate font-semibold text-white">{short(p.name)}</span>
                    <span
                      title={badge && badge.title}
                      className="shrink-0 rounded border border-rose-400/60 bg-rose-500/20 px-1 font-mono text-sm font-bold text-rose-300"
                    >
                      {badge && badge.label}
                    </span>
                  </li>
                );
              })}
              {injuredTotal > injured.length && (
                <li className="px-2 text-sm text-white/55">+{injuredTotal - injured.length} more on the injury report</li>
              )}
            </ul>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              All starters healthy.
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm text-white/55">
          <span className="min-w-0">Live scoreboard · swaps · season charts</span>
          <OpenButton>Open my team</OpenButton>
        </div>
      </HudPanel>
    </Link>
  );
}