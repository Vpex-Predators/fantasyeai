import React from "react";
import { Plus, Minus, ArrowLeftRight, ListChecks } from "lucide-react";
import GlossaryChip from "@/components/hud/GlossaryChip";

const KIND_META = {
  trade: { icon: ArrowLeftRight, cls: "text-cyan-300 bg-cyan-400/10 border-cyan-400/30" },
  trade_pending: { icon: ArrowLeftRight, cls: "text-cyan-300/80 bg-cyan-400/5 border-cyan-400/20" },
  add: { icon: Plus, cls: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30" },
  drop: { icon: Minus, cls: "text-rose-300 bg-rose-400/10 border-rose-400/30" },
  lineup: { icon: ListChecks, cls: "text-amber-300 bg-amber-400/10 border-amber-400/30" }
};

// Recent moves by other managers — adds, drops, trades, lineup shuffles.
export default function PulseMoveFeed({ moves, available }) {
  return (
    <div>
      <h3 className="mb-1.5 font-heading text-sm font-bold uppercase tracking-[0.2em] text-white/70">
        Move log
      </h3>
      {!available ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-white/60">
          Move log unavailable right now — the standings and totals above are still live.
        </p>
      ) : !moves.length ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-white/60">
          No roster moves logged yet — a suspiciously quiet league.
        </p>
      ) : (
        <ul className="space-y-1">
          {moves.map((m, i) => {
            const meta = KIND_META[m.kind] || KIND_META.lineup;
            const Icon = meta.icon;
            return (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${meta.cls}`}>
                  <Icon className="h-3 w-3" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-white/80">
                  <span className="font-semibold text-white">{m.team}</span> {m.text}
                </p>
                {m.week != null && (
                  <span className="shrink-0 font-mono text-sm uppercase tracking-wider text-white/60">WK {m.week}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1.5 text-sm text-white/50">
        Adds and claims come off the{" "}
        <GlossaryChip term="waiver wire">wire</GlossaryChip> — drops free the player for everyone else.
      </p>
    </div>
  );
}