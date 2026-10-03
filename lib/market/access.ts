import {loginPath} from '../auth/return-to.ts';
export type SessionStatus = 'loading' | 'guest' | 'authenticated' | 'error';
export const memberViews = new Set(['account','favorites','cart','orders','balance','notifications','identity','declaration','batch']);
export const adminViews = new Set(['operations','analytics','admin']);
export function viewAccess(view: string, status: SessionStatus, operator = false) {
  if (!memberViews.has(view) && !adminViews.has(view)) return 'allow';
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  if (status === 'guest') return 'signin';
  return adminViews.has(view) && !operator ? 'forbidden' : 'allow';
}
export function signInPath(returnTo = '/') {
  return loginPath(returnTo);
}
