# FantasyEAi — independent Google sign-in & multi-league release gates

## Verified as of October 24, 2026

- Feature branch: `feature/multi-league-auth-android-20261024`
- Ricky's Vercel project: `fantasyeai-independent-preview`
- Cloudflare Worker: `fantasyeai-league-hub`
- Cloudflare D1: `fantasyeai-league-hub` (account-owned, unrelated to Nails by Miriam)
- Worker health: `https://fantasyeai-league-hub.ea-vnonymous.workers.dev/health`
- Unauthenticated request to `/v1/leagues`: 401, verified
- Android debug APK: GitHub Actions, workflow `android-apk.yml`; no signing or Play Store guarantee

## Why Google sign-in did not work on Vercel

The cloned web app used Base44's OAuth redirect for a Base44-hosted domain.
Deploying React to a new Vercel hostname did not move the original OAuth client,
allowed redirect URIs, or Base44 session handling.

The new account hub uses **Google Identity Services** in a web browser and
verifies the returned Google ID token server-side against an exact OAuth client
ID before performing owner-scoped database reads or writes.

**It is intentionally disabled until the OAuth client is configured.**

## Required Google Cloud setup (user action)

1. Open https://console.cloud.google.com/apis/credentials and choose the
   intended Google Cloud project, or create a dedicated FantasyEAi project.
2. Configure the OAuth consent screen / brand and publish it for external
   users when permitted.
3. Create an OAuth **Web application** client with this authorized
   JavaScript origin:
   `https://fantasyeai-independent-preview-git-feat-31cfdc-ricky-s-e6dbc3eb.vercel.app`.
   The exact hosted origin can be changed to a dedicated final domain after
   the account and team migration is complete.
4. Copy only the **OAuth Client ID**, not its client secret.
5. Set `VITE_GOOGLE_CLIENT_ID` to that ID in the Ricky's Vercel preview environment
   on this feature branch.
6. Set `GOOGLE_CLIENT_ID` to the SAME ID as a Cloudflare Worker
   environment variable for `fantasyeai-league-hub`. No Google Client Secret
   is needed for this GIS ID-token validation flow.
7. Rebuild the feature preview and test separate accounts: each should see
   only their own leagues and team locks; expired/incorrect-audience tokens must
   be rejected.

## Scope and restrictions

- ESPN public league ID and Sleeper league ID syncing are implemented.
- Private ESPN leagues require an explicit, authorized private-league credential
  integration. Do not ask end users to paste ESPN passwords into the web app.
- The existing Dashboard/War Room still uses Base44 and its old fixed ESPN league.
  The independent /leagues hub is the first migration step, not a finished
  replacement for all premium analysis features.
- Multi-account team locks are one-time and owner-scoped. For account recovery,
  a separate identity-verified unlock workflow is needed.
- A debug APK is NOT a Play Store-ready signed APK/AAB. For Android Google OAuth,
  implement app-aware system-browser PKCE or verified TWA before any release.
- Never modify `fantasyeai.com` DNS, the Ricky's existing
  `fantasy-command-center`, or Nails by Miriam without an explicit release
  cutover after tests pass.
