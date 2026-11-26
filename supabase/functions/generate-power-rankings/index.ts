import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
  getRefreshState,
  upsertRefreshState,
  listPlayerAnalyses,
  invokeLlm,
} from "../_shared/auth.ts";
import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';
import { computePlayoffOdds } from '../_shared/playoffAndPulse.js';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { user, service, userClient } = authed;

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const model = ALLOWED_MODELS.includes(body.model) ? body.model : 'automatic';
    const useWeb = WEB_MODELS.has(model);

    const { league } = await fetchLeagueCurrent(['mNav', 'mTeam', 'mScoreboard']);
    const leagueName = (league.settings && league.settings.name) || 'ESPN League';
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    if (!teams.length) return jsonResponse({ error: 'No teams found in this league.' }, { status: 400 });

    const lockRow = await getTeamLock(service, user.id);
    const locks = lockRow ? [lockRow] : [];
    const lock = locks[0];
    if (!lock) return jsonResponse({ error: 'Lock your team on the dashboard first.' }, { status: 400 });
    const myId = String(lock.team_id);

    const odds = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: myId, gamesPlayed: Math.max(1, currentPeriod - 1) });
    const race = odds ? odds.race : [];

    // Completed-week results: per-team win/loss log, weekly score pools for
    // expected wins (luck factor) and recent form.
    const results = {};
    const weekScores = {};
    for (const m of schedule) {
      if (m.matchupPeriodId >= currentPeriod) continue;
      const h = m.home || {}, a = m.away || {};
      if (h.teamId == null || a.teamId == null) continue;
      const hid = String(h.teamId), aid = String(a.teamId);
      const hp = Number(h.totalPoints) || 0, ap = Number(a.totalPoints) || 0;
      (results[hid] = results[hid] || []).push({ week: m.matchupPeriodId, win: hp > ap });
      (results[aid] = results[aid] || []).push({ week: m.matchupPeriodId, win: ap > hp });
      (weekScores[m.matchupPeriodId] = weekScores[m.matchupPeriodId] || []).push({ id: hid, pts: hp });
      weekScores[m.matchupPeriodId].push({ id: aid, pts: ap });
    }

    const weeks = Object.keys(weekScores).map(Number).sort((a, b) => a - b);
    const lines = teams.map(t => {
      const myResults = results[t.id] || [];
      // Expected wins: across each completed week, how often this team's score beats the field.
      let expectedWins = 0;
      for (const w of weeks) {
        const pool = weekScores[w] || [];
        const mine = pool.find(s => s.id === t.id);
        if (!mine || pool.length < 2) continue;
        expectedWins += pool.filter(s => s.id !== t.id && s.pts < mine.pts).length / (pool.length - 1);
      }
      const luck = round1((t.wins + 0.5 * (t.ties || 0)) - expectedWins);
      const last3Pool = weeks.slice(-3).map(w => (weekScores[w] || []).find(s => s.id === t.id)).filter(Boolean);
      const last3 = last3Pool.length ? round1(last3Pool.reduce((s, g) => s + g.pts, 0) / last3Pool.length) : 0;
      const r = race.find(x => x.id === t.id) || {};
      return {
        name: t.name, wins: t.wins, losses: t.losses, ties: t.ties || 0,
        pointsFor: t.pointsFor, pointsAgainst: t.pointsAgainst,
        diff: round1(t.pointsFor - t.pointsAgainst),
        streak: streakOf(myResults), luck, last3,
        playoffPct: r.playoffPct ?? null, titlePct: r.titlePct ?? null
      };
    });

    const myTeam = teams.find(t => t.id === myId);
    const linesText = lines.map(l =>
      `${l.name}: ${l.wins}-${l.losses}${l.ties ? '-' + l.ties : ''} · PF ${l.pointsFor} · PA ${l.pointsAgainst} · diff ${l.diff} · streak ${l.streak} · luck ${l.luck} · L3 avg ${l.last3} · playoff ${l.playoffPct}% · title ${l.titlePct}%`
    ).join('\n');

    const prompt = `You are the league power-rankings analyst for the ${teams.length}-team "${leagueName}" fantasy league. It is week ${currentPeriod}. Weighted decision model: ${PLAYBOOK_MODEL}

LIVE TEAM DATA (luck factor = actual wins minus expected wins based on weekly scoring vs. the field):
${linesText}

"${myTeam ? myTeam.name : 'The user\'s team'}" is the analyst's own team.

Power-rank ALL ${teams.length} teams by TRUE strength, not just record. Reward teams scoring well despite bad luck; expose teams winning on luck. Look up the latest news and injuries around these rosters' key players where relevant.

Return JSON: rankings = ordered array (best first, one entry per team) of { rank, team (exact team name from the data), verdict (max 12 words: the true-strength read), roast (one spicy trash-talk line anchored to a real number from the data) }.`;

    const llm = await invokeLlm({
      prompt, model, add_context_from_internet: useWeb,
      response_json_schema: {
        type: 'object',
        properties: {
          rankings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rank: { type: 'integer' },
                team: { type: 'string' },
                verdict: { type: 'string' },
                roast: { type: 'string' }
              },
              required: ['rank', 'team', 'verdict', 'roast']
            }
          }
        },
        required: ['rankings']
      }
    });

    const rankings = (llm && Array.isArray(llm.rankings)) ? llm.rankings.slice().sort((a, b) => (a.rank || 0) - (b.rank || 0)) : [];

    return jsonResponse({
      rankings,
      model, webContext: useWeb,
      week: currentPeriod,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
