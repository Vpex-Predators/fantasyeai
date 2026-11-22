import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  good: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
  plain: "text-white",
};

// Single HUD data tile — micro-label, big monospace figure, context sub-line.
export default function HudStat({ label, value, sub, tone = "plain" }) {
  return (
    <div className="no-callout relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-3 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/30">
      <span aria-hidden="true" className="pointer-events-none absolute -left-px -top-px h-2 w-2 border-l border-t border-emerald-400/60" />
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-bold leading-none tabular-nums", TONES[tone])}>{value}</p>
      {sub && <p className="mt-1 truncate text-sm text-white/45">{sub}</p>}
    </div>
  );
}