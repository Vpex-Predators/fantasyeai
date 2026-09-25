import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamRoster, parseTeamSummary, leaguePeriods
} from '../../shared/espnLeague.js';
import { computePlayoffOdds } from '../../shared/playoffOdds.js';
import { matchupOpponentId } from '../../shared/matchup.js';
import { localDayFromRequest } from '../../shared/simDay.js';

// Manual refresh button: live scores plus a fresh 1,000-run playoff
// simulation. The new odds are persisted for the rest of the day, so
// subsequent dashboard loads serve them without re-simulating. AI analysis
// is still never run here.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const localDate = await localDayFromRequest(req);

    const [leagueRes, locks] = await Promise.all([
      fetchLeagueCurrent(['mNav', 'mTeam', 'mRoster', 'mScoreboard']),
      base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })
    ]);
    const { league } = leagueRes;
    const lock = locks[0];
    if (!lock) return Response.json({ error: 'Lock your team on the dashboard first.' }, { status: 400 });

    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const schedule = league.schedule || [];
    const myRaw = rawTeams.find(t => String(t.id) === String(lock.team_id));
    if (!myRaw) return Response.json({ error: 'Your locked team is no longer in the league.' }, { status: 400 });

    const trim = p => ({ id: p.id, injuryStatus: p.injuryStatus, livePoints: p.livePoints, weeklyProj: p.weeklyProj });
    const mine = parseTeamRoster(myRaw, currentPeriod).map(trim);

    const currentMatchup = schedule.find(m =>
      m.matchupPeriodId === currentPeriod &&
      (String((m.home || {}).teamId) === String(lock.team_id) || String((m.away || {}).teamId) === String(lock.team_id))
    );
    let opponent = [];
    if (currentMatchup) {
      const oppId = matchupOpponentId(currentMatchup, lock.team_id);
      const oppRaw = oppId ? rawTeams.find(t => String(t.id) === oppId) : null;
      if (oppRaw) opponent = parseTeamRoster(oppRaw, currentPeriod).map(trim);
    }

    // Fresh simulation — the refresh button is the manual override for the
    // once-a-day playoff cache.
    const teams = rawTeams.map(parseTeamSummary);
    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const playoffOdds = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: String(lock.team_id), gamesPlayed });

    // Persist the fresh odds for the rest of the day (best effort — a
    // failure here must never block the refresh itself).
    try {
      const states = await base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID });
      const playoff_cache = { date: localDate, odds: playoffOdds };
      if (states[0]) await base44.asServiceRole.entities.RefreshState.update(states[0].id, { playoff_cache });
      else await base44.asServiceRole.entities.RefreshState.create({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID, playoff_cache });
    } catch (e) { /* persistence unavailable — still serve the fresh numbers */ }

    return Response.json({
      week: currentPeriod,
      mine,
      opponent,
      playoffOdds,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}