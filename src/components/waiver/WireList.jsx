import React from "react";
import GlossaryChip from "@/components/hud/GlossaryChip";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const label = (position) => (position === "DST" ? "D/ST" : position);

// Full free-agent list, expanded inline under the radar's AI picks.
// Shares the radar's visual language so the page reads as one tool.
export default function WireList({ players = [] }) {
  const short = usePlayerNames();
  const sorted = [...players].sort((a, b) => (b.weeklyProj || 0) - (a.weeklyProj || 0));

  return (
    <div className="mt-2 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((player, index) => (
        <div key={player.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-sm text-white/25">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/85">{short(player.name)}</p>
              <p className="font-mono text-sm uppercase text-white/35">
                {label(player.position) === "D/ST" ? <GlossaryChip term="dst" bare>D/ST</GlossaryChip> : label(player.position)} · {player.percentOwned || 0}% owned
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-sm uppercase text-white/45">
            <p><span className="text-emerald-300">{player.weeklyProj || 0}</span> wk</p>
            <p><span className="text-white/75">{player.seasonProj || 0}</span> <GlossaryChip term="ros" bare>ROS</GlossaryChip></p>
          </div>
        </div>
      ))}
      {!sorted.length && <p className="py-6 text-center text-xs text-white/45">No available players at this position.</p>}
    </div>
  );
}