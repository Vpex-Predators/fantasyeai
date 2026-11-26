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
import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, leaguePeriods, parseTeamRoster, parseTeamSummary } from '../_shared/espnLeague.js';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { user, service, userClient } = authed;

    const lockRow = await getTeamLock(service, user.id);
    const locks = lockRow ? [lockRow] : [];
    const lock = locks[0];
    if (!lock) return jsonResponse({ questions: FALLBACK_QUESTIONS });

    const { league } = await fetchLeagueCurrent(['mTeam', 'mRoster']);
    const { currentPeriod } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const mySummary = rawTeams.map(parseTeamSummary).find(t => t.id === String(lock.team_id));
    const myRaw = rawTeams.find(t => String(t.id) === String(lock.team_id));
    if (!mySummary || !myRaw) return jsonResponse({ questions: FALLBACK_QUESTIONS });

    const roster = parseTeamRoster(myRaw, currentPeriod);
    const starters = roster.filter(p => p.isStarter);
    const bench = roster.filter(p => !p.isStarter).slice(0, 6);
    const rosterFacts = [
      ...starters.map(p => `${p.name} (${p.position}, proj ${p.weeklyProj}, season avg ${p.seasonAvg}, ${p.injuryStatus})`),
      ...bench.map(p => `[bench] ${p.name} (${p.position}, proj ${p.weeklyProj}, ${p.injuryStatus})`)
    ].join('; ');

    const analyses = await listPlayerAnalyses(service, user.id);
    const verdicts = analyses
      .slice(-10)
      .map(a => `${a.player_name}: ${a.verdict}${a.weighted_edge != null ? ` (edge ${a.weighted_edge})` : ''}`)
      .join('; ');

    const prompt = `You are preparing suggested questions for a fantasy football manager's AI trade analyst chat. Team: "${mySummary.name}" (${mySummary.wins}-${mySummary.losses}), week ${currentPeriod}. Roster: ${rosterFacts}.${verdicts ? ` Recent AI verdicts on this roster: ${verdicts}.` : ''} Identify the biggest weaknesses (injured starters, players projected below their season average, thin positions, risky bench pieces) and write exactly 3 personalized questions this manager should ask their analyst. Each question: one sentence, max 15 words, mention specific player names where relevant, answerable from roster and league data. Do not number them.`;

    const result = await invokeLlm({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: { questions: { type: 'array', items: { type: 'string' } } },
        required: ['questions']
      }
    });
    const questions = Array.isArray(result.questions)
      ? result.questions.filter(q => typeof q === 'string' && q.trim()).slice(0, 3)
      : [];
    return jsonResponse({ questions: questions.length ? questions : FALLBACK_QUESTIONS });

  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
