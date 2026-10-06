import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { DEFAULT_LEAGUE_ID } from '../../shared/espnLeague.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = body && body.keys;
    const keys = (Array.isArray(raw) ? raw : raw != null ? [raw] : []).slice(0, 50).map(k => String(k)).filter(Boolean);
    if (keys.length === 0) return Response.json({ error: 'No update keys provided.' }, { status: 400 });

    const states = await base44.asServiceRole.entities.RefreshState.filter({ user_id: user.id, league_id: DEFAULT_LEAGUE_ID });
    if (states.length === 0) return Response.json({ pending: [] });

    const state = states[0];
    const pending = (Array.isArray(state.pending) ? state.pending : []).filter(k => !keys.includes(k));
    await base44.asServiceRole.entities.RefreshState.update(state.id, { pending });

    return Response.json({ pending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}