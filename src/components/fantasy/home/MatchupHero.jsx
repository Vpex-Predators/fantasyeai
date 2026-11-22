import React from "react";
import { Link } from "react-router-dom";
import HudPanel from "@/components/hud/HudPanel";
import OpenButton from "@/components/hud/OpenButton";
import DrawBar from "@/components/hud/DrawBar";

// Command-center hero: this week's score watch with win probability and
// playoff odds. The one card with ambient live motion (pulsing LIVE dot);
// a tap opens the full My Team dashboard.
export default function MatchupHero({ data, delay = 0 }) {
  const { myTeam, opponent, opponentStarters = [], playoffOdds } = data;
  const mine = playoffOdds && playoffOdds.mine;
  const winProb = mine && mine.currentWeekWinProb != null ? mine.currentWeekWinProb : null;
  const isLive = (myTeam.starters || []).some(p => p.livePoints != null);
  const total = players =>
    Math.round((players || []).reduce((s, p) => s + (p.livePoints != null ? p.livePoints : (p.weeklyProj || 0)), 0) * 10) / 10;
  const myScore = total(myTeam.starters);
  const oppScore = total(opponentStarters);
  const wpTone =
    winProb == null ? "text-white/70" : winProb >= 60 ? "text-emerald-300" : winProb <= 40 ? "text-rose-300" : "text-amber-300";

  const liveTag = (
    <span className="flex items-center gap-1.5">
      {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
      {isLive ? "LIVE" : "PROJ"}
    </span>
  );

  const openCue = <OpenButton>Open my team</OpenButton>;

  return (
    <Link to="/dashboard" className="no-callout block rounded-2xl transition-transform duration-200 active:scale-[0.99]">
      <HudPanel label="This week's matchup" right={liveTag} delay={delay} compact>
        {opponent ? (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{myTeam.name}</p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none tabular-nums text-white">{myScore}</p>
                <p className="mt-1 font-mono text-sm uppercase tracking-wider text-white/50">
                  {myTeam.wins}-{myTeam.losses} record
                </p>
              </div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-white/40">vs</p>
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-bold text-white/85">{opponent.name}</p>
                <p className="mt-1 font-mono text-2xl font-bold leading-none tabular-nums text-white/85">{oppScore}</p>
                <p className="mt-1 font-mono text-sm uppercase tracking-wider text-white/50">
                  {opponent.wins}-{opponent.losses} record
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-sm font-bold uppercase tracking-[0.14em] text-white/60">
                <span>Win probability</span>
                <span className={`font-mono text-sm font-bold ${wpTone}`}>{winProb == null ? "—" : `${winProb}%`}</span>
              </div>
              <DrawBar pct={winProb ?? 0} />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm text-white/60">
              <span className="min-w-0 truncate">
                Playoff odds <b className="font-mono text-white">{mine ? `${mine.playoffPct}%` : "—"}</b>
              </span>
              {openCue}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-white">BYE week — no matchup</p>
            <p className="mt-1 text-sm text-white/55">
              Use the week to work the wire and prep your playoff run.
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm text-white/60">
              <span className="min-w-0 truncate">
                {myTeam.wins}-{myTeam.losses} record · playoff odds{" "}
                <b className="font-mono text-white">{mine ? `${mine.playoffPct}%` : "—"}</b>
              </span>
              {openCue}
            </div>
          </>
        )}
      </HudPanel>
    </Link>
  );
}