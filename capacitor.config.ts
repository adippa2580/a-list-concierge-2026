import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alist.app',
  appName: 'A-List',
  webDir: 'dist',
  ios: {
    contentInset: 'always',       // respect safe areas (notch, home indicator)
    backgroundColor: '#000504',   // match app background during launch
    scrollEnabled: false,         // prevent elastic scrolling on the shell
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,      // no splash — instant load
    },
  },
};

export default config;
