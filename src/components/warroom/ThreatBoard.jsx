import React from "react";
import HudPanel from "@/components/hud/HudPanel";
import HudStat from "@/components/hud/HudStat";
import ThreatCard from "@/components/warroom/ThreatCard";

export default function ThreatBoard({ board }) {
  if (!board || !board.threats || !board.threats.length) {
    return (
      <HudPanel label="Threat board">
        <p className="text-xs text-white/50">Threat simulation unavailable right now.</p>
      </HudPanel>
    );
  }

  const { threats, keepAhead } = board;
  const top = keepAhead && keepAhead.topThreat;

  return (
    <div className="space-y-3">
      {top && (
        <HudPanel label="Catching the leader" right={`${board.sims} SIMS`}>
          <div className="grid grid-cols-2 gap-2">
            <HudStat
              label="Wins to clear top threat"
              value={keepAhead.winsNeeded}
              sub={`vs ${top.name} · proj ${top.avgWins} W`}
              tone="warn"
            />
            <HudStat
              label="My odds at that pace"
              value={keepAhead.oddsAtTarget == null ? "—" : `${keepAhead.oddsAtTarget}%`}
              sub={`top threat: ${top.playoffPct}%`}
              tone="good"
            />
          </div>
          <div className="mt-3 space-y-1.5">
            {(keepAhead.progression || []).map((p) => (
              <div key={p.wins} className="flex items-center gap-2">
                <span className="w-9 shrink-0 font-mono text-[10px] text-white/50">+{p.wins}W</span>
                <div className="h-1.5 flex-1 bg-white/10">
                  <div
                    className={`h-full ${
                      p.playoffPct >= 60 ? "bg-emerald-400" : p.playoffPct >= 35 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${p.playoffPct ?? 0}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[10px] font-bold text-white/70">
                  {p.playoffPct == null ? "—" : `${p.playoffPct}%`}
                </span>
              </div>
            ))}
            <p className="border-t border-dashed border-white/10 pt-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
              My playoff odds as extra wins stack · {keepAhead.gamesLeft} games left
            </p>
          </div>
        </HudPanel>
      )}

      <div className="space-y-2">
        {threats.map((t, i) => (
          <ThreatCard key={t.id} threat={t} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}