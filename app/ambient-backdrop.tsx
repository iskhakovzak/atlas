import { ArrowUpRight } from 'lucide-react';

/**
 * Site-wide decoration behind the pages (owner, 7.10.2026: "effects where there is room, quiet on phones",
 * "a few diagonal watermarks"): soft glows of the brand green, mint and warm gold, and a few large tilted Atlas
 * wordmarks. Fixed under everything (z-index -1 in the root stacking context, app/ambient.css), so it shows only
 * in empty space between cards. Purely decorative: aria-hidden, no pointer events, still with reduced motion.
 */
export function AmbientBackdrop() {
  return <div className="ambient" aria-hidden="true">
    <span className="ambient-glow ambient-glow-1" />
    <span className="ambient-glow ambient-glow-2" />
    <span className="ambient-glow ambient-glow-3" />
    {[1, 2, 3].map(n => <span key={n} className={`ambient-mark ambient-mark-${n}`}>atlas<ArrowUpRight strokeWidth={2.4} /></span>)}
  </div>;
}
