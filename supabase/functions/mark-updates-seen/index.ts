import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  requireUser,
  corsHeaders,
  jsonResponse,
  getRefreshState,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authed = await requireUser(req);
    if (!authed) return jsonResponse({ error: "Unauthorized" }, 401);
    const { user, service } = authed;

    const body = await req.json().catch(() => ({}));
    const raw = body && body.keys;
    const keys = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .slice(0, 50)
      .map((k) => String(k))
      .filter(Boolean);
    if (keys.length === 0) {
      return jsonResponse({ error: "No update keys provided." }, 400);
    }

    const state = await getRefreshState(service, user.id);
    if (!state) return jsonResponse({ pending: [] });

    const pending = (Array.isArray(state.pending) ? state.pending : []).filter(
      (k: string) => !keys.includes(k),
    );
    await service.from("refresh_states").update({ pending }).eq("id", state.id);

    return jsonResponse({ pending });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});