export const impactScriptUrl = 'https://utt.impactcdn.com/P-A7926226-1901-4a82-b369-ac46d499149f1.js';

type ImpactCall = ((...args: string[]) => void) & {a?: string[][]};
export type ImpactWindow = {ire_o?: string; impactStat?: ImpactCall};

/** The owner's Impact partner tag: bootstrap once, then transform links and record the page impression. */
export function startImpactTracking(target: ImpactWindow, page: Document) {
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
