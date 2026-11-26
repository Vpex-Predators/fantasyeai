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
4. Edge Function secrets (project settings → Edge Functions): `ESPN_S2`, `ESPN_SWID`, plus `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-set on hosted runtime when possible; set explicitly if ESPN calls fail auth).

### Edge Functions (Phase 3)

| Slug | Base44 name | Status |
| --- | --- | --- |
| `get-dashboard-data` | `getDashboardData` | Deployed |
| `lock-team` | `lockTeam` | Deployed |
| `link-espn-league` | `linkEspnLeague` | Deployed |

## Frontend feature flag

Set `VITE_USE_SUPABASE_BACKEND=true` on Vercel **preview** (and later production) to route `invokeAppFunction` + Supabase Auth instead of Base44. Default / unset keeps Base44 for `fantasyeai.com` until cutover.

## Vercel

New project **`fantasyeai`** (`Vpex-Predators/fantasyeai`). Public env vars `VITE_SUPABASE_*` are set on Vercel. Add **`VITE_USE_SUPABASE_BACKEND=true`** on preview to exercise the new stack. Do **not** attach `fantasyeai.com` until parallel cutover (Option A) checklist is done.