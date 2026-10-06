// Home page on wide screens: the contract shared by the chapter rail (app/home-rail.tsx), the decor (app/home-decor.tsx),
// the inserts (app/home-sections.tsx, app/home-facts.tsx) and their slots (app/home-wide.tsx). No imports, constants and
// pure functions only. The media strings are repeated verbatim in app/home-wide-*.css.

export const homeWideMedia = {
  wide: '(min-width: 1440px) and (min-height: 820px)', // inserts, decor, FAQ layout, closing card, Night tracking
  tall: '(min-width: 1440px) and (min-height: 1000px)', // facts row, footer in columns
  rail: '(min-width: 1680px)', // the rail and the field geometry (any height)
  railFull: '(min-width: 1920px)', // the full rail and its button; 1680–1919.98 compact
  cue: '(min-width: 1680px) and (min-height: 880px)', // the next-chapter cue
  zoom: '(min-width: 2200px) and (min-height: 1200px)', // the 27"+ composition scale
} as const;

export const homeChapters = ['top', 'how', 'finds', 'tariffs', 'trust', 'faq', 'end'] as const;
export type HomeChapter = (typeof homeChapters)[number];
export const homeChapterHref: Record<HomeChapter, string> = { top: '#main', how: '#how', finds: '#finds', tariffs: '#tariffs', trust: '#trust', faq: '#faq', end: '#closing-title' };
/** Chapters without main buttons of their own: the rail shows its quiet «Paste a link» there. */
export const homeRailCtaChapters: readonly HomeChapter[] = ['how', 'tariffs', 'trust', 'faq'];
/** Fired by the rail when its box changes (mount, compact <-> full, zoom, unmount); the decor re-measures. */
export const homeWideLayoutEvent = 'home-wide:layout';

/** Client only: the composition zoom set by app/home-wide-rail.css (plain number), 1 when unset. */
export function homeWideZoom() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hw-z')) || 1;
}
