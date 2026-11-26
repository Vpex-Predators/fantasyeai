#!/bin/bash
# Mechanical port: copies Base44 handler bodies into Edge wrappers.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
port_one() {
  local name="$1"
  local slug="$2"
  local extra="$3"
  python3 - "$name" "$slug" "$extra" "$ROOT" <<'PY'
import sys, re, pathlib
name, slug, extra, root = sys.argv[1:5]
root = pathlib.Path(root)
src = (root / "base44/functions" / name / "entry.ts").read_text()
# strip leading imports and export wrapper
src = re.sub(r"^import.*?;\n", "", src, flags=re.M)
src = re.sub(r"^export default async function\(req\) \{\n  try \{\n", "", src)
src = re.sub(r"\n  \} catch \(error\) \{\n    return Response\.json\(\{ error: error\.message.*\n  \}\n\}\s*$", "\n", src, flags=re.S)
replacements = [
    (r"const base44 = createClientFromRequest\(req\);\s*", ""),
    (
        r"const user = await base44\.auth\.me\(\);\s*if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);",
        "const authed = await requireUser(req);\n    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);\n    const { user, service, userClient } = authed;",
    ),
    ("Response.json(", "jsonResponse("),
    (
        r"await base44\.asServiceRole\.entities\.TeamLock\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\)",
        "(await getTeamLock(service, user.id)) ? [await getTeamLock(service, user.id)] : []",
    ),
    (
        r"const locks = await base44\.asServiceRole\.entities\.TeamLock\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\);",
        "const lockRow = await getTeamLock(service, user.id);\n    const locks = lockRow ? [lockRow] : [];",
    ),
    (
        r"base44\.asServiceRole\.entities\.RefreshState\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\)",
        "(await getRefreshState(service, user.id)) ? [await getRefreshState(service, user.id)] : []",
    ),
    (
        r"\[states\] = await Promise\.all\(\[\s*base44\.asServiceRole\.entities\.TeamLock\.filter.*?\),\s*base44\.asServiceRole\.entities\.RefreshState\.filter.*?\)\s*\]\)",
        "[lockRow, stateRow] = await Promise.all([getTeamLock(service, user.id), getRefreshState(service, user.id)]);\n    const locks = lockRow ? [lockRow] : [];\n    const states = stateRow ? [stateRow] : []",
    ),
    (
        r"await base44\.asServiceRole\.integrations\.Core\.InvokeLLM\(",
        "await invokeLlm(",
    ),
    (
        r"await base44\.asServiceRole\.entities\.PlayerAnalysis\.filter\(\{ user_id: user\.id \}\)",
        "await listPlayerAnalyses(service, user.id)",
    ),
    (
        r"await base44\.asServiceRole\.entities\.PlayerAnalysis\.update\(freshest\.id, record\);",
        "await service.from('player_analyses').update(record).eq('id', freshest.id);",
    ),
    (
        r"await base44\.asServiceRole\.entities\.PlayerAnalysis\.create\(record\);",
        "await service.from('player_analyses').insert(record);",
    ),
    (
        r"const existingList = await base44\.asServiceRole\.entities\.PlayerAnalysis\.filter\(\{ user_id: user\.id, player_id: record\.player_id \}\);",
        "const { data: existingList } = await service.from('player_analyses').select('*').eq('user_id', user.id).eq('player_id', record.player_id);",
    ),
    (
        r"if \(state\) await base44\.asServiceRole\.entities\.RefreshState\.update\(state\.id, \{ waiver_cache: waiverCache \}\);\s*else await base44\.asServiceRole\.entities\.RefreshState\.create\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID, waiver_cache: waiverCache \}\);",
        "await upsertRefreshState(service, user.id, { waiver_cache: waiverCache });",
    ),
    (
        r"if \(states\[0\]\) await base44\.asServiceRole\.entities\.RefreshState\.update\(states\[0\]\.id, \{ playoff_cache \}\);\s*else await base44\.asServiceRole\.entities\.RefreshState\.create\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID, playoff_cache \}\);",
        "await upsertRefreshState(service, user.id, { playoff_cache });",
    ),
    (
        r"const existing = await base44\.entities\.EspnLeague\.filter\(\{ league_id: leagueId, created_by_id: user\.id \}\);",
        "const { data: existing } = await userClient.from('espn_leagues').select('id').eq('user_id', user.id).eq('league_id', leagueId).maybeSingle()",
    ),
]
for pat, rep in replacements:
    src = re.sub(pat, rep, src, flags=re.S)
header = f'''import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
out = root / "supabase/functions" / slug / "index.ts"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(header + src + footer)
print("wrote", out)
PY
}

port_one getWaiverTargets get-waiver-targets "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, fetchFreeAgents, parseTeamRoster, leaguePeriods, INJURY_LABELS, realPos } from '../_shared/espnLeague.js';"
port_one analyzeMatchup analyze-matchup "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseRosterPlayer, PLAYBOOK_MODEL, round1 } from '../_shared/espnLeague.js';"
port_one analyzePlayers analyze-players "import { PLAYBOOK_MODEL } from '../_shared/espnLeague.js';"
port_one getAnalystSuggestions get-analyst-suggestions "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, leaguePeriods, parseTeamRoster, parseTeamSummary } from '../_shared/espnLeague.js';"
port_one analyzeScreenshot analyze-screenshot ""
port_one analyzeBriefing analyze-briefing "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseTeamRoster, leaguePeriods } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';"
port_one generatePowerRankings generate-power-rankings "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';"
port_one tradeIntel trade-intel "import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent, parseTeamSummary, parseTeamRoster, leaguePeriods, round1, PLAYBOOK_MODEL } from '../_shared/espnLeague.js';\nimport { computePlayoffOdds } from '../_shared/playoffAndPulse.js';"