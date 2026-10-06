import PlayerCard from "./PlayerCard";
import { sortStarters } from "@/lib/lineupOrder";
import HudPanel from "@/components/hud/HudPanel";

export default function RosterCompare({ starters, bench, pending, onSeen, onAnalyze, analyzingPlayerId }) {
  const pendingSet = new Set(pending || []);
  const orderedStarters = sortStarters(starters);
  const starterProj = starters.reduce((s, p) => s + (p.weeklyProj || 0), 0).toFixed(1);
  const benchProj = bench.reduce((s, p) => s + (p.weeklyProj || 0), 0).toFixed(1);

  const renderCard = p => (
    <PlayerCard
      key={p.id + "-" + p.slot}
      player={p}
      pending={pendingSet.has("p:" + p.id)}
      analyzing={analyzingPlayerId === p.id}
      onOpen={onSeen}
      onAnalyze={onAnalyze}
    />
  );

  return (
    <HudPanel label="My lineup" right={`${starterProj} START · ${benchProj} BENCH`}>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">Starters</p>
        {orderedStarters.map(renderCard)}
      </div>

      <div className="my-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Bench</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      <div className="space-y-2">
        {bench.map(renderCard)}
        {bench.length === 0 && <p className="text-[11px] text-white/40">No bench players.</p>}
      </div>
    </HudPanel>
  );
}