import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import HudPanel from "@/components/hud/HudPanel";
import OpenButton from "@/components/hud/OpenButton";
import DrawBar from "@/components/hud/DrawBar";
import { buildShortNames, shortName } from "@/lib/playerNames";
import { realPos } from "@/lib/lineupOrder";

const PRIORITY_CHIP = {
  high: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  medium: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  low: "border-white/15 bg-white/5 text-white/60",
};

// Biggest projected bench-over-starter upgrade at the same real position.
function lineupEdge(myTeam) {
  let best = null;
  for (const s of myTeam.starters || []) {
    for (const b of myTeam.bench || []) {
      if (!realPos(s) || realPos(s) !== realPos(b)) continue;
      const margin = (b.weeklyProj || 0) - (s.weeklyProj || 0);
      if (margin > 0 && (!best || margin > best.margin)) best = { starter: s, bench: b, margin };
    }
  }
  return best;
}

// Waiver & lineup preview: the week's saved waiver scan plus the biggest
// projected start/sit edge. One-time draw animations; a tap opens Waivers.
export default function WaiverLineupCard({ data, delay = 0 }) {
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("getWaiverTargets", { force: false });
        if (!cancelled) setScan(res.data);
      } catch (err) {
        if (!cancelled) setScan(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const targets = ((scan && scan.targets) || []).slice(0, 3);
  const edge = lineupEdge(data.myTeam);
  const shortNames = buildShortNames([
    ...targets.map(t => t.name),
    edge ? edge.starter.name : null,
    edge ? edge.bench.name : null
  ]);
  const short = n => shortNames[n] || shortName(n);

  return (
    <Link to="/waivers" className="no-callout block rounded-2xl transition-transform duration-200 active:scale-[0.99]">
      <HudPanel label="Waivers & lineup" right={`WK ${data.league.week}`} delay={delay} compact>
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            Pulling the waiver scan…
          </div>
        ) : targets.length ? (
          <ul className="space-y-1.5">
            {targets.map(t => (
              <li key={t.name} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-bold text-white">
                    {short(t.name)} <span className="font-normal text-white/45">({t.position})</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
                      PRIORITY_CHIP[t.priority] || PRIORITY_CHIP.low
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-white/55">{t.why_brief}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-white/55">
            No waiver scan saved yet — run one on the wire tab.
          </p>
        )}

        <div className="mt-2 border-t border-white/10 pt-2">
          {edge ? (
            <>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                <span>Start/sit edge</span>
                <span className="font-mono text-sm font-bold text-emerald-300">+{edge.margin} pts</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/55">
                {short(edge.bench.name)} projects {edge.bench.weeklyProj} vs {short(edge.starter.name)}'s {edge.starter.weeklyProj} at{" "}
                {edge.bench.realPosition}.
              </p>
              <div className="mt-1">
                <DrawBar pct={(edge.margin / Math.max(edge.bench.weeklyProj, 1)) * 100} />
              </div>
            </>
          ) : (
            <p className="text-[10px] text-white/55">
              No projected bench upgrade — lineup looks set.
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <OpenButton>Open waiver wire</OpenButton>
        </div>
      </HudPanel>
    </Link>
  );
}