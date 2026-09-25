import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DEFAULT_LEAGUE_ID, fetchLeagueCurrent,
  parseTeamSummary, parseRosterPlayer, PLAYBOOK_MODEL, round1
} from '../../shared/espnLeague.js';
import { matchupOpponentId } from '../../shared/matchup.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const locks = await base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID });
    if (locks.length === 0) return Response.json({ error: 'Pick your team first.' }, { status: 400 });
    const lock = locks[0];

    // Always recompute from ESPN — never trust lineup data sent by the client.
    const { league } = await fetchLeagueCurrent(['mTeam', 'mRoster', 'mScoreboard']);
    const currentPeriod = (league.status && (league.status.currentMatchupPeriod || league.status.latestScoringPeriod)) || 1;
    const rawTeams = league.teams || [];
    const schedule = league.schedule || [];
    const myId = String(lock.team_id);

    const currentMatchup = schedule.find(m =>
      m.matchupPeriodId === currentPeriod &&
      (String((m.home || {}).teamId) === myId || String((m.away || {}).teamId) === myId)
    );
    const oppId = currentMatchup ? matchupOpponentId(currentMatchup, myId) : null;
    if (!oppId) return Response.json({ error: 'No matchup found for this week (possibly a bye).' }, { status: 400 });
    const myRaw = rawTeams.find(t => String(t.id) === myId);
    const oppRaw = rawTeams.find(t => String(t.id) === oppId);
    if (!myRaw || !oppRaw) return Response.json({ error: 'Could not load both teams from ESPN.' }, { status: 400 });

    const gamesPlayed = Math.max(1, currentPeriod - 1);
    const mySummary = parseTeamSummary(myRaw);
    const oppSummary = parseTeamSummary(oppRaw);
    const mine = ((myRaw.roster && myRaw.roster.entries) || []).map(e => parseRosterPlayer(e, currentPeriod)).filter(p => p.isStarter);
    const theirs = ((oppRaw.roster && oppRaw.roster.entries) || []).map(e => parseRosterPlayer(e, currentPeriod)).filter(p => p.isStarter);

    // Position-by-position edges from live projections
    const positions = [];
    const posKeys = Array.from(new Set(mine.map(p => p.position).concat(theirs.map(p => p.position))));
    for (const pos of posKeys) {
      const best = (list) => list.filter(p => p.position === pos).reduce((m, p) => Math.max(m, p.weeklyProj), 0);
      const m = best(mine);
      const t = best(theirs);
      positions.push({ position: pos, mine: m, theirs: t, edge: round1(m - t) });
    }
    const myTotal = round1(mine.reduce((s, p) => s + p.weeklyProj, 0));
    const oppTotal = round1(theirs.reduce((s, p) => s + p.weeklyProj, 0));

    const lineupText = (list) => list.map(p => `${p.position} ${p.name} (proj ${p.weeklyProj}, avg ${p.seasonAvg}, ${p.injuryStatus})`).join('; ');
    const prompt = `NFL fantasy head-to-head analysis, week ${currentPeriod}.\n\nTeam A: "${mySummary.name}" (${mySummary.wins}-${mySummary.losses}, ${mySummary.pointsFor} pts for, avg ${round1(mySummary.pointsFor / gamesPlayed)}/game).\nStarters: ${lineupText(mine)}.\nProjected total: ${myTotal}.\n\nTeam B: "${oppSummary.name}" (${oppSummary.wins}-${oppSummary.losses}, ${oppSummary.pointsFor} pts for, avg ${round1(oppSummary.pointsFor / gamesPlayed)}/game).\nStarters: ${lineupText(theirs)}.\nProjected total: ${oppTotal}.\n\n${PLAYBOOK_MODEL}\n\nSearch for the latest injuries, news, and matchup intel for the key players on both teams. Decide which team has the upper hand this week and exactly why (cite specific numbers and players). Give Team A's win probability (0-100). Then list concrete levers EACH side can pull to change the outcome — lineup swaps, waiver adds, streaming options — naming specific players. For upper_hand use the exact team name string as given.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          upper_hand: { type: 'string' },
          edge_points: { type: 'number' },
          win_probability: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
          user_levers: { type: 'array', items: { type: 'string' } },
          opponent_levers: { type: 'array', items: { type: 'string' } }
        },
        required: ['upper_hand', 'reasons', 'user_levers', 'opponent_levers']
      }
    });

    return Response.json({
      matchup: result,
      totals: { mine: myTotal, theirs: oppTotal },
      positions,
      week: currentPeriod
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}