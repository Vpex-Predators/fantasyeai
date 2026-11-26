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
import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseTeamRoster, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';
import { computePlayoffOdds } from '../_shared/playoffAndPulse.js';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { user, service, userClient } = authed;

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const mode = ['simulate', 'verdict', 'suggest'].includes(body.mode) ? body.mode : null;
    if (!mode) return jsonResponse({ error: 'Invalid mode. Use simulate, verdict, or suggest.' }, { status: 400 });
    const model = ALLOWED_MODELS.includes(body.model) ? body.model : 'automatic';
    const useWeb = WEB_MODELS.has(model);

    const { league } = await fetchLeagueCurrent(['mNav', 'mTeam', 'mRoster', 'mScoreboard']);
    const { currentPeriod, regSeasonPeriods } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const teams = rawTeams.map(parseTeamSummary);
    const schedule = league.schedule || [];
    const gamesPlayed = Math.max(1, currentPeriod - 1);

    const lockRow = await getTeamLock(service, user.id);
    const locks = lockRow ? [lockRow] : [];
    const lock = locks[0];
    if (!lock) return jsonResponse({ error: 'Lock your team on the dashboard first.' }, { status: 400 });
    const myId = String(lock.team_id);

    const partnerId = String(body.partnerTeamId || '');
    if (!partnerId || partnerId === myId) return jsonResponse({ error: 'Pick a trade partner team.' }, { status: 400 });

    const rosters = {};
    for (const raw of rawTeams) rosters[String(raw.id)] = parseTeamRoster(raw, currentPeriod);
    const myPlayers = rosters[myId] || [];
    const partnerPlayers = rosters[partnerId] || [];
    if (!partnerPlayers.length) return jsonResponse({ error: 'That team is not in this league.' }, { status: 400 });

    const mySummary = teams.find(t => t.id === myId);
    const partnerSummary = teams.find(t => t.id === partnerId);
    if (!mySummary || !partnerSummary) return jsonResponse({ error: 'Team not found in this league.' }, { status: 400 });

    // --- AI-guided mode: propose fair swaps from the two live rosters ---
    if (mode === 'suggest') {
      const odds = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: myId, gamesPlayed });
      const standings = (odds ? odds.race : []).map((t, i) =>
        `${i + 1}. ${t.name} ${t.wins}-${t.losses} · playoff ${t.playoffPct}% · title ${t.titlePct}%`
      ).join('\n');

      const prompt = `You are the trade analyst for the fantasy team "${mySummary.name}" (${mySummary.wins}-${mySummary.losses}) in a ${teams.length}-team league. It is week ${currentPeriod} of the regular season. Weighted decision model: ${PLAYBOOK_MODEL}

MY ROSTER:
${myPlayers.map(playerLine).join('\n')}

TRADE PARTNER "${partnerSummary.name}" (${partnerSummary.wins}-${partnerSummary.losses}) ROSTER:
${partnerPlayers.map(playerLine).join('\n')}

STANDINGS AND SIMULATED ODDS:
${standings}

Propose up to 3 realistic, mutually fair trades between these two teams that improve my title odds. Use ONLY the exact player names listed above, spelling them identically. Look up the LATEST news, injuries, depth charts, and projections for these players and their NFL teams, and factor in each skill player's QB situation and their history with their QB.

Return JSON: trades = array (max 3) of { give: [exact player names from MY roster to send], get: [exact player names from THEIR roster to receive], rationale: one sentence citing the numbers and news }.`;

      const llm = await invokeLlm({
        prompt, model, add_context_from_internet: useWeb,
        response_json_schema: {
          type: 'object',
          properties: {
            trades: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  give: { type: 'array', items: { type: 'string' } },
                  get: { type: 'array', items: { type: 'string' } },
                  rationale: { type: 'string' }
                },
                required: ['give', 'get', 'rationale']
              }
            }
          },
          required: ['trades']
        }
      });
      return jsonResponse({
        trades: (llm && Array.isArray(llm.trades)) ? llm.trades.slice(0, 3) : [],
        model, webContext: useWeb,
        generatedAt: new Date().toISOString()
      });
    }

    // --- simulate / verdict: validate the tapped trade against the live rosters ---
    const giveIds = Array.isArray(body.give) ? body.give.map(String).slice(0, MAX_PER_SIDE) : [];
    const getIds = Array.isArray(body.get) ? body.get.map(String).slice(0, MAX_PER_SIDE) : [];
    if (!giveIds.length || !getIds.length) {
      return jsonResponse({ error: 'Select at least one player on each side of the trade.' }, { status: 400 });
    }
    const givePlayers = myPlayers.filter(p => giveIds.includes(p.id));
    const getPlayers = partnerPlayers.filter(p => getIds.includes(p.id));
    if (givePlayers.length !== giveIds.length || getPlayers.length !== getIds.length) {
      return jsonResponse({ error: 'Some selected players are not on those rosters.' }, { status: 400 });
    }

    // Lineup-level projection shift: incoming players assumed to start, outgoing starters replaced.
    const myLineupDelta = round1(sumProj(getPlayers) - sumProj(givePlayers.filter(p => p.isStarter)));
    const partnerLineupDelta = round1(sumProj(givePlayers) - sumProj(getPlayers.filter(p => p.isStarter)));

    const base = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: myId, gamesPlayed });
    const after = computePlayoffOdds({
      teams, schedule, currentPeriod, regSeasonPeriods, myTeamId: myId, gamesPlayed,
      meanAdjust: { [myId]: myLineupDelta, [partnerId]: partnerLineupDelta }
    });

    const side = (odds, id) => {
      const r = (odds.race || []).find(t => t.id === id) || {};
      return {
        name: r.name || '',
        playoffPct: r.playoffPct ?? null,
        titlePct: r.titlePct ?? null,
        avgWins: r.avgWins ?? null
      };
    };
    const before = { mine: side(base, myId), partner: side(base, partnerId) };
    const afterOdds = { mine: side(after, myId), partner: side(after, partnerId) };
    before.mine.likelySeed = base.mine ? base.mine.likelySeed : null;
    afterOdds.mine.likelySeed = after.mine ? after.mine.likelySeed : null;

    const oddsPayload = {
      before, after: afterOdds,
      lineupDelta: { mine: myLineupDelta, partner: partnerLineupDelta },
      week: currentPeriod
    };
    if (mode === 'simulate') return jsonResponse(oddsPayload);

    // --- verdict: brief AI summary + prediction using all available facts ---
    const standings = (base.race || []).map((t, i) =>
      `${i + 1}. ${t.name} ${t.wins}-${t.losses} · PF ${t.pointsFor} · playoff ${t.playoffPct}% · title ${t.titlePct}%`
    ).join('\n');

    const prompt = `You are the trade analyst for the fantasy team "${mySummary.name}". It is week ${currentPeriod}. Weighted decision model: ${PLAYBOOK_MODEL}

TRADE ON THE TABLE: "${mySummary.name}" gives ${givePlayers.map(playerLine).join(' ; ')} — and receives ${getPlayers.map(playerLine).join(' ; ')} from "${partnerSummary.name}".

MY FULL ROSTER:
${myPlayers.map(playerLine).join('\n')}

THEIR FULL ROSTER:
${partnerPlayers.map(playerLine).join('\n')}

STANDINGS AND SIMULATED ODDS (1,000 season sims):
${standings}

ODDS IMPACT OF THIS TRADE (1,000 season sims with the swapped lineups): my playoff odds ${before.mine.playoffPct}% → ${afterOdds.mine.playoffPct}%, my title odds ${before.mine.titlePct}% → ${afterOdds.mine.titlePct}%; their playoff odds ${before.partner.playoffPct}% → ${afterOdds.partner.playoffPct}%.

Look up the LATEST news, injuries, depth charts, and expert projections for these players and their NFL teams right now. Factor in each skill player's QB situation and their history with their QB (target share, chemistry, recent game logs together).

Return JSON: summary (2-3 sentences citing the numbers and the news), prediction (exactly one of "favor_me", "favor_them", "even"), confidence ("high", "medium", or "low").`;

    const llm = await invokeLlm({
      prompt, model, add_context_from_internet: useWeb,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          prediction: { type: 'string' },
          confidence: { type: 'string' }
        },
        required: ['summary', 'prediction', 'confidence']
      }
    });

    return jsonResponse({
      ...oddsPayload,
      verdict: llm,
      model, webContext: useWeb,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
