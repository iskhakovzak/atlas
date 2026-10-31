/** Swatch fill of a colour family (the facet dictionary's 15 families, lib/market/catalog-facets.ts). */
export const swatchColors: Record<string, string> = {
  black: '#1b1b1b', white: '#ffffff', grey: '#9a9a9a', beige: '#dccbad', brown: '#7a5232', red: '#c8302c', pink: '#ec8fb3', orange: '#ec7a2b',
  yellow: '#f2cf3b', green: '#3d8a4f', blue: '#2f5fb3', purple: '#7c4bb0', silver: '#c9ccd1', gold: '#c9a23f',
  multi: 'conic-gradient(#c8302c, #f2cf3b, #3d8a4f, #2f5fb3, #7c4bb0, #c8302c)',
};
/** A colour dot; decorative, the name is said by its label. Kept apart from the filters so the card does not load the facet dictionary. */
export function Swatch({ family }: { family: string }) {
  return <span className="catalog-swatch" data-family={family} style={{ background: swatchColors[family] ?? 'var(--cat-line)' }} aria-hidden="true" />;
}
