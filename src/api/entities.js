import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseBackend } from "@/lib/backendMode";

/**
 * ESPN league rows saved by the user (Base44 EspnLeague entity shape).
 */
export async function listEspnLeagues(limit = 10) {
  if (!isSupabaseBackend()) {
    return base44.entities.EspnLeague.list("-updated_date", limit);
  }
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("espn_leagues")
    .select("id, league_id, league_name, season, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    league_id: row.league_id,
    league_name: row.league_name,
    season: row.season,
    updated_date: row.updated_at,
  }));
}