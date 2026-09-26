import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DEFAULT_LEAGUE_ID, fetchLeagueCurrent, fetchFreeAgents,
  parseTeamRoster, leaguePeriods
} from '../../shared/espnLeague.js';
import { hasPositionalBackup, rosterPosition } from '../../shared/lineupNeeds.js';

const INJURY_LABELS = { QUESTIONABLE: 'questionable', OUT: 'out', INJURY_RESERVE: 'on IR', SUSPENSION: 'suspended' };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const { league, season } = await fetchLeagueCurrent(['mNav', 'mTeam', 'mRoster']);
    const { currentPeriod } = leaguePeriods(league);

    const [locks, states] = await Promise.all([
      base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID }),
      base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })
    ]);
    const lock = locks[0];
    if (!lock) return Response.json({ error: 'Lock your team on the dashboard first.' }, { status: 400 });
    const state = states[0] || null;

    // Per-week cache: serve last week's-in-progress scan instantly; only a new
    // week or an explicit re-scan triggers a fresh (AI) wire scan.
    const cache = state && state.waiver_cache ? state.waiver_cache : null;
    if (!force && cache && cache.week === currentPeriod && cache.rulesVersion === 3 && Array.isArray(cache.targets)) {
      const cachedTargets = cache.targets.map(target => {
        const isHigh = target.priority === 'high';
        const canRecommendDrop = isHigh && ['overlooked', 'fills_weak_spot'].includes(target.category);
        const dropSuggestion = canRecommendDrop ? (target.drop_suggestion || '') : '';
        return {
          ...target,
          drop_suggestion: dropSuggestion,
          no_drop_reason: isHigh && !dropSuggestion
            ? (target.no_drop_reason || 'This add would not benefit this roster.')
            : ''
        };
      });
      return Response.json({
        week: currentPeriod,
        weaknesses: cache.weaknesses || [],
        targets: cachedTargets,
        cached: true,
        scanned_at: cache.scanned_at
      });
    }

    const myRaw = (league.teams || []).find(t => String(t.id) === String(lock.team_id));
    if (!myRaw) return Response.json({ error: 'Your locked team is no longer in the league.' }, { status: 400 });

    const roster = parseTeamRoster(myRaw, currentPeriod);
    const starters = roster.filter(p => p.isStarter);
    const benchPlayers = roster.filter(p => !p.isStarter);

    // Positional weaknesses, stated in plain English for the analyst prompt.
    const weaknesses = [];
    for (const s of starters) {
      const inj = INJURY_LABELS[s.injuryStatus];
      const pos = rosterPosition(s);
      if (inj) {
        weaknesses.push(`${s.name} (${pos}) is ${inj} this week, projected ${s.weeklyProj} pts`);
        if (!hasPositionalBackup(s, benchPlayers)) {
          weaknesses.push(`There is no backup ${pos} on the bench if ${s.name} sits`);
        }
      } else if (s.weeklyProj <= 4 && s.seasonAvg <= 4) {
        weaknesses.push(`${s.name} (${pos}) is a weak starter — projected just ${s.weeklyProj} pts this week (season avg ${s.seasonAvg})`);
      }
    }
    if (!weaknesses.length) weaknesses.push('No obvious holes — starters are healthy and producing');

    // Broad wire pool: top weekly producers plus rest-of-season producers.
    const pool = await fetchFreeAgents(season, DEFAULT_LEAGUE_ID, currentPeriod, 200);
    const byWeekly = pool.slice().sort((a, b) => (b.weeklyProj - a.weeklyProj) || (b.seasonProj - a.seasonProj)).slice(0, 60);
    const bySeason = pool.slice().sort((a, b) => b.seasonProj - a.seasonProj).slice(0, 20);
    const wire = Array.from(new Map([...byWeekly, ...bySeason].map(p => [p.id, p])).values())
      .map(p => `${p.name} (${p.position}) — proj ${p.weeklyProj} pts this week, ${p.seasonProj} rest of season, owned in ${p.percentOwned}% of leagues${INJURY_LABELS[p.injuryStatus] ? `, ${INJURY_LABELS[p.injuryStatus]}` : ''}`)
      .join('\n');

    const rosterText = starters.map(s => `${s.name} (${rosterPosition(s)}) — proj ${s.weeklyProj} pts${INJURY_LABELS[s.injuryStatus] ? `, ${INJURY_LABELS[s.injuryStatus]}` : ''}`).join('\n');
    const benchText = benchPlayers.map(b => `${b.name} (${rosterPosition(b)}) — proj ${b.weeklyProj} pts, season avg ${b.seasonAvg}`).join('\n') || 'Empty bench';

    const prompt = `You are the waiver-wire scout for a fantasy football team. It is week ${currentPeriod} of the NFL season (year ${season}).

THE TEAM'S STARTERS:
${rosterText}

THE TEAM'S BENCH:
${benchText}

THE TEAM'S WEAKNESSES:
${weaknesses.map(w => '- ' + w).join('\n')}

PLAYERS AVAILABLE ON THE WIRE (only these can be picked up):
${wire}

Pick the TOP 5 waiver targets for THIS exact team. Priorities, in order:
1. Players who fill the team's weak or injured spots (matching the weaknesses above).
2. Overlooked gems — players owned in under 30% of leagues who are about to get a real role or opportunity (new depth-chart openings, recent usage trends).
3. Handcuffs — backups whose starter is hurt or suspended and who will take over if the starter sits out.
4. Players with a big week-specific matchup only if none of the above apply.

Rules:
- ONLY pick players from the wire list above (match names exactly).
- Use web search to check each pick's LATEST news, injury reports, depth-chart moves and projections from the past few days — never guess.
- Write for a casual fan in plain, everyday English. No fantasy jargon; if you must use a term, explain it in a few words.
- Keep every sentence short. why_brief is ONE sentence about how he helps THIS team right now.
- news_note should say what is NEW (fresh injury news, role change, projection move) or be empty.
- For a high-priority pick only: recommend one exact bench player to drop only when the target is an overlooked player with a verified role increase or fills an absolute roster need and clearly improves this roster. Put that exact roster name in drop_suggestion.
- If a high-priority pick does not justify replacing anyone, leave drop_suggestion empty and state either "No bench player is worth replacing for this add." or "This add would not benefit this roster." in no_drop_reason.
- Medium- and low-priority picks must have empty drop_suggestion and no_drop_reason.
- Never name a starter as the drop. Never invent a player; use an exact name from THE TEAM'S BENCH.
- For each pick give the single best source (site name + URL) for the news you cited.

Return JSON matching the schema.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          targets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                position: { type: 'string' },
                category: { type: 'string', enum: ['fills_weak_spot', 'handcuff', 'overlooked', 'streamer'] },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                why_brief: { type: 'string' },
                news_note: { type: 'string' },
                drop_suggestion: { type: 'string' },
                no_drop_reason: { type: 'string' },
                source: { type: 'string' },
                source_url: { type: 'string' }
              },
              required: ['name', 'position', 'category', 'priority', 'why_brief']
            }
          }
        },
        required: ['targets']
      }
    });
    const parsed = typeof llm === 'string' ? JSON.parse(llm) : llm;
    const benchNames = new Set(benchPlayers.map(p => p.name));
    const targets = Array.isArray(parsed && parsed.targets) ? parsed.targets.slice(0, 5).map(target => {
      const isHigh = target.priority === 'high';
      const canRecommendDrop = isHigh && ['overlooked', 'fills_weak_spot'].includes(target.category);
      const validDrop = canRecommendDrop && benchNames.has(target.drop_suggestion);
      return {
        ...target,
        drop_suggestion: validDrop ? target.drop_suggestion : '',
        no_drop_reason: isHigh && !validDrop
          ? (target.no_drop_reason === 'No bench player is worth replacing for this add.'
            ? target.no_drop_reason
            : 'This add would not benefit this roster.')
          : ''
      };
    }) : [];

    // Save the scan for the rest of the week (best effort — never block the result).
    const waiverCache = { week: currentPeriod, rulesVersion: 3, weaknesses, targets, scanned_at: new Date().toISOString() };
    try {
      if (state) await base44.asServiceRole.entities.RefreshState.update(state.id, { waiver_cache: waiverCache });
      else await base44.asServiceRole.entities.RefreshState.create({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID, waiver_cache: waiverCache });
    } catch (e) { /* cache persistence unavailable — skip */ }

    return Response.json({ week: currentPeriod, weaknesses, targets, cached: false, scanned_at: waiverCache.scanned_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}