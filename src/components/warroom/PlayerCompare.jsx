import React, { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ComparePicker from "./ComparePicker";
import DrawBar from "@/components/hud/DrawBar";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const positionLabel = pos => (pos === "DST" ? "D/ST" : pos || "—");
const INJURY_LABELS = { QUESTIONABLE: "Questionable", DOUBTFUL: "Doubtful", OUT: "Out", INJURY_RESERVE: "On IR", SUSPENSION: "Suspended" };

const fmt = v => (typeof v === "number" ? v.toFixed(1) : v != null && v !== "" ? String(v) : "—");
const trendText = t => (Array.isArray(t) && t.length ? t.map(w => w.points).join(" · ") : "—");
const injuryText = s => INJURY_LABELS[s] || "Healthy";
// Which side leads a numeric row — null when missing or even.
const leaderOf = (a, b) => {
  if (typeof a !== "number" || typeof b !== "number") return null;
  if (Math.abs(a - b) < 0.05) return null;
  return a > b ? "a" : "b";
};

// Side-by-side comparison of any two league players or free agents.
export default function PlayerCompare({ data, initialIds }) {
  const short = usePlayerNames();
  const pool = useMemo(() => {
    const byId = new Map();
    const teamName = {};
    (data.teams || []).forEach(t => { teamName[t.id] = t.name; });
    Object.entries(data.rosters || {}).forEach(([teamId, players]) => {
      (players || []).forEach(p => {
        if (p && p.id && !byId.has(p.id)) byId.set(p.id, { ...p, teamLabel: teamName[teamId] || "Roster" });
      });
    });
    (data.freeAgents || []).forEach(p => {
      if (p && p.id && !byId.has(p.id)) byId.set(p.id, { ...p, teamLabel: "Free agent" });
    });
    return [...byId.values()];
  }, [data]);

  const [pickA, setPickA] = useState(null);
  const [pickB, setPickB] = useState(null);

  // Preset pair (tapped from the My Team swap view) fills both pickers once the pool loads.
  useEffect(() => {
    if (!initialIds || !pool.length) return;
    const a = pool.find(p => p.id === String(initialIds[0]));
    const b = pool.find(p => p.id === String(initialIds[1]));
    if (a) setPickA(a);
    if (b) setPickB(b);
  }, [initialIds, pool]);

  const rows = useMemo(() => {
    if (!pickA || !pickB) return null;
    return [
      { key: "wk", label: "Week proj", a: fmt(pickA.weeklyProj), b: fmt(pickB.weeklyProj), leader: leaderOf(pickA.weeklyProj, pickB.weeklyProj) },
      { key: "ros", label: "Season proj", a: fmt(pickA.seasonProj), b: fmt(pickB.seasonProj), leader: leaderOf(pickA.seasonProj, pickB.seasonProj) },
      { key: "avg", label: "Season avg", a: fmt(pickA.seasonAvg), b: fmt(pickB.seasonAvg), leader: leaderOf(pickA.seasonAvg, pickB.seasonAvg) },
      { key: "live", label: "Live pts", a: fmt(pickA.livePoints), b: fmt(pickB.livePoints), leader: leaderOf(pickA.livePoints, pickB.livePoints) },
      { key: "l3", label: "Last 3 wks", a: trendText(pickA.trend), b: trendText(pickB.trend) },
      { key: "inj", label: "Injury", a: injuryText(pickA.injuryStatus), b: injuryText(pickB.injuryStatus) },
      { key: "own", label: "Owned", a: pickA.percentOwned != null ? `${pickA.percentOwned}%` : "—", b: pickB.percentOwned != null ? `${pickB.percentOwned}%` : "—" }
    ];
  }, [pickA, pickB]);

  const edge = useMemo(() => {
    if (!pickA || !pickB) return null;
    const d = (pickA.weeklyProj || 0) - (pickB.weeklyProj || 0);
    if (Math.abs(d) < 0.05) return `Dead even — both project ${(pickA.weeklyProj || 0).toFixed(1)} pts this week.`;
    const [lead, trail] = d > 0 ? [pickA, pickB] : [pickB, pickA];
    return `${short(lead.name)} projects ${Math.abs(d).toFixed(1)} pts higher than ${short(trail.name)} this week.`;
  }, [pickA, pickB]);

  // Each player's share of the two week projections combined.
  const weekSplit = useMemo(() => {
    if (!pickA || !pickB) return 50;
    const total = (pickA.weeklyProj || 0) + (pickB.weeklyProj || 0);
    return total > 0 ? ((pickA.weeklyProj || 0) / total) * 100 : 50;
  }, [pickA, pickB]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white/80">Compare players</h2>
        {pickA && (
          <button
            onClick={() => { setPickA(null); setPickB(null); }}
            className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-white/70 transition-colors hover:text-emerald-300"
          >
            <RotateCcw className="h-3 w-3" /> New
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ComparePicker player={pickA} placeholder="Player 1" pool={pool} onPick={setPickA} />
        <ComparePicker player={pickB} placeholder="Player 2" pool={pool} onPick={setPickB} />
      </div>

      {rows ? (
        <>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <div className="min-w-0 text-right">
              <p className="truncate text-xs font-semibold text-white">{short(pickA.name)}</p>
              <p className="truncate text-sm uppercase tracking-wider text-white/60">
                {positionLabel(pickA.position)} · {pickA.teamLabel}
              </p>
            </div>
            <span className="px-1 font-heading text-sm font-bold italic tracking-widest text-white/70">VS</span>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-white">{short(pickB.name)}</p>
              <p className="truncate text-sm uppercase tracking-wider text-white/60">
                {positionLabel(pickB.position)} · {pickB.teamLabel}
              </p>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            {rows.map(r => (
              <div key={r.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                <span className={cn("truncate text-right font-mono text-xs", r.leader === "a" ? "font-bold text-emerald-300" : "text-white/80")}>{r.a}</span>
                <span className="whitespace-nowrap px-1 text-sm font-semibold uppercase tracking-wider text-white/60">{r.label}</span>
                <span className={cn("truncate text-left font-mono text-xs", r.leader === "b" ? "font-bold text-emerald-300" : "text-white/80")}>{r.b}</span>
              </div>
            ))}
          </div>

          {edge && (
            <div className="mt-2.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
              <p className="text-sm font-semibold text-emerald-300">{edge}</p>
              {/* Week-projection split drawn as two growing bars */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <DrawBar
                  pct={weekSplit}
                  className="bg-emerald-400"
                />
                <DrawBar pct={100 - weekSplit} className="bg-cyan-400" />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Pick any two players — every roster in the league plus free agents — and see week projections, season outlook, live points and injuries side by side.
        </p>
      )}
    </section>
  );
}