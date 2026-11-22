import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import GlossaryChip from "@/components/hud/GlossaryChip";

// Pattern detectors over real ESPN numbers — suspicions, never accusations.
export default function CollusionRadar({ flags, available = true }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <h3 className="flex items-center gap-1.5 font-heading text-sm font-bold uppercase tracking-[0.2em] text-white/70">
        <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />
        Collusion radar
      </h3>
      {!available ? (
        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-white/60">
          The transaction scan is still syncing from ESPN — no patterns to check yet.
        </p>
      ) : !flags.length ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-white/80">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>
            All clear — no <GlossaryChip term="tanking">tanking</GlossaryChip>, lopsided trade loops, or
            wire games in the numbers. For now.
          </span>
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {flags.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 py-1.5 text-sm leading-snug text-white/85">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
              <span>{f.quip}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 border-t border-white/10 pt-1.5 text-sm leading-snug text-white/50">
        Pattern detectors, not accusations — the numbers flag odd shapes; you bring the judgment (and the
        group chat receipts).
      </p>
    </div>
  );
}