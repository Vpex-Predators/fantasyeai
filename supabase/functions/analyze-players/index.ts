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
import { PLAYBOOK_MODEL } from '../_shared/espnLeague.js';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { user, service, userClient } = authed;

    const body = await req.json();
    const players = Array.isArray(body.players) ? body.players.slice(0, 15) : [];
    if (players.length === 0) return jsonResponse({ error: 'No players provided.' }, { status: 400 });
    const week = Number(body.week) || null;

    // Skip players whose inputs (week, projection, injury, opponent) haven't
    // changed and whose analysis is under a day old — repeated refreshes stay cheap.
    const existingAnalyses = await listPlayerAnalyses(service, user.id);
    const byPlayer = {};
    for (const a of existingAnalyses) byPlayer[String(a.player_id)] = a;
    const inputSignature = p => [week, p.weeklyProj ?? 0, p.injuryStatus || 'ACTIVE', p.opponent || 'TBD'].join('|');
    const freshCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const toAnalyze = players.filter(p => {
      const a = byPlayer[String(p.id)];
      if (!a) return true;
      if (a.input_signature !== inputSignature(p)) return true;
      return !a.analyzed_at || new Date(a.analyzed_at).getTime() < freshCutoff;
    });
    if (toAnalyze.length === 0) return jsonResponse({ players: [], skipped: players.length });

    const lines = toAnalyze.map(p =>
      `${p.name} (${p.position}) — this week vs ${p.opponent || 'TBD'}; projected ${p.weeklyProj ?? 0} pts; season avg ${p.seasonAvg ?? 0}; injury status ${p.injuryStatus || 'ACTIVE'}`
    ).join('\n');

    const prompt = `You are an elite NFL fantasy football analyst. Analyze these fantasy players for week ${week ?? 'this week'} of the NFL season.\n\n${PLAYBOOK_MODEL}\n\nPlayers:\n${lines}\n\nFor each player: use your web search for the LATEST news, injuries, projections, and matchup data, and factor in the player's QB situation and their history with their QB (target share, chemistry, recent games together). Decide the verdict: "Start" (start them in a standard lineup), "Sit" (bench them), "Trade" (shop them while their value is high), or "Hold" (keep, situation unclear). Compute the weighted edge in fantasy points for the recommendation, give the single latest news headline, a 2-3 sentence analysis citing numbers, and 3-4 short factor bullets citing stats.\n\nReturn exactly one entry per input player, matching the input name exactly.`;

    const result = await invokeLlm({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          players: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                verdict: { type: 'string', enum: ['Start', 'Sit', 'Trade', 'Hold'] },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                weighted_edge: { type: 'number' },
                news_headline: { type: 'string' },
                analysis: { type: 'string' },
                factors: { type: 'array', items: { type: 'string' } }
              },
              required: ['name', 'verdict', 'confidence', 'news_headline', 'analysis']
            }
          }
        },
        required: ['players']
      }
    });

    const returned = result && Array.isArray(result.players) ? result.players : [];
    const now = new Date().toISOString();
    const saved = [];

    // Name matching: exact normalized match, with a core-token fallback so D/ST
    // variants like "Pittsburgh Steelers D/ST" resolve to a roster's "Steelers D/ST".
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const core = s => norm(s).replace(/\bd ?st\b|\bdefense\b|\bdef\b/g, ' ').replace(/\s+/g, ' ').trim();
    const nameMatches = (a, b) => {
      if (norm(a) === norm(b)) return true;
      const ca = core(a), cb = core(b);
      return !!ca && !!cb && (ca.endsWith(cb) || cb.endsWith(ca));
    };

    const unmatched = [];
    const claimed = new Set(); // one LLM result per roster player — a twin can never be created twice
    for (const r of returned) {
      const match = toAnalyze.find(p => p.id && !claimed.has(String(p.id)) && nameMatches(p.name, r.name));
      if (!match) {
        if (r && r.name) unmatched.push(r.name);
        continue;
      }
      claimed.add(String(match.id));
      const record = {
        user_id: user.id,
        player_id: String(match.id),
        player_name: match.name,
        verdict: r.verdict || 'Hold',
        confidence: r.confidence || 'low',
        weighted_edge: typeof r.weighted_edge === 'number' ? r.weighted_edge : 0,
        news_headline: r.news_headline || '',
        analysis: r.analysis || '',
        factors: Array.isArray(r.factors) ? r.factors.slice(0, 5) : [],
        analyzed_at: now,
        input_signature: inputSignature(match)
      };
      // Re-check for an existing record NOW (per player) — never trust the pre-loop snapshot.
      const { data: existingList } = await service.from('player_analyses').select('*').eq('user_id', user.id).eq('player_id', record.player_id);
      const freshest = existingList
        .slice()
        .sort((x, y) => new Date(y.analyzed_at || 0) - new Date(x.analyzed_at || 0))[0];
      if (freshest) await service.from('player_analyses').update(record).eq('id', freshest.id);
      else await service.from('player_analyses').insert(record);
      saved.push(record);
    }
    if (unmatched.length) {
      console.warn(`analyzePlayers: LLM returned names matching no roster player: ${unmatched.join(', ')}`);
    }

    return jsonResponse({ players: saved, unmatched });

  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
