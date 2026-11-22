import React from "react";
import HudPanel from "@/components/hud/HudPanel";
import PulseTotals from "@/components/fantasy/dashboard/PulseTotals";
import PulseLeaderboard from "@/components/fantasy/dashboard/PulseLeaderboard";
import PulseMoveFeed from "@/components/fantasy/dashboard/PulseMoveFeed";
import CollusionRadar from "@/components/fantasy/dashboard/CollusionRadar";

// League Pulse: the whole league's season totals, other managers' recent
// moves, and the pattern-detector collusion radar — one HUD panel.
export default function LeaguePulse({ pulse, teams, myTeam }) {
  const hasPulse = !!pulse;
  return (
    <HudPanel label="League pulse" right="SEASON SCAN">
      <div className="space-y-3.5">
        {hasPulse ? (
          <PulseTotals totals={pulse.totals} myTeam={myTeam} />
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-white/60">
            Season totals are still syncing from ESPN — the standings below are live.
          </p>
        )}
        <PulseLeaderboard teams={teams || []} myTeamId={myTeam?.id} />
        <PulseMoveFeed
          moves={hasPulse ? pulse.moves || [] : []}
          available={hasPulse ? pulse.movesAvailable !== false : false}
        />
        <CollusionRadar flags={hasPulse ? pulse.flags || [] : []} available={hasPulse} />
      </div>
    </HudPanel>
  );
}