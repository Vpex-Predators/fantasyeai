import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseBackend } from "@/lib/backendMode";

const EDGE_FN_NAMES = {
  getDashboardData: "get-dashboard-data",
  lockTeam: "lock-team",
  linkEspnLeague: "link-espn-league",
};

function toEdgeName(functionName) {
  if (EDGE_FN_NAMES[functionName]) return EDGE_FN_NAMES[functionName];
  return functionName
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Drop-in replacement for base44.functions.invoke for migrated handlers.
 */
export async function invokeAppFunction(functionName, body = {}) {
  if (!isSupabaseBackend()) {
    return base44.functions.invoke(functionName, body);
  }
  if (!supabase) {
    throw new Error("Supabase client is not configured (missing VITE_SUPABASE_URL / anon key).");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${toEdgeName(functionName)}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: res.statusText };
  }

  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Request failed");
    err.response = { data, status: res.status };
    throw err;
  }

  return { data };
}