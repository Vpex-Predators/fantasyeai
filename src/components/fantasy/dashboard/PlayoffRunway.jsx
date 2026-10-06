import React, { useState } from "react";
import HudPanel from "@/components/hud/HudPanel";

const GRADE_STYLES = {
  Tough: "bg-rose-400/15 text-rose-300 border-rose-400/40",
  Even: "bg-slate-400/15 text-slate-300 border-slate-400/40",
  Favorable: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
};
const GRADE_BAR = { Tough: "bg-rose-400", Even: "bg-slate-400", Favorable: "bg-emerald-400" };

export default function PlayoffRunway({ playoffOdds }) {
  const [view, setView] = useState("sim");
  const odds = playoffOdds && playoffOdds.mine ? playoffOdds : null;

  if (!odds) {
    return (
      <HudPanel label="Playoff runway">
        <p className="text-xs text-white/50">Playoff odds aren't available for this week yet.</p>
      </HudPanel>
    );
  }

  const { mine, race, playoffTeamCount } = odds;
  const remaining = mine.remaining || [];

  return (
    <HudPanel label="Playoff runway" right="1,000 SIMS">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/40">Simulated finishes + per-week win model</p>
        <div className="flex shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
          {["sim", "model"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`no-callout min-h-[44px] rounded-full px-3.5 py-1.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                view === v ? "bg-emerald-400 text-slate-950" : "text-white/55 hover:text-white"
              }`}
            >
              {v === "sim" ? "Sim" : "Win model"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
        <div>
          <p className="font-heading text-4xl font-bold leading-none text-emerald-300">{mine.playoffPct}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/50">playoff odds</p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-heading text-lg font-bold leading-tight text-white">#{mine.likelySeed}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/50">
            likely seed · {mine.titlePct}% title
          </p>
        </div>
      </div>

      {view === "sim" ? (
        <div className="mt-3 space-y-1.5">
          {(race || []).map((t, i) => (
            <React.Fragment key={t.id}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                  t.id === mine.id ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/5 bg-white/[0.03]"
                }`}
              >
                <span className={`w-4 text-center text-[10px] font-bold ${i < playoffTeamCount ? "text-emerald-300" : "text-white/35"}`}>
                  {i + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${t.id === mine.id ? "text-emerald-200" : "text-white/85"}`}>
                  {t.name}
                </span>
                <span className="text-[10px] tabular-nums text-white/45">
                  {t.wins}-{t.losses} · {t.pointsFor} PF
                </span>
                <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${
                      t.playoffPct >= 60 ? "bg-emerald-400" : t.playoffPct >= 35 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${t.playoffPct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-white/70">
                  {t.playoffPct}%
                </span>
              </div>
              {i === playoffTeamCount - 1 && i < race.length - 1 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 border-t border-dashed border-white/20" />
                  <span className="text-[9px] uppercase tracking-widest text-white/40">playoff line</span>
                  <div className="h-px flex-1 border-t border-dashed border-white/20" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {remaining.length === 0 ? (
            <p className="text-xs text-white/50">Regular season complete — playoff bracket set.</p>
          ) : (
            remaining.map((r) => (
              <div key={r.week} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-[11px] font-semibold text-white/55">Wk {r.week}</span>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-xs font-semibold text-white">{r.opponent.name}</p>
                    <p className="text-[10px] text-white/40">
                      {r.opponent.wins}-{r.opponent.losses} · {r.opponent.avgPoints} pts/gm
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${GRADE_STYLES[r.grade]}`}>
                    {r.grade}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${GRADE_BAR[r.grade]}`} style={{ width: `${r.winProb}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/80">
                    {r.winProb}%
                  </span>
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-white/40">
            Win probability from each team's season scoring distribution vs this week's opponent.
          </p>
        </div>
      )}
    </HudPanel>
  );
}