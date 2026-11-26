import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = Boolean(body && body.dryRun);
    } catch {
      dryRun = false;
    }

    if (dryRun) {
      return jsonResponse({
        dryRun: true,
        user: { id: user.id, email: user.email },
        wouldWipe: ["player_analyses", "refresh_states", "team_locks", "espn_leagues"],
      });
    }

    await service.from("player_analyses").delete().eq("user_id", user.id);
    await service.from("refresh_states").delete().eq("user_id", user.id);
    await service.from("team_locks").delete().eq("user_id", user.id);
    await service.from("espn_leagues").delete().eq("user_id", user.id);
    await service.from("profiles").delete().eq("id", user.id);

    const { error: delAuthError } = await service.auth.admin.deleteUser(user.id);
    if (delAuthError) {
      return jsonResponse({
        ok: true,
        wiped: ["player_analyses", "refresh_states", "team_locks", "espn_leagues"],
        userRecordDeleted: false,
        authDeleteError: delAuthError.message,
      });
    }

    return jsonResponse({
      ok: true,
      wiped: ["player_analyses", "refresh_states", "team_locks", "espn_leagues"],
      userRecordDeleted: true,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Account deletion failed." },
      500,
    );
  }
});