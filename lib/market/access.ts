export type SessionStatus = 'loading' | 'guest' | 'authenticated' | 'error';
export const memberViews = new Set(['account','favorites','cart','orders','balance','notifications','identity','declaration','batch','link']);
export const adminViews = new Set(['operations','analytics','admin']);
export function viewAccess(view: string, status: SessionStatus, operator = false) {
  if (!memberViews.has(view) && !adminViews.has(view)) return 'allow';
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  if (status === 'guest') return 'signin';
  return adminViews.has(view) && !operator ? 'forbidden' : 'allow';
}
export function signInPath(returnTo = '/') {
  let safe = '/';
  try {
    const url = new URL(returnTo, 'https://atlas.local');
    if (returnTo.startsWith('/') && url.origin === 'https://atlas.local' && !['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname)) safe = url.pathname + url.search + url.hash;
  } catch {}
  return '/signin-with-chatgpt?return_to=' + encodeURIComponent(safe);
}
