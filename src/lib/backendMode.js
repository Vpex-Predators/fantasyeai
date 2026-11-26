/** When true, the SPA calls Supabase Auth + Edge Functions instead of Base44. */
export function isSupabaseBackend() {
  return (
    import.meta.env.VITE_USE_SUPABASE_BACKEND === "true" &&
    Boolean(import.meta.env.VITE_SUPABASE_URL)
  );
}