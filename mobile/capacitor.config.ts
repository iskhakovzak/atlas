import type {CapacitorConfig} from '@capacitor/cli';

// The Atlas apps are a thin shell: the WebView loads the live site (pages, sign-in and the API stay
// on atlasmarket.uz, a Cloudflare Worker), so a release never ships a copy of the site. www/ holds
// only the local start page and the offline page. For development against a LAN build of the site
// change server.url locally and never commit it (MOBILE.md).
const config:CapacitorConfig={
 appId:'uz.atlasmarket.app',
 appName:'Atlas',
 webDir:'www',
 backgroundColor:'#ffffff',
 server:{url:'https://atlasmarket.uz',errorPath:'error.html',cleartext:false},
 ios:{contentInset:'automatic',limitsNavigationsToAppBoundDomains:false},
 android:{allowMixedContent:false},
 plugins:{
  // The site hides the splash as soon as it has rendered (app/native-shell.tsx). The auto-hide is a
  // watchdog: on Android the local error page cannot reach plugins, so a splash that waited for the
  // page would never go away without a network.
  SplashScreen:{launchAutoHide:true,launchShowDuration:3000,launchFadeOutDuration:200,backgroundColor:'#ffffff',showSpinner:false},
  // Dark icons on the white header; the site switches the style when Atlas Night is on.
  StatusBar:{overlaysWebView:false,style:'LIGHT',backgroundColor:'#ffffff'},
  // Android 15+ is edge to edge: the WebView extends under the bars and the site pads the header and
  // the bottom bar with env(safe-area-inset-*) (viewport-fit=cover in app/layout.tsx).
  SystemBars:{insetsHandling:'native',style:'LIGHT'},
  Keyboard:{resize:'native',resizeOnFullScreen:true},
 },
};

export default config;
