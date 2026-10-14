# FantasyEAi Android

This branch prepares the existing React/Vite app to ship as a native Android app using Capacitor 8.

## Fixed application identity

- App name: `FantasyEAi`
- Android package ID: `com.fantasyeai.app`
- Web bundle directory: `dist`

The package ID should be treated as permanent once a Play Store build is published.

## Local requirements

- Node.js 22+
- Android Studio 2025.2.1+
- Android SDK 36

## Commands

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

For a debug APK:

```bash
npm run android:build:debug
```

## Repository strategy

- `main` remains untouched by Android preparation.
- Android-native work stays on `android-foundation` until it is reviewed.
- The generated `android/` project is committed so native configuration does not need to be recreated.
- Secrets and signing keys must never be committed.

## Before Play Store release

The following still require owner-supplied assets/account access:

1. Final launcher icon / adaptive icon artwork.
2. Splash-screen artwork.
3. Google Play Console account.
4. Release signing keystore or Play App Signing setup.
5. Privacy-policy URL and store listing content.
6. Any production environment variables/API keys needed outside Base44.
