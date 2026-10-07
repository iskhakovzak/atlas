'use client';
/**
 * "Delivery sky" (owner, 7.10.2026: effects around the blocks, "creative", soft colours): dotted delivery routes arcing
 * across, a comet of light running along each like a parcel in flight, and a few faint twinkling sparks.
 * Decoration only (aria-hidden, no pointer events); styles in app/store-marks.css. The parent sets position and
 * isolation; the sky fills it behind the content.
 *
 * The comets were a stroke-dashoffset pulse on the path: the browser recomputed and repainted the sky on the main thread
 * every frame (~16% of it on the hero alone). Now each route is sampled once into transform + opacity keyframes, which
 * run on the compositor; they are rebuilt when the sky changes size and hold still while it is off the screen.
 */
import {useEffect, useRef} from 'react';

export type Spark = [left: number, top: number, size: number, delay: number, gold: boolean];

/** cubic-bezier(.45, .05, .35, 1): a parcel's pace along its route. */
export const skyPace = (() => {
  const x1 = .45, y1 = .05, x2 = .35, y2 = 1;
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; } return by((lo + hi) / 2); };
})();

/** Keyframes that move a comet (its head at the element's origin point) along a path: fade in, fly, fade out.
 * `map` turns the path's user units into the comet container's pixels. */
export function cometKeyframes(path: SVGPathElement, map: (x: number, y: number) => [number, number], samples = 60): Keyframe[] {
  const len = path.getTotalLength(), at = (l: number) => { const p = path.getPointAtLength(Math.max(0, Math.min(len, l))); return map(p.x, p.y); };
  const frames: Keyframe[] = [];
  let turn = NaN;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, l = skyPace(t) * len, [x, y] = at(l), [ax, ay] = at(l - 2), [bx, by] = at(l + 2);
    let deg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    if (turn === turn) deg += Math.round((turn - deg) / 360) * 360;   // no spin across ±180°
    turn = deg;
    frames.push({offset: t, transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`, opacity: t < .08 ? t / .08 : t > .85 ? (1 - t) / .15 : 1});
  }
  return frames;
}

/** Run time and delay (seconds) of the comet on route 0, 1, 2…; route 1 is gold. */
const cometTiming = [[7, 0], [9, 2.5], [11, 5], [12.5, 5.1], [14, 6.8]];

export function DeliverySky({className, viewBox, routes, sparks}: {className: string; viewBox: string; routes: string[]; sparks: Spark[]}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current, svg = root?.querySelector('svg');
    if (!root || !svg || typeof root.animate !== 'function' || typeof ResizeObserver !== 'function') return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let anims: Animation[] = [], comets: HTMLElement[] = [], live = true, key = '', timer = 0;
    const build = () => {
      timer = 0;
      const box = root.getBoundingClientRect(), m = svg.getScreenCTM();
      const next = reduce.matches || !m || !box.width || !box.height ? 'off' : `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (next === key) return;
      key = next;
      if (next === 'off' || !m) {
        for (const a of anims) a.cancel();
        for (const c of comets) c.remove();
        anims = []; comets = [];
        return;
      }
      // The CTM is in window pixels; the comets are placed in the sky's own box
      const map = (x: number, y: number): [number, number] => [m.a * x + m.c * y + m.e - box.left, m.b * x + m.d * y + m.f - box.top];
      svg.querySelectorAll<SVGPathElement>('.sky-route-dots').forEach((path, index) => {
        const frames = cometKeyframes(path, map, 48), effect = anims[index]?.effect;
        // A new size only reshapes the flight: no new elements, so no style recalculation of the page
        if (effect instanceof KeyframeEffect) { effect.setKeyframes(frames); return; }
        const [run, delay] = cometTiming[index % cometTiming.length];
        const comet = document.createElement('i');
        comet.className = 'sky-comet' + (index === 1 ? ' gold' : '');
        root.appendChild(comet); comets.push(comet);
        const anim = comet.animate(frames, {duration: run * 1000, delay: delay * 1000, iterations: Infinity});
        if (!live) anim.pause();
        anims.push(anim);
      });
    };
    // Resizes come in bursts (a window drag, a theme switch that moves a few pixels): rebuild once they settle
    const ro = new ResizeObserver(() => { if (!key) build(); else { clearTimeout(timer); timer = window.setTimeout(build, 180); } });
    ro.observe(root);
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
      live = entries.some((e) => e.isIntersecting);
      for (const a of anims) { if (live) a.play(); else a.pause(); }
    }, {rootMargin: '-2px 0px'}) : null;
    io?.observe(root);
    reduce.addEventListener('change', build);
    return () => { clearTimeout(timer); ro.disconnect(); io?.disconnect(); reduce.removeEventListener('change', build); for (const a of anims) a.cancel(); for (const c of comets) c.remove(); };
  }, [routes, viewBox]);
  return <div ref={ref} className={'delivery-sky ' + className} aria-hidden="true">
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
      {routes.map((d, index) => <g key={index} className={'sky-route r' + index}>
        <path className="sky-route-dots" d={d} />
      </g>)}
    </svg>
    {sparks.map(([left, top, size, delay, gold], index) => <span key={index} className={'sky-spark' + (gold ? ' gold' : '')} style={{left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s`}} />)}
  </div>;
}
