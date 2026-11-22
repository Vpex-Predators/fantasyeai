import React from "react";
import { LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import HudPanel from "@/components/hud/HudPanel";
import RefreshBar from "./RefreshBar";
import DrawBar from "@/components/hud/DrawBar";

// Frosted VS scoreboard for My Team — same content as before, HUD skin,
// with each side's share of the combined total drawn as a bar.
export default function TeamScoreboard({ data, myScore, oppScore, anyLive, refreshing, analyzing, onRefresh }) {
  const total = myScore + oppScore;
  const myPct = total > 0 ? (myScore / total) * 100 : 50;

  return (
    <HudPanel label="This week's score" right={anyLive ? "LIVE PTS" : "PROJECTED"}>
      <div className="flex items-start justify-end gap-2">
        <RefreshBar
          lastRefresh={data.lastRefresh}
          refreshing={refreshing}
          analyzing={analyzing}
          pendingCount={(data.pending || []).length}
          onRefresh={onRefresh}
        />
        <button
          onClick={() => base44.auth.logout()}
          className="no-callout -mt-1 flex min-h-[48px] items-center gap-1 px-1 text-sm font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-rose-300"
        >
          <LogOut className="h-3 w-3" />
          Log out
        </button>
      </div>

      <div className="mt-1.5 flex items-end justify-center gap-4">
        <div className="min-w-0 flex-1 text-center">
          <p className="font-mono text-4xl font-bold leading-none text-emerald-300">{myScore.toFixed(1)}</p>
          <p className="mt-1 truncate text-xs font-semibold text-emerald-300/90">{data.myTeam.name}</p>
          <p className="text-sm text-white/50">{data.myTeam.wins}-{data.myTeam.losses} record</p>
        </div>
        <span className="shrink-0 bg-gradient-to-r from-emerald-400 to-rose-400 bg-clip-text pb-1 font-heading text-xl font-bold italic tracking-widest text-transparent">
          VS
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-mono text-4xl font-bold leading-none text-rose-300">
            {data.opponent ? oppScore.toFixed(1) : "—"}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-rose-300/90">
            {data.opponent ? data.opponent.name : "Bye week"}
          </p>
          {data.opponent && (
            <p className="text-sm text-white/50">{data.opponent.wins}-{data.opponent.losses} record</p>
          )}
        </div>
      </div>

      {data.opponent && total > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <DrawBar pct={myPct} className="bg-emerald-400" />
          <DrawBar pct={100 - myPct} className="bg-rose-400" />
        </div>
      )}
      <p className="mt-1.5 text-center text-sm text-white/60">
        {anyLive ? "live — actual points lock in as games finish" : "projected totals"}
      </p>
    </HudPanel>
  );
}