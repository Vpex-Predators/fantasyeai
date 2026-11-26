import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getTeamLock,
  listPlayerAnalyses,
  invokeLlmChat,
} from "../_shared/auth.ts";
import {
  fetchLeagueCurrent,
  leaguePeriods,
  parseTeamRoster,
  parseTeamSummary,
  PLAYBOOK_MODEL,
} from "../_shared/espnLeague.js";

const TRADE_ANALYST_SYSTEM = `You are Trade Analyst, a friendly NFL fantasy football analyst. The user asks you about trades, waiver wire adds, and bench vs. start decisions. Talk like a knowledgeable friend explaining fantasy football to someone brand new to it — warm, plain, everyday English. No jargon or unexplained acronyms — if you use a term like 'handcuff', 'streaming', 'PPR', 'ROS', 'D/ST', or 'FLX', define it briefly in parentheses the first time you use it in that reply. Keep every answer SHORT.

Incorporate the latest NFL context you know for players involved: injury reports, role changes, and projections. Never rely on stale assumptions about rosters or roles.

REPLY FORMAT — follow it exactly, every time:
1. Start with 'The short answer:' — 2 to 4 sentences max. Give the verdict and the ONE key number. Lead with whatever is NEW (fresh injury news, a projection that just moved, a role change). No tables and no math in this part — it must stand alone and be instantly understandable.
2. Then a '### Sources' heading — a short bullet list of sources you relied on (news outlets, injury reports, projection sites). 2-5 bullets max. If you cannot cite a real URL, name the source in plain text instead of inventing links.
3. Then a '### The numbers' heading — the full quantitative breakdown for readers who want to dig in: the weighted edge model (Projections 30% + Matchup 25% + Injury risk 20% + Recent form last 3 games 15% + Schedule strength 10%), rest-of-season and week-by-week projections with floor/ceiling, positional ranks, and side-by-side weighted edges for start/sit calls. Tables are welcome here. Also factor each player's QB situation and his history with his QB (target share, chemistry, recent game logs together).

The app shows the user only the short answer first — the Sources and The numbers sections sit behind expandable tabs. So the short answer must be complete on its own.

CALL TYPES:
- TRADES: plain verdict (take it / counter / pass), whether it favors the user, and one fair counter-offer if it doesn't.
- WAIVERS: rank the adds by value for THEIR roster and whether each is worth the FAAB/waiver budget given their positional need.
- BENCH vs START: say who to start, with one clear reason.

Confidence flag on every call (show it in The numbers): HIGH if the weighted edge is greater than 15 points, MEDIUM if greater than 5 points, LOW otherwise, with the numbers behind it.

Weighted decision model: ${PLAYBOOK_MODEL}`;

type ChatMsg = { role: "user" | "assistant"; content: string };

function sanitizeMessages(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMsg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = (item as { content?: string }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed.slice(0, 12000) });
  }
  return out.slice(-40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const messages = sanitizeMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return jsonResponse(
        { error: "Send a non-empty messages array ending with a user message." },
        400,
      );
    }

    const lock = await getTeamLock(service, user.id);
    if (!lock) {
      return jsonResponse(
        { error: "Lock your team on the dashboard first, then chat with the analyst." },
        400,
      );
    }

    const { league } = await fetchLeagueCurrent(["mTeam", "mRoster"]);
    const { currentPeriod } = leaguePeriods(league);
    const rawTeams = league.teams || [];
    const mySummary = rawTeams.map(parseTeamSummary).find((t) => t.id === String(lock.team_id));
    const myRaw = rawTeams.find((t) => String(t.id) === String(lock.team_id));
    if (!mySummary || !myRaw) {
      return jsonResponse({ error: "Could not load your ESPN team from the linked league." }, 400);
    }

    const roster = parseTeamRoster(myRaw, currentPeriod);
    const starters = roster.filter((p) => p.isStarter);
    const bench = roster.filter((p) => !p.isStarter).slice(0, 8);
    const rosterFacts = [
      ...starters.map(
        (p) =>
          `${p.name} (${p.position}, proj ${p.weeklyProj}, season avg ${p.seasonAvg}, ${p.injuryStatus})`,
      ),
      ...bench.map((p) => `[bench] ${p.name} (${p.position}, proj ${p.weeklyProj}, ${p.injuryStatus})`),
    ].join("; ");

    const analyses = await listPlayerAnalyses(service, user.id);
    const verdicts = analyses
      .slice(-12)
      .map(
        (a) =>
          `${a.player_name}: ${a.verdict}${a.weighted_edge != null ? ` (edge ${a.weighted_edge})` : ""}`,
      )
      .join("; ");

    const contextBlock = `USER TEAM CONTEXT (authoritative for this chat):
Team: "${mySummary.name}" (${mySummary.wins}-${mySummary.losses}), fantasy week ${currentPeriod}, ESPN team id ${lock.team_id}.
Roster: ${rosterFacts}.
${verdicts ? `Recent AI verdicts on this roster: ${verdicts}.` : ""}
Answer only for this manager and this roster unless they ask about another team by name.`;

    const system = `${TRADE_ANALYST_SYSTEM}\n\n${contextBlock}`;
    const model = typeof body.model === "string" ? body.model : "automatic";

    const content = await invokeLlmChat({
      system,
      messages,
      model,
      add_context_from_internet: true,
    });

    return jsonResponse({ content, role: "assistant" });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});