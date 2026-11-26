import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  DEFAULT_LEAGUE_ID,
  fetchLeagueCurrent,
  fetchFreeAgents,
  parseTeamSummary,
  parseTeamRoster,
  leaguePeriods,
  round1,
} from "../_shared/espnLeague.js";
import { computePlayoffOdds, buildLeaguePulse } from "../_shared/playoffAndPulse.js";

function trimPlayer(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    realPosition: p.realPosition,
    slot: p.slot,
    injuryStatus: p.injuryStatus,
    weeklyProj: p.weeklyProj,
    livePoints: p.livePoints,
    seasonProj: p.seasonProj,
    seasonAvg: p.seasonAvg,
    trend: p.trend,
    analysis: p.analysis || null,
  };
}

function localDayFromBody(body: Record<string, unknown> | null) {
  const d = body && typeof body.localDate === "string" ? body.localDate : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const [leagueRes, lockRes] = await Promise.all([
      fetchLeagueCurrent(["mNav", "mTeam", "mRoster", "mScoreboard", "mTransactions2"]),
      service
        .from("team_locks")
        .select("*")
        .eq("user_id", user.id)
        .eq("league_id", DEFAULT_LEAGUE_ID)
        .maybeSingle(),
    ]);

    const { league, season } = leagueRes;
    const leagueName = (league.settings && league.settings.name) || "ESPN League";
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const lock = lockRes.data;

    const freeAgentsPromise = fetchFreeAgents(season, DEFAULT_LEAGUE_ID, currentPeriod, 50)
      .then((fa) =>
        [...fa]
          .sort((a, b) => (b.weeklyProj - a.weeklyProj) || (b.seasonProj - a.seasonProj))
          .slice(0, 15),
      )
      .catch(() => []);

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
    const myRaw = rawTeams.find((t) => String(t.id) === String(lock.team_id));
    const roster = parseTeamRoster(myRaw, currentPeriod);

    const scoringTrend: { week: number; points: number }[] = [];
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      const home = m.home || {};
      const away = m.away || {};
      if (String(home.teamId) === mySummary.id) {
        scoringTrend.push({ week: m.matchupPeriodId, points: round1(home.totalPoints) });
      } else if (String(away.teamId) === mySummary.id) {
        scoringTrend.push({ week: m.matchupPeriodId, points: round1(away.totalPoints) });
      }
    }
    scoringTrend.sort((a, b) => a.week - b.week);

    const weeklyScores: Record<string, { week: number; points: number }[]> = {};
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      for (const side of [m.home || {}, m.away || {}]) {
        if (side.teamId == null) continue;
        const id = String(side.teamId);
        if (!weeklyScores[id]) weeklyScores[id] = [];
        weeklyScores[id].push({ week: m.matchupPeriodId, points: round1(side.totalPoints) });
      }
    }

    const headToHead: Record<string, unknown>[] = [];
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      const home = m.home || {};
      const away = m.away || {};
      let mine: number | null = null;
      let opp: number | null = null;
      let oppId: string | null = null;
      if (String(home.teamId) === mySummary.id) {
        mine = round1(home.totalPoints);
        opp = round1(away.totalPoints);
        oppId = String(away.teamId);
      } else if (String(away.teamId) === mySummary.id) {
        mine = round1(away.totalPoints);
        opp = round1(home.totalPoints);
        oppId = String(home.teamId);
      }
      if (mine === null) continue;
      const oppTeam = teams.find((t) => t.id === oppId);
      headToHead.push({
        week: m.matchupPeriodId,
        mine,
        opp,
        oppId,
        oppName: oppTeam ? oppTeam.name : "Unknown",
        win: mine > (opp ?? 0),
      });
    }
    headToHead.sort((a, b) => (a.week as number) - (b.week as number));

    const currentMatchup = schedule.find(
      (m) =>
        m.matchupPeriodId === currentPeriod &&
        (String((m.home || {}).teamId) === mySummary.id ||
          String((m.away || {}).teamId) === mySummary.id),
    );
    let opponent: Record<string, unknown> | null = null;
    let opponentStarters: Record<string, unknown>[] = [];
    let opponentBench: Record<string, unknown>[] = [];
    if (currentMatchup) {
      const homeId = String((currentMatchup.home || {}).teamId ?? "");
      const awayId = String((currentMatchup.away || {}).teamId ?? "");
      const oppId = homeId === mySummary.id ? awayId : homeId;
      const oppRaw = rawTeams.find((t) => String(t.id) === oppId);
      const oppSummary = teams.find((t) => t.id === oppId);
      if (oppRaw && oppSummary) {
        opponent = {
          id: oppSummary.id,
          name: oppSummary.name,
          wins: oppSummary.wins,
          losses: oppSummary.losses,
          pointsFor: oppSummary.pointsFor,
          avgPoints: round1(oppSummary.pointsFor / gamesPlayed),
        };
        const oppRoster = parseTeamRoster(oppRaw, currentPeriod);
        const trimOpp = (p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          realPosition: p.realPosition,
          slot: p.slot,
          weeklyProj: p.weeklyProj,
          livePoints: p.livePoints,
          injuryStatus: p.injuryStatus,
        });
        opponentStarters = oppRoster.filter((p) => p.isStarter).map(trimOpp);
        opponentBench = oppRoster.filter((p) => !p.isStarter).map(trimOpp);
      }
    }

    const freeAgents = await freeAgentsPromise;
    const leagueAvgPoints = teams.length
      ? round1(teams.reduce((s, t) => s + t.pointsFor, 0) / teams.length / gamesPlayed)
      : 0;

    const signatures: Record<string, string> = {};
    for (const p of roster) {
      signatures["p:" + p.id] = [p.injuryStatus, p.weeklyProj, p.slot].join("|");
    }
    if (opponent) {
      signatures["opp:" + opponent.id] = [
        opponent.id,
        opponent.wins,
        opponent.losses,
        opponent.avgPoints,
      ].join("|");
    }

    const [stateRes, analysesRes] = await Promise.all([
      service
        .from("refresh_states")
        .select("*")
        .eq("user_id", user.id)
        .eq("league_id", DEFAULT_LEAGUE_ID)
        .maybeSingle(),
      service.from("player_analyses").select("*").eq("user_id", user.id),
    ]);

    const state = stateRes.data;
    const analyses = analysesRes.data || [];
    const now = new Date().toISOString();
    let pending: string[] = [];
    if (state && state.signatures) {
      const oldPending = Array.isArray(state.pending) ? state.pending : [];
      const sigs = state.signatures as Record<string, string>;
      const changed = Object.keys(signatures).filter((k) => sigs[k] !== signatures[k]);
      pending = Array.from(new Set(oldPending.filter((k) => k in signatures).concat(changed)));
    }

    const today = localDayFromBody(body);
    const playoffCache = state?.playoff_cache as { date?: string; odds?: unknown } | null;
    const cachedOdds =
      playoffCache && playoffCache.date === today ? playoffCache.odds : null;
    let playoffOdds = cachedOdds;
    const freshOdds = cachedOdds ? null : { date: today, odds: null as unknown };
    if (!playoffOdds) {
      playoffOdds = computePlayoffOdds({
        teams,
        schedule,
        currentPeriod,
        regSeasonPeriods,
        myTeamId: mySummary.id,
        gamesPlayed,
      });
      if (freshOdds) freshOdds.odds = playoffOdds;
    }

    const unchanged = !freshOdds && state &&
      JSON.stringify(state.signatures) === JSON.stringify(signatures) &&
      JSON.stringify(Array.isArray(state.pending) ? state.pending : []) ===
        JSON.stringify(pending);

    if (!unchanged) {
      const stateRecord: Record<string, unknown> = {
        user_id: user.id,
        league_id: DEFAULT_LEAGUE_ID,
        last_refresh: now,
        signatures,
        pending,
      };
      if (freshOdds) stateRecord.playoff_cache = freshOdds;
      try {
        if (state) {
          await service.from("refresh_states").update(stateRecord).eq("id", state.id);
        } else {
          await service.from("refresh_states").insert(stateRecord);
        }
      } catch {
        /* non-fatal */
      }
    }

    const byPlayer: Record<string, (typeof analyses)[0]> = {};
    for (const a of analyses) byPlayer[String(a.player_id)] = a;
    for (const p of roster) {
      const a = byPlayer[p.id];
      p.analysis = a
        ? {
            verdict: a.verdict,
            confidence: a.confidence,
            weighted_edge: a.weighted_edge,
            news_headline: a.news_headline,
            analysis: a.analysis,
            factors: Array.isArray(a.factors) ? a.factors : [],
            analyzed_at: a.analyzed_at,
          }
        : null;
    }

    const leaguePulse = await buildLeaguePulse({
      league,
      teams,
      season,
      leagueId: DEFAULT_LEAGUE_ID,
      currentPeriod,
    });

    return jsonResponse({
      locked: true,
      league: {
        id: DEFAULT_LEAGUE_ID,
        name: leagueName,
        season,
        week: currentPeriod,
        leagueAvgPoints,
      },
      lock: {
        team_id: String(lock.team_id),
        team_name: lock.team_name,
        espn_email: lock.espn_email,
        birthday: lock.birthday,
      },
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pointsFor: t.pointsFor,
      })),
      myTeam: {
        id: mySummary.id,
        name: mySummary.name,
        wins: mySummary.wins,
        losses: mySummary.losses,
        ties: mySummary.ties,
        pointsFor: mySummary.pointsFor,
        pointsAgainst: mySummary.pointsAgainst,
        scoringTrend,
        starters: roster.filter((p) => p.isStarter).map(trimPlayer),
        bench: roster.filter((p) => !p.isStarter).map(trimPlayer),
      },
      headToHead,
      weeklyScores,
      opponent,
      opponentStarters,
      opponentBench,
      freeAgents,
      playoffOdds,
      leaguePulse,
      lastRefresh: now,
      pending,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});