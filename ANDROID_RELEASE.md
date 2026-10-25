# FantasyEAi Android build

GitHub Actions generates a **debug/test APK** from this feature branch. Go to
Actions > FantasyEAi Android test APK > latest successful run > Artifacts.

This is NOT a production-signed app and is not ready for Play Store submission.
A release requires a controlled signing keystore, Android App Bundle (AAB),
Play App Signing, a real-device smoke test and working Google OAuth.

Run locally with Node 22+, Android Studio SDK and Java 21:
```sh
npm ci
npm install --no-save @capacitor/core@8.0.0 @capacitor/android@8.0.0 @capacitor/cli@8.0.0
npm run build
npx cap add android
cd android && ./gradlew assembleDebug
```

The Google Identity Services web sign-in cannot simply be assumed to work in
an embedded Android WebView. Before any user-facing APK release, implement a
system-browser OAuth/PKCE redirect into the app, or use a correctly verified
Trusted Web Activity with Google OAuth on the hosted website. Do not use
an embedded webview OAuth flow that violates Google's provider requirements.

The app currently carries a distinct independent league hub in the web frontend.
The legacy Base44 account/ESPN functions are not independently migrated.

Requires all of: public isolated league API endpoint; Google OAuth client ID
and permitted web origin; verified token audience; private-league connector;
end-to-end multi-user authorization tests. Never ship private credentials in APK.
