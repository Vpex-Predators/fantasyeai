import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fantasyeai.app',
  appName: 'FantasyEAi',
  webDir: 'dist',
  server: { androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
  plugins: { SplashScreen: { launchAutoHide: true } }
};
export default config;
