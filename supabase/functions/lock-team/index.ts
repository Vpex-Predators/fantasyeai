import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { DEFAULT_LEAGUE_ID, fetchLeagueCurrent } from "../_shared/espnLeague.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    const body = await req.json();
    const teamId = String(body.team_id || "").trim();
    const espnEmail = String(body.espn_email || "").trim();
    const birthday = String(body.birthday || "").trim();

    if (!teamId) return jsonResponse({ error: "Pick a team first." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(espnEmail)) {
      return jsonResponse({ error: "Enter the ESPN email you use for this league." }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return jsonResponse({ error: "Enter your birthday (YYYY-MM-DD)." }, 400);
    }

    const { data: existing } = await service
      .from("team_locks")
      .select("id")
      .eq("user_id", user.id)
      .eq("league_id", DEFAULT_LEAGUE_ID)
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        {
          error:
            "Your team is already locked — one pick per account. Ask the admin if it needs fixing.",
        },
        409,
      );
    }

    const { league } = await fetchLeagueCurrent(["mTeam"]);
    const rawTeam = (league.teams || []).find((t: { id: number }) => String(t.id) === teamId);
    if (!rawTeam) return jsonResponse({ error: "That team is not in this league." }, 400);
    const teamName =
      [rawTeam.location, rawTeam.nickname].filter(Boolean).join(" ") ||
      rawTeam.name ||
      `Team ${teamId}`;

    const { error: insertError } = await service.from("team_locks").insert({
      user_id: user.id,
      league_id: DEFAULT_LEAGUE_ID,
      team_id: teamId,
      team_name: teamName,
      espn_email: espnEmail,
      birthday,
    });
    if (insertError) throw insertError;

    return jsonResponse({ lock: { team_id: teamId, team_name: teamName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});