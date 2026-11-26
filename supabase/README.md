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
4. Edge Function secrets (Dashboard → Edge Functions → Secrets):

| Secret | Purpose |
| --- | --- |
| `ESPN_S2`, `ESPN_SWID` | **Required** for private ESPN league fetches (same cookies as Base44 runtime) |
| `LLM_API_KEY` or `OPENAI_API_KEY` | LLM routes (`invokeLlm`); optional `LLM_BASE_URL`, `LLM_MODEL` |
| `RESEND_API_KEY`, `CONTACT_ADMIN_EMAIL` | Contact form; optional `CONTACT_FROM_EMAIL` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Usually auto-injected on hosted Edge; set if DB/auth helpers fail |

### Edge Functions (Phase 3) — deployed on `ddvdmbvwqchfhzhimovv`

| Slug | Base44 name | JWT |
| --- | --- | --- |
| `get-dashboard-data` | `getDashboardData` | yes |
| `lock-team` | `lockTeam` | yes |
| `link-espn-league` | `linkEspnLeague` | yes |
| `get-war-room-data` | `getWarRoomData` | yes |
| `get-live-scores` | `getLiveScores` | yes |
| `get-waiver-targets` | `getWaiverTargets` | yes |
| `mark-updates-seen` | `markUpdatesSeen` | yes |
| `admin-team-locks` | `adminTeamLocks` | yes |
| `delete-my-account` | `deleteMyAccount` | yes |
| `send-contact-message` | `sendContactMessage` | no (public) |
| `analyze-briefing` | `analyzeBriefing` | yes |
| `analyze-matchup` | `analyzeMatchup` | yes |
| `analyze-players` | `analyzePlayers` | yes |
| `analyze-screenshot` | `analyzeScreenshot` | yes |
| `generate-power-rankings` | `generatePowerRankings` | yes |
| `get-analyst-suggestions` | `getAnalystSuggestions` | yes |
| `trade-intel` | `tradeIntel` | yes |
| `trade-analyst-chat` | `tradeAnalystChat` | yes |

Shared modules: `supabase/functions/_shared/espnLeague.js`, `auth.ts`, `playoffAndPulse.js` (bundled into deploys; MCP limit is 4 files per deploy).

## Frontend feature flag

Set `VITE_USE_SUPABASE_BACKEND=true` on Vercel **preview** (and later production) to route `invokeAppFunction` + Supabase Auth instead of Base44. Default / unset keeps Base44 for `fantasyeai.com` until cutover.

## Vercel

New project **`fantasyeai`** (`Vpex-Predators/fantasyeai`). Public env vars `VITE_SUPABASE_*` are set on Vercel. Add **`VITE_USE_SUPABASE_BACKEND=true`** on preview to exercise the new stack. Do **not** attach `fantasyeai.com` until parallel cutover (Option A) checklist is done.