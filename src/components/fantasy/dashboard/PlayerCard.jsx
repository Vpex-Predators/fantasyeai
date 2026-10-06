import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import InjuryBadge from "./InjuryBadge";
import GlossaryChip from "@/components/hud/GlossaryChip";
import DrawSparkline from "@/components/hud/DrawSparkline";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const VERDICT_STYLES = {
  Start: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  Sit: "bg-rose-400/15 text-rose-300 border-rose-400/40",
  Trade: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  Hold: "bg-slate-400/15 text-slate-300 border-slate-400/40",
};

export default function PlayerCard({ player, pending, analyzing, onOpen, onAnalyze }) {
  const [open, setOpen] = useState(false);
  const short = usePlayerNames();
  const a = player.analysis;

  const toggle = () => {
    if (!open && pending) onOpen(["p:" + player.id]);
    setOpen(!open);
  };

  return (
    <div
      className={`relative rounded-xl border p-3 transition-all ${
        pending
          ? "border-emerald-400/60 bg-emerald-400/5 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      {pending && (
        <span className="absolute -right-1.5 -top-1.5 z-10 animate-pulse rounded-full bg-emerald-400 px-1.5 py-0.5 text-sm font-bold text-slate-950">
          NEW
        </span>
      )}

      {/* The whole card is one large tap target — a real <button> announced
          as expandable. The ✨ analyze control sits outside it (no nested
          buttons) and floats into the space the verdict badge occupies. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="no-callout block w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold leading-tight text-white">{short(player.name)}</span>
              <InjuryBadge status={player.injuryStatus} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
              <span className="rounded bg-white/10 px-1 py-0.5 font-medium text-white/60">{player.lineupLabel || player.position}</span>
              <span>{player.weeklyProj > 0 ? `${player.weeklyProj} proj` : `${player.seasonAvg} avg`}</span>
              <DrawSparkline points={player.trend} />
            </div>
          </div>
          {a ? (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${VERDICT_STYLES[a.verdict] || VERDICT_STYLES.Hold}`}>
              {a.verdict}
            </span>
          ) : (
            <span aria-hidden="true" className="w-11 shrink-0" />
          )}
        </div>

        {a && !open && (
          <p className="mt-1.5 truncate text-[11px] text-white/50">{a.analysis}</p>
        )}
      </button>

      {!a && (
        <button
          type="button"
          onClick={() => onAnalyze(player)}
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:text-emerald-300"
          title="Analyze this player"
          aria-label={`Analyze ${player.name}`}
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
      )}

      {open && (
        <div className="mt-2.5 space-y-2 border-t border-white/10 pt-2.5">
          {a ? (
            <>
              <p className="text-[11px] font-medium text-emerald-300">{a.news_headline}</p>
              <p className="text-[11px] leading-relaxed text-white/70">{a.analysis}</p>
              {a.factors?.length > 0 && (
                <ul className="space-y-0.5">
                  {a.factors.map((f, i) => (
                    <li key={i} className="text-[11px] text-white/50">• {f}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-white/40">
                  <GlossaryChip term="weighted_edge" bare>Edge</GlossaryChip>{" "}
                  {typeof a.weighted_edge === "number" ? a.weighted_edge.toFixed(1) : "—"} pts
                </span>
                <span
                  className={`font-semibold uppercase ${
                    a.confidence === "high" ? "text-emerald-300" : a.confidence === "medium" ? "text-amber-300" : "text-white/40"
                  }`}
                >
                  {a.confidence} confidence
                </span>
              </div>
              <p className="text-[11px] text-white/30">Updated {new Date(a.analyzed_at).toLocaleString()}</p>
            </>
          ) : (
            <p className="text-[11px] text-white/50">
              Tap the ✨ for the latest news and a start / sit / trade verdict with a confidence rating.
            </p>
          )}
        </div>
      )}
    </div>
  );
}