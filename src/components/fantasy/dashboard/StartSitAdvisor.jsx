import React from "react";
import { Zap } from "lucide-react";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const INJURED = new Set(["Q", "QUESTIONABLE", "D", "DOUBTFUL", "O", "OUT", "IR", "INJURY_RESERVE", "PUP", "SSD"]);
const FLEX_SLOTS = [23, 7];
const SKILLS = ["QB", "RB", "WR", "TE"];

const posOf = p => p.realPosition || p.position;

// Rule-based lineup calls: flag a bench player when he projects clearly ahead of
// the weakest starter he could replace (or that starter is hurt). Instant, free,
// and only speaks up when there's a real decision — after kickoff it stays quiet.
export function benchRecommendations(starters, bench) {
  const recs = [];
  for (const b of bench || []) {
    const bp = posOf(b);
    if (!SKILLS.includes(bp) || b.livePoints != null) continue;
    const candidates = (starters || []).filter(
      s => s.livePoints == null && (posOf(s) === bp || (["RB", "WR", "TE"].includes(bp) && FLEX_SLOTS.includes(s.slot)))
    );
    if (!candidates.length) continue;
    const weakest = candidates.reduce((m, s) => ((s.weeklyProj || 0) < (m.weeklyProj || 0) ? s : m));
    const gap = (b.weeklyProj || 0) - (weakest.weeklyProj || 0);
    const starterHurt = INJURED.has(String(weakest.injuryStatus || "").toUpperCase());
    if (gap >= 3 || (starterHurt && gap > 0)) {
      recs.push({ bench: b, over: weakest, gap, starterHurt });
    }
  }
  return recs.sort((a, b) => b.gap - a.gap).slice(0, 3);
}

export default function StartSitAdvisor({ starters, bench }) {
  const short = usePlayerNames();
  const recs = benchRecommendations(starters, bench);

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-amber-300/90">
        <Zap className="h-3 w-3" /> Lineup calls
      </p>
      {recs.length === 0 ? (
        <p className="text-sm text-white/45">Keep your bench where it is — no one projects ahead of your starters.</p>
      ) : (
        recs.map(r => (
          <p key={r.bench.id} className="text-sm leading-relaxed text-white/70">
            Start <span className="font-semibold text-white">{short(r.bench.name)}</span> over {short(r.over.name)} — projects{" "}
            {r.gap.toFixed(1)} more points{r.starterHurt ? ` and ${short(r.over.name)} is hurt` : ""}.
          </p>
        ))
      )}
    </div>
  );
}