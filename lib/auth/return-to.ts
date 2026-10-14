export const LOGIN_PATH='/login';
// Legacy ChatGPT Sites paths stay reserved so old links can never become a return target.
const reservedPaths=new Set([LOGIN_PATH,'/auth/return','/signin-with-chatgpt','/signout-with-chatgpt','/callback']);

export function safeReturnTo(value:string|null|undefined):string{
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/';
 let url:URL;
 try{url=new URL(value,'https://atlas.local')}catch{return '/'}
 if(url.origin!=='https://atlas.local'||reservedPaths.has(url.pathname)||url.pathname.startsWith('/api/'))return '/';
 return url.pathname+url.search+url.hash;
}

export function loginPath(returnTo='/'){return LOGIN_PATH+'?return_to='+encodeURIComponent(safeReturnTo(returnTo))}

/** The page to come back to after signing in from `here` (path and query of the current page). On the sign-in page
 *  itself it is the page that page was opened for (its own return_to), so a "Sign in" link there keeps the guest's
 *  destination instead of falling back to the home page. */
export function signInReturn(here:string){
 if(!here.startsWith('/')||here.startsWith('//'))return '/';
 let url:URL;
 try{url=new URL(here,'https://atlas.local')}catch{return '/'}
 return safeReturnTo(url.pathname===LOGIN_PATH?url.searchParams.get('return_to'):here);
}
