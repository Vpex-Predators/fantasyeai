#!/usr/bin/env python3
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]

FUNCS = {
    "getWaiverTargets": (
        "get-waiver-targets",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, fetchFreeAgents, parseTeamRoster, leaguePeriods, INJURY_LABELS, realPos } from '../_shared/espnLeague.js';",
    ),
    "analyzeMatchup": (
        "analyze-matchup",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseRosterPlayer, PLAYBOOK_MODEL, round1 } from '../_shared/espnLeague.js';",
    ),
    "analyzePlayers": (
        "analyze-players",
        "import { PLAYBOOK_MODEL } from '../_shared/espnLeague.js';",
    ),
    "getAnalystSuggestions": (
        "get-analyst-suggestions",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, leaguePeriods, parseTeamRoster, parseTeamSummary } from '../_shared/espnLeague.js';",
    ),
    "analyzeScreenshot": ("analyze-screenshot", ""),
    "analyzeBriefing": (
        "analyze-briefing",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseTeamRoster, leaguePeriods } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';",
    ),
    "generatePowerRankings": (
        "generate-power-rankings",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';",
    ),
    "tradeIntel": (
        "trade-intel",
        "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseTeamRoster, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';",
    ),
}


def extract_body(src: str) -> str:
    start = src.find("export default async function")
    if start < 0:
        raise ValueError("no export")
    src = src[start:]
    src = re.sub(r"^export default async function\(req\) \{\s*try \{\n", "", src)
    src = re.sub(r"\n  \} catch \(error\) \{[\s\S]*\}\s*\}\s*$", "\n", src)
    return src


def transform(body: str) -> str:
    subs = [
        ("const base44 = createClientFromRequest(req);\n    ", ""),
        (
            "const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
            "const authed = await requireUser(req);\n    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);\n    const { user, service, userClient } = authed;",
        ),
        ("Response.json(", "jsonResponse("),
        (
            "const locks = await base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID });",
            "const lockRow = await getTeamLock(service, user.id);\n    const locks = lockRow ? [lockRow] : [];",
        ),
        (
            "await base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })",
            "(await getTeamLock(service, user.id)) ? [await getTeamLock(service, user.id)] : []",
        ),
        (
            "base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })",
            "(() => { const s = getRefreshState(service, user.id); return s; })()",
        ),
        (
            "await base44.asServiceRole.integrations.Core.InvokeLLM(",
            "await invokeLlm(",
        ),
        (
            "await base44.asServiceRole.entities.PlayerAnalysis.filter({ user_id: user.id })",
            "await listPlayerAnalyses(service, user.id)",
        ),
        (
            "const existingList = await base44.asServiceRole.entities.PlayerAnalysis.filter({ user_id: user.id, player_id: record.player_id });",
            "const { data: existingList } = await service.from('player_analyses').select('*').eq('user_id', user.id).eq('player_id', record.player_id);",
        ),
        (
            "await base44.asServiceRole.entities.PlayerAnalysis.update(freshest.id, record);",
            "await service.from('player_analyses').update(record).eq('id', freshest.id);",
        ),
        (
            "await base44.asServiceRole.entities.PlayerAnalysis.create(record);",
            "await service.from('player_analyses').insert(record);",
        ),
    ]
    for a, b in subs:
        body = body.replace(a, b)

  # Promise.all locks/states in getWaiverTargets & getLiveScores style
    old_pa = """    const [locks, states] = await Promise.all([
      base44.asServiceRole.entities.TeamLock.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID }),
      base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID })
    ]);"""
    new_pa = """    const [lockRow, stateRow] = await Promise.all([
      getTeamLock(service, user.id),
      getRefreshState(service, user.id),
    ]);
    const locks = lockRow ? [lockRow] : [];
    const states = stateRow ? [stateRow] : [];"""
    body = body.replace(old_pa, new_pa)

    old_waiver_save = """    try {
      if (state) await base44.asServiceRole.entities.RefreshState.update(state.id, { waiver_cache: waiverCache });
      else await base44.asServiceRole.entities.RefreshState.create({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID, waiver_cache: waiverCache });
    } catch (e) { /* cache persistence unavailable — skip */ }"""
    body = body.replace(
        old_waiver_save,
        """    try {
      await upsertRefreshState(service, user.id, { waiver_cache: waiverCache });
    } catch (e) { /* cache persistence unavailable — skip */ }""",
    )

    body = body.replace(
        "const existingAnalyses = await base44.asServiceRole.entities.PlayerAnalysis.filter({ user_id: user.id });",
        "const existingAnalyses = await listPlayerAnalyses(service, user.id);",
    )

    return body


def main() -> None:
    header_tpl = '''import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {{
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
  getRefreshState,
  upsertRefreshState,
  listPlayerAnalyses,
  invokeLlm,
}} from "../_shared/auth.ts";
{extra}

Deno.serve(async (req) => {{
  if (req.method === "OPTIONS") return new Response(null, {{ headers: corsHeaders }});
  try {{
'''
    footer = '''
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
'''
    for name, (slug, extra) in FUNCS.items():
        src = (ROOT / "base44/functions" / name / "entry.ts").read_text()
        body = transform(extract_body(src))
        out = ROOT / "supabase/functions" / slug / "index.ts"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(header_tpl.format(extra=extra) + body + footer)
        print("wrote", slug)


if __name__ == "__main__":
    main()