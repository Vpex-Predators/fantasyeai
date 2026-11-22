import React from "react";
import HudPanel from "@/components/hud/HudPanel";

export default function LeaguePulse({ data }) {
  const { myTeam, playoffOdds } = data;
  const race = (playoffOdds && playoffOdds.race) || [];
  if (!race.length) return null;
  const cutoff = (playoffOdds && playoffOdds.playoffTeamCount) || 6;

  return (
    <HudPanel label="League pulse — playoff race" right={`TOP ${cutoff}`}>
      <div>
        {race.map((t, i) => {
          const mine = t.id === myTeam.id;
          const inField = i < cutoff;
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 border-b border-white/5 px-1 py-1.5 last:border-0 ${
                mine ? "bg-emerald-400/[0.08]" : ""
              }`}
            >
              <span className={`w-5 shrink-0 text-center font-mono text-sm ${inField ? "text-emerald-300" : "text-white/35"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${mine ? "text-emerald-200" : "text-white/85"}`}>
                {t.name}
              </span>
              <span className="shrink-0 font-mono text-sm text-white/45">
                {t.wins}-{t.losses}
              </span>
              <div className="h-1 w-12 shrink-0 bg-white/10">
                <div
                  className={`h-full ${
                    t.playoffPct >= 60 ? "bg-emerald-400" : t.playoffPct >= 35 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${t.playoffPct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-sm font-bold text-white/70">
                {t.playoffPct}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 border-t border-dashed border-white/10 pt-2 font-mono text-sm uppercase tracking-[0.15em] text-white/35">
        Top {cutoff} make the playoffs · % = simulated playoff odds
      </p>
    </HudPanel>
  );
}