import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DEFAULT_LEAGUE_ID, fetchLeagueCurrent,
  parseTeamSummary, parseTeamRoster, leaguePeriods
} from '../../shared/espnLeague.js';
import { computePlayoffOdds } from '../../shared/playoffOdds.js';
import { matchupOpponentId } from '../../shared/matchup.js';

const ALLOWED_MODELS = ['automatic', 'gemini_3_flash', 'gemini_3_1_pro', 'gpt_5_mini', 'gpt_5_4', 'gpt_5_6_sol', 'gpt_5_6_luna', 'claude-sonnet-5', 'claude_opus_5', 'claude_opus_4_8'];
const WEB_MODELS = new Set(['automatic', 'gemini_3_flash', 'gemini_3_1_pro']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const model = ALLOWED_MODELS.includes(body.model) ? body.model : 'automatic';
    const useWeb = WEB_MODELS.has(model);

    const { league } = await fetchLeagueCurrent(['mNav', 'mTeam', 'mRoster', 'mScoreboard']);
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    const gamesPlayed = Math.max(1, currentPeriod - 1);

    const locks = await base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID });
    const lock = locks[0];
    if (!lock) return Response.json({ error: 'Lock your team on the dashboard first, then run the analyst.' }, { status: 400 });

    const myId = String(lock.team_id);
    const myRaw = rawTeams.find(t => String(t.id) === myId);
    const myTeam = teams.find(t => t.id === myId);
    if (!myRaw || !myTeam) return Response.json({ error: 'Your locked team is no longer in this league.' }, { status: 400 });

    const odds = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: myId, gamesPlayed });

    const roster = parseTeamRoster(myRaw, currentPeriod);
    const myStarters = roster.filter(p => p.isStarter)
      .map(p => `${p.position} ${p.name}: wk proj ${p.weeklyProj}, season avg ${p.seasonAvg}, ${p.injuryStatus}`);
    const myBench = roster.filter(p => !p.isStarter).slice(0, 6)
      .map(p => `${p.position} ${p.name}: wk proj ${p.weeklyProj}, ${p.injuryStatus}`);

    const currentMatchup = schedule.find(m =>
      m.matchupPeriodId === currentPeriod &&
      (String((m.home || {}).teamId) === myId || String((m.away || {}).teamId) === myId)
    );
    let opponentLines = 'No opponent scheduled yet.';
    const oppId = currentMatchup ? matchupOpponentId(currentMatchup, myId) : null;
    if (oppId) {
      const oppRaw = rawTeams.find(t => String(t.id) === oppId);
      const oppSummary = teams.find(t => t.id === oppId);
      if (oppRaw && oppSummary) {
        const oppStarters = parseTeamRoster(oppRaw, currentPeriod)
          .filter(p => p.isStarter)
          .sort((a, b) => b.weeklyProj - a.weeklyProj)
          .slice(0, 10)
          .map(p => `${p.position} ${p.name}: wk proj ${p.weeklyProj}, ${p.injuryStatus}`);
        opponentLines = `${oppSummary.name} (${oppSummary.wins}-${oppSummary.losses}):\n${oppStarters.join('\n') || 'No projected starters'}`;
      }
    }

    const standings = (odds ? odds.race : []).map((t, i) =>
      `${i + 1}. ${t.name} ${t.wins}-${t.losses}${t.ties ? '-' + t.ties : ''} · PF ${t.pointsFor} · playoff ${t.playoffPct}% · title ${t.titlePct}%`
    ).join('\n');

    const remaining = odds && odds.mine
      ? odds.mine.remaining.map(r =>
          `Week ${r.week} vs ${r.opponent.name} (${r.opponent.wins}-${r.opponent.losses}, ${r.opponent.avgPoints} ppg): ${r.winProb}% win — ${r.grade}`
        ).join('\n') || 'Regular season complete.'
      : 'Schedule data unavailable.';

    const prompt = `You are the tactical mission analyst for the fantasy team "${myTeam.name}" (${myTeam.wins}-${myTeam.losses}) in a ${teams.length}-team NFL fantasy league. It is week ${currentPeriod} of a ${regSeasonPeriods}-week regular season and the top ${odds ? odds.playoffTeamCount : 6} teams make the playoffs.

CURRENT STANDINGS AND SIMULATED ODDS (1,000 season simulations of the real remaining schedule):
${standings}

MY TEAM'S PLAYOFF OUTLOOK: ${odds && odds.mine ? `${odds.mine.playoffPct}% playoff odds, most likely seed #${odds.mine.likelySeed}, ${odds.mine.titlePct}% title odds, ${odds.mine.currentWeekWinProb == null ? 'unknown' : odds.mine.currentWeekWinProb + '%'} win probability this week.` : 'Odds unavailable.'}

MY REMAINING SCHEDULE (win-probability model):
${remaining}

MY PROJECTED STARTERS (position, name, weekly projection, season average, injury status):
${myStarters.join('\n')}

KEY BENCH PIECES:
${myBench.join('\n') || 'None listed'}

THIS WEEK'S OPPONENT:
${opponentLines}

Look up the LATEST news, injuries, depth charts, and expert projections for these players and their NFL teams right now. Factor in each skill player's QB situation and their history with their QB (target share, chemistry, recent game logs together).

Write a SHORT plain-English briefing for someone who has never played fantasy football. Hard rules:
- Everyday words only. No jargon — say "your chance to make the playoffs", not "seed equity" or "ROS floor".
- Each section: at most 3 short sentences. Whole briefing under 160 words.
- Quote the 2-3 numbers that matter (win %, playoff %, one projection) and immediately say what each means.
- Use markdown with exactly these sections:
### Where you stand — record and playoff chance in one breath
### This week — who you play, your chance to win, and the one player story that matters most
### The road ahead — the rest of the schedule in one or two plain sentences
### Do this now — exactly 3 moves (start / bench / add / trade), one short line each with the number behind it

Be direct and confident. No preamble.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model,
      add_context_from_internet: useWeb
    });
    const briefing = typeof llm === 'string' ? llm : (llm && (llm.response || llm.text)) || String(llm);

    return Response.json({
      briefing,
      model,
      webContext: useWeb,
      week: currentPeriod,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}