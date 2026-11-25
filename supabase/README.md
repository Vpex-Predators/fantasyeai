# Supabase (FantasyEAi migration)

Live project on org `fsztyxsnmyeqmonktvte` (us-west-1). The app still runs on Base44 until later migration phases.

## Project

| Field | Value |
| --- | --- |
| Name | `fantasyeai` |
| Ref | `ddvdmbvwqchfhzhimovv` |
| API URL | `https://ddvdmbvwqchfhzhimovv.supabase.co` |
| Migration | `init_fantasyeai_schema` (applied) |

**Org limit policy:** `nails-by-miriam` must remain **active** (do not pause for FantasyEAi). If another slot is needed, pause **`polishpage`** instead — or upgrade the Supabase org plan.

## Local CLI

1. [Install Supabase CLI](https://supabase.com/docs/guides/cli) and log in.
2. `supabase link --project-ref ddvmbvwqchfhzhimovv`
3. For new migrations: `supabase db push`
4. Edge Function secrets: `ESPN_S2`, `ESPN_SWID`, LLM keys (dashboard or CLI).

## Vercel

New project **`fantasyeai`** (`Vpex-Predators/fantasyeai`). Public env vars `VITE_SUPABASE_*` are set on Vercel. Do **not** attach `fantasyeai.com` until parallel cutover (Option A) checklist is done.