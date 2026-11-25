# Supabase (FantasyEAi migration)

Target project: **`fantasyeai`** on org `fsztyxsnmyeqmonktvte` (us-west-1). The app still runs on Base44 until later phases.

## After the project exists

1. [Install Supabase CLI](https://supabase.com/docs/guides/cli) and log in.
2. `supabase link --project-ref <ref>` from repo root.
3. Apply migrations: `supabase db push` (or run the SQL in the dashboard).
4. Set Edge Function secrets (`ESPN_S2`, `ESPN_SWID`, LLM keys) in the Supabase dashboard.

## Create project (if not created yet)

**2026-11-25:** Automated create via MCP failed — org hit the **free active project limit** (2). Pause or delete an unused **active** project, or upgrade billing, then create:

- Name: `fantasyeai`
- Region: `us-west-1`
- Organization: `fsztyxsnmyeqmonktvte`

Do **not** reuse `fantasyeai-android-dev` as the primary web database unless you explicitly align schemas.

## Vercel (new project)

Create a **new** Vercel project named `fantasyeai`, import **Vpex-Predators/fantasyeai**, and use root `vercel.json`. Do **not** attach `fantasyeai.com` until cutover is chosen (see project migration plan).