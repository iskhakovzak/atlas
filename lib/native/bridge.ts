'use client';
// The web app's view of the native shell (mobile/, Capacitor). The native runtime injects
// `window.Capacitor` into pages loaded from atlasmarket.uz, so no npm package is needed here:
// native plugins are reached through `Capacitor.registerPlugin(name)` and every call is a no-op
// or a plain browser fallback outside the apps. Keep this module free of React and of server code.
export type NativePlatform='ios'|'android';

type PluginProxy=Record<string,(...args:unknown[])=>Promise<unknown>>&{addListener?:(event:string,handler:(data:unknown)=>void)=>Promise<{remove:()=>Promise<void>}>};
type CapacitorGlobal={getPlatform?:()=>string;isNativePlatform?:()=>boolean;isPluginAvailable?:(name:string)=>boolean;Plugins?:Record<string,PluginProxy>;registerPlugin?:(name:string)=>PluginProxy};

function capacitor():CapacitorGlobal|null{
 if(typeof window==='undefined')return null;
 const cap=(window as unknown as {Capacitor?:CapacitorGlobal}).Capacitor;
 return cap&&typeof cap.getPlatform==='function'?cap:null;
}
/** "ios" or "android" inside the Atlas app, null in a browser. */
export function nativePlatform():NativePlatform|null{
 const platform=capacitor()?.getPlatform?.();
 return platform==='ios'||platform==='android'?platform:null;
}
export const isNative=()=>nativePlatform()!==null;

function plugin(name:string):PluginProxy|null{
 const cap=capacitor();
 if(!cap||!cap.isNativePlatform?.())return null;
 if(cap.isPluginAvailable&&!cap.isPluginAvailable(name))return null;
 return cap.Plugins?.[name]??cap.registerPlugin?.(name)??null;
}

/** Opens a link outside the app's web view (SFSafariViewController / Chrome Custom Tabs); a browser gets a new tab. */
export async function openExternal(url:string){
 const browser=plugin('Browser');
 if(browser){await browser.open({url,presentationStyle:'popover'}).catch(()=>window.open(url,'_blank','noopener'));return}
 window.open(url,'_blank','noopener,noreferrer');
}
/** Closes the external browser opened by openExternal (after an OAuth handoff). */
export async function closeExternal(){await plugin('Browser')?.close().catch(()=>undefined)}

export type AppleCredential={identityToken:string;authorizationCode?:string;givenName?:string;familyName?:string;email?:string};
/** iOS only: the system Sign in with Apple sheet. Returns null when cancelled or outside iOS. */
export async function appleSignInNative(options:{nonce:string;state?:string}):Promise<AppleCredential|null>{
 if(nativePlatform()!=='ios')return null;
 const apple=plugin('SignInWithApple');
 if(!apple)return null;
 try{
  const result=await apple.authorize({clientId:'',redirectURI:'',scopes:'email name',nonce:options.nonce,state:options.state}) as {response?:{identityToken?:string;authorizationCode?:string|null;givenName?:string|null;familyName?:string|null;email?:string|null}};
  const response=result?.response;
  if(!response?.identityToken)return null;
  return {identityToken:response.identityToken,authorizationCode:response.authorizationCode??undefined,givenName:response.givenName??undefined,familyName:response.familyName??undefined,email:response.email??undefined};
 }catch{return null}
}

/** Light tactile feedback on phones; nothing elsewhere. */
export async function haptic(kind:'light'|'medium'|'success'|'error'='light'){
 const haptics=plugin('Haptics');
 if(!haptics)return;
 const call=kind==='success'||kind==='error'?haptics.notification({type:kind.toUpperCase()}):haptics.impact({style:kind==='medium'?'MEDIUM':'LIGHT'});
 await call.catch(()=>undefined);
}

/** The system share sheet in the apps; the Web Share API in browsers that have it. Returns false when nothing could be shown. */
export async function shareLink(options:{title:string;text?:string;url:string}):Promise<boolean>{
 const share=plugin('Share');
 if(share){try{await share.share({title:options.title,text:options.text,url:options.url,dialogTitle:options.title});return true}catch{return false}}
 if(typeof navigator!=='undefined'&&typeof navigator.share==='function'){try{await navigator.share(options);return true}catch{return false}}
 return false;
}

/** Deep links while the app is running (custom scheme and universal/app links). Returns an unsubscribe function. */
export function onAppUrlOpen(handler:(url:string)=>void):()=>void{
 const app=plugin('App');
 if(!app?.addListener)return()=>undefined;
 let removed=false,remove:(()=>Promise<void>)|null=null;
 void app.addListener('appUrlOpen',data=>{const url=(data as {url?:unknown})?.url;if(typeof url==='string')handler(url)}).then(handle=>{if(removed)void handle.remove();else remove=handle.remove});
 void app.getLaunchUrl?.().then(data=>{const url=(data as {url?:unknown}|undefined)?.url;if(typeof url==='string')handler(url)}).catch(()=>undefined);
 return()=>{removed=true;void remove?.()};
}
/** Android hardware/gesture back: the handler returns true when it handled the event. */
export function onBackButton(handler:(canGoBack:boolean)=>boolean):()=>void{
 const app=plugin('App');
 if(!app?.addListener)return()=>undefined;
 let removed=false,remove:(()=>Promise<void>)|null=null;
 void app.addListener('backButton',data=>{const canGoBack=Boolean((data as {canGoBack?:unknown})?.canGoBack);if(!handler(canGoBack)&&!canGoBack)void app.exitApp?.()}).then(handle=>{if(removed)void handle.remove();else remove=handle.remove});
 return()=>{removed=true;void remove?.()};
}

export type AppInfo={name:string;version:string;build:string;platform:NativePlatform};
/** Version and build of the installed app, null in a browser. */
export async function appInfo():Promise<AppInfo|null>{
 const platform=nativePlatform(),app=plugin('App');
 if(!platform||!app)return null;
 try{const info=await app.getInfo() as {name?:string;version?:string;build?:string};return {name:info.name??'Atlas',version:info.version??'',build:info.build??'',platform}}catch{return null}
}

/** Status bar style follows the site theme (dark text on the light theme, light text on Atlas Night). */
export async function setStatusBarTheme(theme:'light'|'dark'){
 const bar=plugin('StatusBar');
 if(!bar)return;
 await bar.setStyle({style:theme==='dark'?'DARK':'LIGHT'}).catch(()=>undefined);
 if(nativePlatform()==='android')await bar.setBackgroundColor({color:theme==='dark'?'#0b1410':'#ffffff'}).catch(()=>undefined);
}
/** Hides the native splash once the first page has rendered. */
export async function hideSplash(){await plugin('SplashScreen')?.hide().catch(()=>undefined)}
