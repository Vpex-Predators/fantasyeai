#!/usr/bin/env python3
"""One-off: wrap a Base44 entry.ts handler into a Supabase Edge index.ts skeleton."""
from __future__ import annotations

import argparse
import pathlib
import re

HEADER = '''import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {{
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
  getRefreshState,
  upsertRefreshState,
  listPlayerAnalyses,
  invokeLlm,
  getProfileRole,
  sendContactEmail,
}} from "../_shared/auth.ts";
{extra_imports}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
'''

FOOTER = '''
});
'''


def transform_body(body: str) -> str:
    body = re.sub(
        r"const base44 = createClientFromRequest\(req\);\s*",
        "",
        body,
    )
    body = re.sub(
        r"const user = await base44\.auth\.me\(\);\s*if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);",
        """const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { user, service, userClient } = authed;""",
        body,
        count=1,
    )
    body = body.replace("if (user.role !== 'admin')", "const role = await getProfileRole(service, user.id);\n    if (role !== 'admin')")
    body = body.replace("Response.json(", "jsonResponse(")

    body = re.sub(
        r"await base44\.asServiceRole\.entities\.TeamLock\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\)",
        "await (async () => { const l = await getTeamLock(service, user.id); return l ? [l] : []; })()",
        body,
    )
    body = re.sub(
        r"const locks = await base44\.asServiceRole\.entities\.TeamLock\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\);",
        "const locks = (await getTeamLock(service, user.id)) ? [await getTeamLock(service, user.id)] : [];",
        body,
    )
    body = re.sub(
        r"base44\.asServiceRole\.entities\.RefreshState\.filter\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID \}\)",
        "(await getRefreshState(service, user.id)) ? [await getRefreshState(service, user.id)] : []",
        body,
    )
    body = re.sub(
        r"await base44\.asServiceRole\.integrations\.Core\.InvokeLLM\(",
        "await invokeLlm(",
        body,
    )
    body = re.sub(
        r"await base44\.asServiceRole\.entities\.PlayerAnalysis\.filter\(\{ user_id: user\.id \}\)",
        "await listPlayerAnalyses(service, user.id)",
        body,
    )
    body = re.sub(
        r"await base44\.asServiceRole\.entities\.PlayerAnalysis\.filter\(\{ user_id: user\.id, player_id: record\.player_id \}\)",
        "(await service.from('player_analyses').select('*').eq('user_id', user.id).eq('player_id', record.player_id))",
        body,
    )
    body = re.sub(
        r"const existingList = \(await service\.from\('player_analyses'\).*?\)",
        "const { data: existingList } = await service.from('player_analyses').select('*').eq('user_id', user.id).eq('player_id', record.player_id)",
        body,
        count=1,
    )
    body = body.replace(
        "await base44.asServiceRole.entities.PlayerAnalysis.update(freshest.id, record);",
        "await service.from('player_analyses').update(record).eq('id', freshest.id);",
    )
    body = body.replace(
        "await base44.asServiceRole.entities.PlayerAnalysis.create(record);",
        "await service.from('player_analyses').insert(record);",
    )
    body = re.sub(
        r"if \(state\) await base44\.asServiceRole\.entities\.RefreshState\.update\(state\.id, \{ waiver_cache: waiverCache \}\);\s*else await base44\.asServiceRole\.entities\.RefreshState\.create\(\{ user_id: user\.id, league_id: DEFAULT_LEAGUE_ID, waiver_cache: waiverCache \}\);",
        "await upsertRefreshState(service, user.id, { waiver_cache: waiverCache });",
        body,
    )
    body = re.sub(
        r"await base44\.asServiceRole\.integrations\.Core\.SendEmail\(",
        "await sendContactEmail(",
        body,
    )
    return body


def port(name: str, extra_imports: str, repo: pathlib.Path) -> None:
    src = (repo / "base44" / "functions" / name / "entry.ts").read_text()
    m = re.search(
        r"export default async function\(req\) \{\s*try \{(.*)\} catch \(error\) \{\s*return Response\.json\(\{ error: error\.message",
        src,
        re.S,
    )
    if not m:
        raise SystemExit(f"Could not parse {name}")
    inner = m.group(1)
    inner = transform_body(inner)
    slug = re.sub(r"(?<!^)(?=[A-Z])", "-", name).lower()
    out_dir = repo / "supabase" / "functions" / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.ts").write_text(
        HEADER.format(extra_imports=extra_imports)
        + "  try {"
        + inner
        + "  } catch (error) {\n    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);\n  }\n"
        + FOOTER
    )
    print("wrote", out_dir / "index.ts")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("name")
    p.add_argument("--imports", default="")
    args = p.parse_args()
    port(args.name, args.imports, pathlib.Path(__file__).resolve().parents[1])