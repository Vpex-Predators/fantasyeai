import React from "react";
import { Link } from "react-router-dom";
import HudPanel from "@/components/hud/HudPanel";
import OpenButton from "@/components/hud/OpenButton";
import DrawBar from "@/components/hud/DrawBar";

// League & rivals preview: where you sit, who you're chasing, and the leader —
// the same standings the My Team League tab shows in full. Bars draw on mount.
export default function LeagueRivalsCard({ data, delay = 0 }) {
  const { teams, myTeam, league } = data;
  const sorted = [...teams].sort(
    (a, b) => ((b.wins + (b.ties || 0) * 0.5) - (a.wins + (a.ties || 0) * 0.5)) || (b.pointsFor - a.pointsFor)
  );
  if (!sorted.length) return null;
  const myIdx = Math.max(0, sorted.findIndex(t => t.id === myTeam.id));
  const leader = sorted[0];
  const chasing = myIdx > 0;
  const rival = chasing ? sorted[myIdx - 1] : sorted[1] || null;
  const leaderPts = Math.max(...sorted.map(t => t.pointsFor || 0), 1);

  const rows = [];
  if (leader.id !== myTeam.id && (!rival || rival.id !== leader.id)) {
    rows.push({ t: leader, rank: 1, note: "leader", mine: false });
  }
  if (rival) {
    rows.push({ t: rival, rank: chasing ? myIdx : myIdx + 2, note: chasing ? "you chase" : "chaser", mine: false });
  }
  rows.push({ t: sorted[myIdx], rank: myIdx + 1, note: "you", mine: true });
  rows.sort((a, b) => a.rank - b.rank);

  return (
    <Link to="/dashboard?tab=league" className="no-callout block rounded-2xl transition-transform duration-200 active:scale-[0.99]">
      <HudPanel label="League & rivals" right={`${teams.length} TEAMS`} delay={delay} compact>
        <div className="space-y-1.5">
          {rows.map(({ t, rank, note, mine }) => (
            <div
              key={t.id}
              className={`rounded-lg border px-2 py-1.5 ${
                mine ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={`truncate font-bold ${mine ? "text-emerald-300" : "text-white"}`}>
                  {rank}. {t.name}
                </span>
                <span className="shrink-0 font-mono text-sm text-white/70">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""} · {t.pointsFor} pts
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="w-16 shrink-0 font-mono text-sm uppercase tracking-wider text-white/45">{note}</span>
                <DrawBar
                  pct={((t.pointsFor || 0) / leaderPts) * 100}
                  className={mine ? "bg-emerald-400" : "bg-white/40"}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm text-white/55">
          <span className="min-w-0">Week {league.week} standings · full race</span>
          <OpenButton>Open standings</OpenButton>
        </div>
      </HudPanel>
    </Link>
  );
}