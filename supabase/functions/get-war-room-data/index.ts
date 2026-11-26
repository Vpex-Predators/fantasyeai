import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
} from "../_shared/auth.ts";
import {
  DEFAULT_LEAGUE_ID,
  fetchLeagueCurrent,
  fetchFreeAgents,
  parseTeamSummary,
  parseTeamRoster,
  leaguePeriods,
} from "../_shared/espnLeague.js";
import { computeThreatBoard } from "../_shared/playoffAndPulse.js";

function trimRoster(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    slot: p.slot,
    isStarter: p.isStarter,
    injuryStatus: p.injuryStatus,
    weeklyProj: p.weeklyProj,
    seasonProj: p.seasonProj,
    seasonAvg: p.seasonAvg,
    percentOwned: p.percentOwned,
    trend: p.trend,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    const { league, season } = await fetchLeagueCurrent([
      "mNav",
      "mTeam",
      "mRoster",
      "mScoreboard",
    ]);
    const leagueName = (league.settings && league.settings.name) || "ESPN League";
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const lock = await getTeamLock(service, user.id);

    if (!lock) {
      return jsonResponse({
        locked: false,
        league: { id: DEFAULT_LEAGUE_ID, name: leagueName, season, week: currentPeriod },
        teams: teams.map((t) => ({ id: t.id, name: t.name, wins: t.wins, losses: t.losses })),
      });
    }

    const mySummary = teams.find((t) => t.id === String(lock.team_id));
    if (!mySummary) {
      return jsonResponse(
        { error: "Your locked team is no longer in this league. Ask the admin to fix your pick." },
        400,
      );
    }

    const threatBoard = computeThreatBoard({
      teams,
      schedule,
      currentPeriod,
      regSeasonPeriods,
      myTeamId: mySummary.id,
      gamesPlayed,
    });
    const freeAgents = await fetchFreeAgents(season, DEFAULT_LEAGUE_ID, currentPeriod, 200);
    const rosters: Record<string, ReturnType<typeof trimRoster>[]> = {};
    for (const raw of rawTeams) {
      rosters[String(raw.id)] = parseTeamRoster(raw, currentPeriod).map(trimRoster);
    }

    return jsonResponse({
      locked: true,
      league: { id: DEFAULT_LEAGUE_ID, name: leagueName, season, week: currentPeriod },
      myTeam: {
        id: mySummary.id,
        name: mySummary.name,
        wins: mySummary.wins,
        losses: mySummary.losses,
        ties: mySummary.ties,
        pointsFor: mySummary.pointsFor,
        pointsAgainst: mySummary.pointsAgainst,
      },
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pointsFor: t.pointsFor,
      })),
      threatBoard,
      rosters,
      freeAgents: freeAgents.map(trimRoster),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});