export const impactScriptUrl = 'https://utt.impactcdn.com/P-A7926226-1901-4a82-b369-ac46d499149f1.js';

// Visible in the server-rendered head for website verification. Consent starts it later.
export const impactHeadScript = `window.atlasStartImpactTracking=function(){
if(document.getElementById('atlas-impact-partner-tag'))return;
(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.id='atlas-impact-partner-tag';t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('${impactScriptUrl}','script','impactStat',document,window);
window.impactStat('transformLinks');window.impactStat('trackImpression');
};`;

type ImpactCall = ((...args: string[]) => void) & {a?: string[][]};
export type ImpactWindow = {ire_o?: string; impactStat?: ImpactCall; atlasStartImpactTracking?: () => void};

/** The owner's Impact partner tag: bootstrap once, then transform links and record the page impression. */
export function startImpactTracking(target: ImpactWindow, page: Document) {
  if (target.atlasStartImpactTracking) { target.atlasStartImpactTracking(); return; }
  const id = 'atlas-impact-partner-tag';
  if (page.getElementById(id)) return;
  target.ire_o = 'impactStat';
  const queued: ImpactCall = (...args) => { (queued.a ??= []).push(args); };
  target.impactStat ??= queued;
  const script = page.createElement('script');
  script.id = id;
  script.async = true;
  script.src = impactScriptUrl;
  const first = page.getElementsByTagName('script')[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else page.head.appendChild(script);
  target.impactStat('transformLinks');
  target.impactStat('trackImpression');
}
