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
