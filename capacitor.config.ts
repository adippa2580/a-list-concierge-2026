import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alist.app',
  appName: 'A-List',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#000504',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
    allowsInlineMediaPlayback: true,
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,      // no splash — instant load
    },
  },
};

export default config;
