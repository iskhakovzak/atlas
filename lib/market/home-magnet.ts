/**
 * The home page's wheel magnet (owner, 7.10.2026: "fix the magnet so the 7 sheets switch perfectly"). CSS scroll-snap
 * (app/home-chapters.css) alone pulls a short wheel or touchpad scroll back to the sheet it started on, and a long one
 * can skip a sheet. On a mouse or a touchpad one gesture moves exactly one stop; app/home-magnet.tsx listens, this
 * file decides where to.
 */

/** Where the page may rest: every sheet's top and, for a sheet taller than the window, also its bottom edge (so its
 * lower part is never skipped), within 0..max, sorted and without near duplicates. */
export function magnetStops(sheets: readonly {top: number; height: number}[], viewport: number, max: number): number[] {
  const raw: number[] = [];
  for (const {top, height} of sheets) {
    raw.push(top);
    if (height > viewport + 2) raw.push(top + height - viewport);
  }
  const stops: number[] = [];
  for (const y of raw.map((v) => Math.round(Math.max(0, Math.min(max, v)))).sort((a, b) => a - b)) {
    if (!stops.length || y - stops[stops.length - 1] > 2) stops.push(y);
  }
  return stops;
}

/** The next stop from scroll position `y` in direction `dir` (1 down, -1 up), or null at either end. Between two stops
 * (inside a tall sheet, after a resize) it is the nearest one ahead. */
export function magnetTarget(stops: readonly number[], y: number, dir: 1 | -1): number | null {
  if (dir > 0) { for (const s of stops) if (s > y + 2) return s; return null; }
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < y - 2) return stops[i];
  return null;
}

/** A wheel event's vertical travel in pixels (lines and pages converted). */
export const wheelPixels = (deltaY: number, deltaMode: number, viewport: number) => deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * viewport : deltaY;
