import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
  upsertRefreshState,
} from "../_shared/auth.ts";
import {
  fetchLeagueCurrent,
  parseTeamRoster,
  parseTeamSummary,
  leaguePeriods,
} from "../_shared/espnLeague.js";
import { computePlayoffOdds } from "../_shared/playoffAndPulse.js";

function localDayFromBody(body: Record<string, unknown> | null) {
  const d = body && typeof body.localDate === "string" ? body.localDate : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    let body: Record<string, unknown> | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const localDate = localDayFromBody(body);

    const [leagueRes, lock] = await Promise.all([
      fetchLeagueCurrent(["mNav", "mTeam", "mRoster", "mScoreboard"]),
      getTeamLock(service, user.id),
    ]);
    const { league } = leagueRes;
    if (!lock) {
      return jsonResponse({ error: "Lock your team on the dashboard first." }, 400);
    }

    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const schedule = league.schedule || [];
    const myRaw = rawTeams.find((t) => String(t.id) === String(lock.team_id));
    if (!myRaw) {
      return jsonResponse({ error: "Your locked team is no longer in the league." }, 400);
    }

    const trim = (p: Record<string, unknown>) => ({
      id: p.id,
      injuryStatus: p.injuryStatus,
      livePoints: p.livePoints,
      weeklyProj: p.weeklyProj,
    });
    const mine = parseTeamRoster(myRaw, currentPeriod).map(trim);

    const currentMatchup = schedule.find(
      (m) =>
        m.matchupPeriodId === currentPeriod &&
        (String((m.home || {}).teamId) === String(lock.team_id) ||
          String((m.away || {}).teamId) === String(lock.team_id)),
    );
    let opponent: ReturnType<typeof trim>[] = [];
    if (currentMatchup) {
      const homeId = String((currentMatchup.home || {}).teamId ?? "");
      const awayId = String((currentMatchup.away || {}).teamId ?? "");
      const oppId = homeId === String(lock.team_id) ? awayId : homeId;
      const oppRaw = rawTeams.find((t) => String(t.id) === oppId);
      if (oppRaw) opponent = parseTeamRoster(oppRaw, currentPeriod).map(trim);
    }

    const teams = rawTeams.map(parseTeamSummary);
    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const playoffOdds = computePlayoffOdds({
      teams,
      schedule,
      currentPeriod,
      regSeasonPeriods,
      myTeamId: String(lock.team_id),
      gamesPlayed,
    });

    try {
      await upsertRefreshState(service, user.id, {
        playoff_cache: { date: localDate, odds: playoffOdds },
      });
    } catch {
      /* non-fatal */
    }

    return jsonResponse({
      week: currentPeriod,
      mine,
      opponent,
      playoffOdds,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});