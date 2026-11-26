import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  fetchLeague,
  fetchLeagueCurrent,
  parseTeamSummary,
} from "../_shared/espnLeague.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, userClient } = authed;

    const body = await req.json();
    const leagueId = String(body.league_id || "").trim();
    if (!/^\d{1,10}$/.test(leagueId)) {
      return jsonResponse({ error: "Enter a valid ESPN league ID (numbers only)." }, 400);
    }

    const views = ["mSettings", "mTeam"];
    let league;
    let season: number;
    if (body.season) {
      season = Number(body.season);
      league = await fetchLeague(season, leagueId, views);
    } else {
      ({ league, season } = await fetchLeagueCurrent(views, leagueId));
    }

    const leagueName = (league.settings && league.settings.name) || "ESPN League";
    const teams = (league.teams || [])
      .map(parseTeamSummary)
      .map((t) => ({ id: t.id, name: t.name }));
    if (teams.length === 0) {
      return jsonResponse(
        {
          error:
            "ESPN responded, but the league data was empty. Verify the league ID and that the stored cookies are still valid.",
        },
        400,
      );
    }

    const { data: existing } = await userClient
      .from("espn_leagues")
      .select("id")
      .eq("user_id", user.id)
      .eq("league_id", leagueId)
      .maybeSingle();

    const record = {
      user_id: user.id,
      league_id: leagueId,
      season,
      league_name: leagueName,
    };

    if (existing?.id) {
      const { error } = await userClient.from("espn_leagues").update(record).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await userClient.from("espn_leagues").insert(record);
      if (error) throw error;
    }

    return jsonResponse({ league: { id: leagueId, name: leagueName, season }, teams });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error && error.status === 404 ? 400 : 500;
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, status);
  }
});