import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getProfileRole,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;
    const role = await getProfileRole(service, user.id);
    if (role !== "admin") return jsonResponse({ error: "Admins only." }, 403);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data: locks, error } = await service.from("team_locks").select("*");
      if (error) throw error;
      const emailById: Record<string, string> = {};
      for (const l of locks || []) {
        if (emailById[l.user_id]) continue;
        try {
          const { data: authUser } = await service.auth.admin.getUserById(l.user_id);
          emailById[l.user_id] = authUser.user?.email || l.user_id;
        } catch {
          emailById[l.user_id] = l.user_id;
        }
      }
      return jsonResponse({
        locks: (locks || []).map((l) => ({
          id: l.id,
          user_id: l.user_id,
          email: emailById[l.user_id] || l.user_id,
          league_id: l.league_id,
          team_id: l.team_id,
          team_name: l.team_name,
          espn_email: l.espn_email,
          birthday: l.birthday,
        })),
      });
    }

    if (action === "update") {
      const lockId = String(body.lock_id || "");
      if (!lockId) return jsonResponse({ error: "Missing lock id." }, 400);
      const updates: Record<string, string> = {};
      if (body.team_id !== undefined) {
        updates.team_id = String(body.team_id);
        updates.team_name = String(body.team_name || "");
      }
      if (body.espn_email !== undefined) updates.espn_email = String(body.espn_email);
      if (body.birthday !== undefined) updates.birthday = String(body.birthday);
      await service.from("team_locks").update(updates).eq("id", lockId);
      return jsonResponse({ ok: true });
    }

    if (action === "delete") {
      const lockId = String(body.lock_id || "");
      if (!lockId) return jsonResponse({ error: "Missing lock id." }, 400);
      await service.from("team_locks").delete().eq("id", lockId);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action." }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});