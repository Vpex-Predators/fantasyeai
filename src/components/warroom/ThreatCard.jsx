import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ThreatCard({ threat, rank }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative border border-white/10 border-l-2 border-l-rose-400/70 bg-white/[0.04]">
      <button onClick={() => setOpen(!open)} className="w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-rose-300/80">
              Threat {String(rank).padStart(2, "0")}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-white">{threat.name}</p>
            <p className="font-mono text-sm text-white/50">
              {threat.wins}-{threat.losses} · {threat.pointsFor} PF · proj {threat.avgWins} W
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xl font-bold leading-none text-rose-300">{threat.threatScore}</p>
            <p className="text-sm uppercase tracking-[0.15em] text-white/40">Threat</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 font-mono text-sm text-white/55">
          <span>HEAD-TO-HEAD <span className="font-bold text-white">{threat.h2hPct}%</span></span>
          <span>PLAYOFF CHANCE <span className="font-bold text-white">{threat.playoffPct}%</span></span>
          <span>TITLE CHANCE <span className="font-bold text-white">{threat.titlePct}%</span></span>
          <span>MATCHUPS LEFT <span className="font-bold text-white">×{threat.meetingsLeft}</span></span>
          <ChevronDown className={`ml-auto h-3.5 w-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 bg-slate-950/60 p-3 font-mono text-sm text-white/60">
          <p className="uppercase tracking-[0.18em] text-white/40">Simulated profile</p>
          <p className="mt-1.5">SCORING <span className="font-bold text-white">{threat.avgPoints} ppg</span></p>
          <p>PROJ FINISH <span className="font-bold text-white">{threat.avgWins} wins</span></p>
          <p>PLAYOFF CHANCE <span className="font-bold text-white">{threat.playoffPct}%</span> · TITLE CHANCE <span className="font-bold text-white">{threat.titlePct}%</span></p>
          <p className="mt-2 text-white/35">
            Threat score = 45% head-to-head edge + 35% their playoff odds + 20% their title odds.
          </p>
        </div>
      )}
    </div>
  );
}