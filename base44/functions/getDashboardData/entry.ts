import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DEFAULT_LEAGUE_ID, fetchLeagueCurrent, fetchFreeAgents,
  parseTeamSummary, parseTeamRoster, leaguePeriods, round1
} from '../../shared/espnLeague.js';
import { computePlayoffOdds } from '../../shared/playoffOdds.js';
import { localDayFromRequest } from '../../shared/simDay.js';
import { buildLeaguePulse } from '../../shared/leaguePulse.js';

function trimPlayer(p) {
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
    analysis: p.analysis || null
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [leagueRes, locks] = await Promise.all([
      fetchLeagueCurrent(['mNav', 'mTeam', 'mRoster', 'mScoreboard', 'mTransactions2']),
      base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })
    ]);
    const { league, season } = leagueRes;
    const leagueName = (league.settings && league.settings.name) || 'ESPN League';
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const lock = locks[0] || null;

    // Kick off the waiver-wire fetch immediately — it runs while we build the rest.
    const freeAgentsPromise = fetchFreeAgents(season, DEFAULT_LEAGUE_ID, currentPeriod, 50)
      .then(fa => [...fa].sort((a, b) => (b.weeklyProj - a.weeklyProj) || (b.seasonProj - a.seasonProj)).slice(0, 15))
      .catch(() => []);

    // Not locked yet — return the team list so the user can pick theirs.
    if (!lock) {
      return Response.json({
        locked: false,
        league: { id: DEFAULT_LEAGUE_ID, name: leagueName, season, week: currentPeriod },
        teams: teams.map(t => ({ id: t.id, name: t.name, wins: t.wins, losses: t.losses }))
      });
    }

    const mySummary = teams.find(t => t.id === String(lock.team_id));
    if (!mySummary) return Response.json({ error: 'Your locked team is no longer in this league. Ask the admin to fix your pick.' }, { status: 400 });
    const myRaw = rawTeams.find(t => String(t.id) === String(lock.team_id));
    const roster = parseTeamRoster(myRaw, currentPeriod);

    // Season scoring trend from the schedule (completed weeks only — future
    // matchups would otherwise show as 0 and flatten the chart).
    const scoringTrend = [];
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      const home = m.home || {};
      const away = m.away || {};
      if (String(home.teamId) === mySummary.id) scoringTrend.push({ week: m.matchupPeriodId, points: round1(home.totalPoints) });
      else if (String(away.teamId) === mySummary.id) scoringTrend.push({ week: m.matchupPeriodId, points: round1(away.totalPoints) });
    }
    scoringTrend.sort((a, b) => a.week - b.week);

    // Per-team weekly points (completed weeks only) — powers the opponent overlay
    const weeklyScores = {};
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      for (const side of [m.home || {}, m.away || {}]) {
        if (side.teamId == null) continue;
        const id = String(side.teamId);
        if (!weeklyScores[id]) weeklyScores[id] = [];
        weeklyScores[id].push({ week: m.matchupPeriodId, points: round1(side.totalPoints) });
      }
    }

    // My week-by-week head-to-head results (completed weeks only)
    const headToHead = [];
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      const home = m.home || {};
      const away = m.away || {};
      let mine = null, opp = null, oppId = null;
      if (String(home.teamId) === mySummary.id) { mine = round1(home.totalPoints); opp = round1(away.totalPoints); oppId = String(away.teamId); }
      else if (String(away.teamId) === mySummary.id) { mine = round1(away.totalPoints); opp = round1(home.totalPoints); oppId = String(home.teamId); }
      if (mine === null) continue;
      const oppTeam = teams.find(t => t.id === oppId);
      headToHead.push({ week: m.matchupPeriodId, mine, opp, oppId, oppName: oppTeam ? oppTeam.name : 'Unknown', win: mine > opp });
    }
    headToHead.sort((a, b) => a.week - b.week);

    // This week's opponent
    const currentMatchup = schedule.find(m =>
      m.matchupPeriodId === currentPeriod &&
      (String((m.home || {}).teamId) === mySummary.id || String((m.away || {}).teamId) === mySummary.id)
    );
    let opponent = null;
    let opponentStarters = [];
    let opponentBench = [];
    if (currentMatchup) {
      const homeId = String((currentMatchup.home || {}).teamId ?? '');
      const awayId = String((currentMatchup.away || {}).teamId ?? '');
      const oppId = homeId === mySummary.id ? awayId : homeId;
      const oppRaw = rawTeams.find(t => String(t.id) === oppId);
      const oppSummary = teams.find(t => t.id === oppId);
      if (oppRaw && oppSummary) {
        opponent = {
          id: oppSummary.id,
          name: oppSummary.name,
          wins: oppSummary.wins,
          losses: oppSummary.losses,
          pointsFor: oppSummary.pointsFor,
          avgPoints: round1(oppSummary.pointsFor / gamesPlayed)
        };
        const oppRoster = parseTeamRoster(oppRaw, currentPeriod);
        const trimOpp = p => ({ id: p.id, name: p.name, position: p.position, realPosition: p.realPosition, slot: p.slot, weeklyProj: p.weeklyProj, livePoints: p.livePoints, injuryStatus: p.injuryStatus });
        opponentStarters = oppRoster.filter(p => p.isStarter).map(trimOpp);
        opponentBench = oppRoster.filter(p => !p.isStarter).map(trimOpp);
      }
    }

    // Free agents (best effort — the dashboard still loads without them)
    const freeAgents = await freeAgentsPromise;

    const leagueAvgPoints = teams.length ? round1(teams.reduce((s, t) => s + t.pointsFor, 0) / teams.length / gamesPlayed) : 0;

    // Live-data diff: which items changed since the user's last refresh
    const signatures = {};
    for (const p of roster) signatures['p:' + p.id] = [p.injuryStatus, p.weeklyProj, p.slot].join('|');
    if (opponent) signatures['opp:' + opponent.id] = [opponent.id, opponent.wins, opponent.losses, opponent.avgPoints].join('|');

    const [states, analyses] = await Promise.all([
      base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID }),
      base44.asServiceRole.entities.PlayerAnalysis.filter({ user_id: user.id })
    ]);
    const state = states[0] || null;
    const now = new Date().toISOString();
    let pending = [];
    if (state && state.signatures) {
      const oldPending = Array.isArray(state.pending) ? state.pending : [];
      const changed = Object.keys(signatures).filter(k => state.signatures[k] !== signatures[k]);
      pending = Array.from(new Set(oldPending.filter(k => k in signatures).concat(changed)));
    }

    // Playoff odds: per-matchup win-probability model + 1,000-run season
    // simulation, run once per calendar day — same-day loads serve the
    // stored numbers unchanged so repeat visits stay stable. The refresh
    // button re-simulates and overwrites this cache.
    const today = await localDayFromRequest(req);
    const cachedOdds = state && state.playoff_cache && state.playoff_cache.date === today
      ? state.playoff_cache.odds : null;
    let playoffOdds = cachedOdds;
    const freshOdds = cachedOdds ? null : { date: today, odds: null };
    if (!playoffOdds) {
      playoffOdds = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: mySummary.id, gamesPlayed });
      freshOdds.odds = playoffOdds;
    }

    // Skip the write when nothing changed since last time (same signatures + pending).
    const unchanged = !freshOdds && state && JSON.stringify(state.signatures) === JSON.stringify(signatures)
      && JSON.stringify(Array.isArray(state.pending) ? state.pending : []) === JSON.stringify(pending);
    if (!unchanged) {
      const stateRecord = { user_id: user.id, league_id: DEFAULT_LEAGUE_ID, last_refresh: now, signatures, pending };
      if (freshOdds) stateRecord.playoff_cache = freshOdds;
      try {
        // Best effort — a failure here must never block the briefing itself.
        if (state) await base44.asServiceRole.entities.RefreshState.update(state.id, stateRecord);
        else await base44.asServiceRole.entities.RefreshState.create(stateRecord);
      } catch (e) { /* refresh-state persistence unavailable — skip */ }
    }

    // Attach each user's cached AI verdicts (fetched above in parallel) to their roster players
    const byPlayer = {};
    for (const a of analyses) byPlayer[String(a.player_id)] = a;
    for (const p of roster) {
      const a = byPlayer[p.id];
      p.analysis = a ? {
        verdict: a.verdict,
        confidence: a.confidence,
        weighted_edge: a.weighted_edge,
        news_headline: a.news_headline,
        analysis: a.analysis,
        factors: Array.isArray(a.factors) ? a.factors : [],
        analyzed_at: a.analyzed_at
      } : null;
    }

    // League pulse: season totals, recent moves, and the collusion radar
    const leaguePulse = await buildLeaguePulse({ league, teams, season, leagueId: DEFAULT_LEAGUE_ID, currentPeriod });

    return Response.json({
      locked: true,
      league: { id: DEFAULT_LEAGUE_ID, name: leagueName, season, week: currentPeriod, leagueAvgPoints },
      lock: { team_id: String(lock.team_id), team_name: lock.team_name, espn_email: lock.espn_email, birthday: lock.birthday },
      teams: teams.map(t => ({ id: t.id, name: t.name, wins: t.wins, losses: t.losses, ties: t.ties, pointsFor: t.pointsFor })),
      myTeam: {
        id: mySummary.id,
        name: mySummary.name,
        wins: mySummary.wins,
        losses: mySummary.losses,
        ties: mySummary.ties,
        pointsFor: mySummary.pointsFor,
        pointsAgainst: mySummary.pointsAgainst,
        scoringTrend,
        starters: roster.filter(p => p.isStarter).map(trimPlayer),
        bench: roster.filter(p => !p.isStarter).map(trimPlayer)
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
      pending
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}