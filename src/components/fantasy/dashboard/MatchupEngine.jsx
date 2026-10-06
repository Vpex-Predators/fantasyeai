import { Loader2, Sparkles } from "lucide-react";
import { sortStarters } from "@/lib/lineupOrder";
import InjuryBadge from "./InjuryBadge";
import BenchDepth from "./BenchDepth";
import StartSitAdvisor from "./StartSitAdvisor";
import HudPanel from "@/components/hud/HudPanel";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const ROW_ORDER = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLX1", "FLX2", "OP1", "D/ST", "K"];

function matchupRows(mine, theirs) {
  const mineBy = Object.fromEntries(sortStarters(mine).map(p => [p.lineupLabel, p]));
  const theirsBy = Object.fromEntries(sortStarters(theirs).map(p => [p.lineupLabel, p]));
  const labels = [];
  for (const l of [...ROW_ORDER, ...Object.keys(mineBy), ...Object.keys(theirsBy)]) {
    if (!labels.includes(l)) labels.push(l);
  }
  return labels
    .filter(l => mineBy[l] || theirsBy[l])
    .map(l => ({ label: l, mine: mineBy[l], theirs: theirsBy[l] }));
}

// Points that count: actuals once the player's game is live or over, projection before kickoff.
const effectivePoints = p => (p && p.livePoints != null ? p.livePoints : (p && p.weeklyProj) || 0);

function PointsCell({ p, className }) {
  if (!p) return <span className={className}>—</span>;
  const live = p.livePoints != null;
  return (
    <span className={className}>
      {effectivePoints(p).toFixed(1)}
      {live && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 align-middle" />}
    </span>
  );
}

// One grid row: my player | position | opponent player, with points on the edges.
function PlayerRow({ mine, theirs, label }) {
  const short = usePlayerNames();
  const both = mine && theirs;
  const minePts = effectivePoints(mine);
  const theirsPts = effectivePoints(theirs);
  const mineWins = both && minePts > theirsPts;
  const theirsWins = both && theirsPts > minePts;
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <PointsCell p={mine} className={`w-8 shrink-0 font-mono text-left ${mineWins ? "font-semibold text-emerald-300" : "text-white/60"}`} />
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate text-white/75">{mine ? short(mine.name) : "—"}</span>
        {mine && <InjuryBadge status={mine.injuryStatus} />}
      </span>
      <span className="w-10 shrink-0 text-center font-semibold text-white/45">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {theirs && <InjuryBadge status={theirs.injuryStatus} />}
        <span className="truncate text-white/45">{theirs ? short(theirs.name) : "—"}</span>
      </span>
      <PointsCell p={theirs} className={`w-8 shrink-0 font-mono text-right ${theirsWins ? "font-semibold text-rose-300" : "text-white/60"}`} />
    </div>
  );
}

export default function MatchupEngine({ myTeam, opponent, opponentStarters, opponentBench, matchup, week, analyzing, onAnalyze, pending, onSeen }) {
  const rows = matchupRows(myTeam.starters || [], opponentStarters || []);
  const myBench = myTeam.bench || [];
  const oppBench = opponentBench || [];
  const myTotal = parseFloat((myTeam.starters || []).reduce((s, p) => s + effectivePoints(p), 0).toFixed(1));
  const oppTotal = parseFloat((opponentStarters || []).reduce((s, p) => s + effectivePoints(p), 0).toFixed(1));
  const myPct = Math.round((myTotal / Math.max(myTotal + oppTotal, 1)) * 100);
  const ai = matchup?.matchup;
  const oppPending = opponent && (pending || []).includes("opp:" + opponent.id);

  return (
    <div onClick={() => { if (oppPending) onSeen(["opp:" + opponent.id]); }}>
    <HudPanel
      label={`Week ${week} matchup`}
      right={oppPending ? <span className="animate-pulse rounded-full bg-emerald-400 px-1.5 py-0.5 font-bold text-slate-950">NEW</span> : "HEAD TO HEAD"}
      className={oppPending ? "border-emerald-400/60 shadow-[0_0_22px_rgba(52,211,153,0.22)]" : ""}
    >
      {!opponent ? (
        <p className="text-xs text-white/50">No matchup this week (bye).</p>
      ) : (
        <>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="bg-emerald-400" style={{ width: myPct + "%" }} />
            <div className="flex-1 bg-rose-400/70" />
          </div>

          <div className="mt-3 space-y-1.5">
            {rows.map(r => (
              <PlayerRow key={r.label} mine={r.mine} theirs={r.theirs} label={r.label} />
            ))}
          </div>

          <BenchDepth myBench={myBench} oppBench={oppBench} myName={myTeam.name} oppName={opponent.name} />
          <StartSitAdvisor starters={myTeam.starters || []} bench={myBench} />

          <div className="mt-3 border-t border-white/10 pt-3">
            {ai ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-white/80">
                  Upper hand: <span className="text-emerald-300">{ai.upper_hand}</span>
                  {ai.win_probability != null && (
                    <span className="ml-2 font-normal text-white/50">· your win prob {Math.round(ai.win_probability)}%</span>
                  )}
                </p>
                <ul className="space-y-1">
                  {(ai.reasons || []).map((r, i) => (
                    <li key={i} className="text-[11px] text-white/60">• {r}</li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-emerald-400/80">Your levers</p>
                    {(ai.user_levers || []).map((l, i) => (
                      <p key={i} className="text-[10px] text-white/55">{l}</p>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-rose-400/80">Their levers</p>
                    {(ai.opponent_levers || []).map((l, i) => (
                      <p key={i} className="text-[10px] text-white/55">{l}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onAnalyze(); }}
                disabled={analyzing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {analyzing ? "Comparing lineups…" : "Who has the upper hand? Run the comparison"}
              </button>
            )}
          </div>
        </>
      )}
    </HudPanel>
    </div>
  );
}