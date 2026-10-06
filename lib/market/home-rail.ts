// Pure geometry of the home chapter rail (app/home-rail.tsx). No DOM here: the component measures, these functions decide.
// Every value is in window pixels: chapter tops are document offsets, rail centres are offsets inside the rail's list.

/** The chapter being read: the last one whose top has passed 45% of the window; at the very end of the document, the last one. */
export function currentChapterIndex(tops: readonly number[], y: number, vh: number, docH: number): number {
  let cur = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= y + vh * 0.45) cur = i;
  if (tops.length && y + vh >= docH - 2) cur = tops.length - 1;
  return cur;
}

/**
 * How much of the rail's progress line is filled, 0..1: from the first item's centre to the last one's,
 * moving from the current item towards the next as the current chapter scrolls by.
 */
export function railFill(tops: readonly number[], centres: readonly number[], y: number, cur: number): number {
  if (centres.length < 2 || cur < 0 || cur >= centres.length || tops[cur] === undefined) return 0;
  const next = tops[cur + 1];
  const run = next === undefined ? 0 : next - tops[cur];
  const p = run > 0 ? Math.min(1, Math.max(0, (y - tops[cur]) / run)) : 0;
  const span = centres[centres.length - 1] - centres[0];
  const at = centres[cur] + (centres[cur + 1] !== undefined ? p * (centres[cur + 1] - centres[cur]) : 0);
  return span > 0 ? Math.max(0, Math.min(1, (at - centres[0]) / span)) : 0;
}

/** Chapter number as the rail and the next-chapter cues print it: 1 → '01'. */
export function padChapter(n: number): string {
  return String(n).padStart(2, '0');
}
