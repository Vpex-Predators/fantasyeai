import React from "react";
import HudPanel from "@/components/hud/HudPanel";

function Side({ name, before, after, mine, crushed }) {
  const delta = (a, b) => {
    const d = Math.round(((b ?? 0) - (a ?? 0)) * 10) / 10;
    if (!d) return <span className="text-white/40">±0</span>;
    return d > 0 ? <span className="text-emerald-300">+{d}</span> : <span className="text-rose-300">{d}</span>;
  };
  return (
    <div className={`border p-2.5 transition-all duration-500 ${crushed ? "scale-y-75 opacity-40 grayscale" : "scale-100 opacity-100"} ${mine ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-rose-400/30 bg-rose-400/[0.05]"}`}>
      <p className={`truncate text-sm font-bold uppercase tracking-wider ${mine ? "text-emerald-200" : "text-rose-200"}`}>
        {name}
      </p>
      <div className="mt-2 space-y-1 font-mono text-sm text-white/55">
        <p className="flex items-center justify-between gap-1">
          PLAYOFF CHANCE
          <span className="text-white">
            {before.playoffPct ?? "—"}% → <span className="font-bold">{after.playoffPct ?? "—"}%</span>{" "}
            {delta(before.playoffPct, after.playoffPct)}
          </span>
        </p>
        <p className="flex items-center justify-between gap-1">
          TITLE CHANCE
          <span className="text-white">
            {before.titlePct ?? "—"}% → <span className="font-bold">{after.titlePct ?? "—"}%</span>
          </span>
        </p>
        <p className="flex items-center justify-between gap-1">
          PROJECTED WINS
          <span className="text-white">
            {before.avgWins ?? "—"} → <span className="font-bold">{after.avgWins ?? "—"}</span>
          </span>
        </p>
        {mine && (
          <p className="flex items-center justify-between gap-1">
            SEED
            <span className="text-white">
              {before.likelySeed ?? "—"} → <span className="font-bold">#{after.likelySeed ?? "—"}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function TradeOdds({ odds, myName, partnerName, crushedSide }) {
  const { before, after, lineupDelta } = odds;
  return (
    <HudPanel label="Simulated impact" right="1,000 SEASON SIMS">
      <div className="grid grid-cols-2 gap-2">
        <Side name={myName} before={before.mine} after={after.mine} mine crushed={crushedSide === "mine"} />
        <Side name={partnerName} before={before.partner} after={after.partner} crushed={crushedSide === "partner"} />
      </div>
      <p className="mt-2 border-t border-dashed border-white/10 pt-2 font-mono text-sm uppercase tracking-[0.15em] text-white/40">
        This trade changes your lineup by {lineupDelta.mine >= 0 ? "+" : ""}{lineupDelta.mine} pts/wk and theirs by{" "}
        {lineupDelta.partner >= 0 ? "+" : ""}{lineupDelta.partner} pts/wk.
      </p>
    </HudPanel>
  );
}