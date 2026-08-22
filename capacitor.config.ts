import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mallucupid.app',
  appName: 'MalluCupid',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    backgroundColor: '#0b0b0f',
  },
  server: {
    hostname: 'www.mallucupid.com',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1600,
      backgroundColor: '#0b0b0f',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      backgroundColor: '#0b0b0f',
      style: 'LIGHT',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    Network: {},
    Share: {},
    InAppReview: {},
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#F43F5E',
      sound: null,
    },
    Clipboard: {},
    Device: {},
    McToast: {},
    McRatePrompt: {},
    BiometricAuth: {},
    Filesystem: {},
    Browser: {},
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    McAppInfo: {},
    KeepAwake: {},
  },
};

export default config;
