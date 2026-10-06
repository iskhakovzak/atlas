/**
 * "Delivery sky" (owner, 7.10.2026: effects around the blocks, "creative", soft colours): dotted delivery routes arcing
 * across, a pulse of light running along each like a parcel in flight, and a few faint twinkling sparks.
 * Decoration only (aria-hidden, no pointer events); styles in app/store-marks.css. The parent sets position and
 * isolation; the sky fills it behind the content.
 */
export type Spark = [left: number, top: number, size: number, delay: number, gold: boolean];

export function DeliverySky({className, viewBox, routes, sparks}: {className: string; viewBox: string; routes: string[]; sparks: Spark[]}) {
  return <div className={'delivery-sky ' + className} aria-hidden="true">
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
      {routes.map((d, index) => <g key={index} className={'sky-route r' + index}>
        <path className="sky-route-dots" d={d} />
        <path className="sky-route-pulse" d={d} pathLength={100} />
      </g>)}
    </svg>
    {sparks.map(([left, top, size, delay, gold], index) => <span key={index} className={'sky-spark' + (gold ? ' gold' : '')} style={{left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s`}} />)}
  </div>;
}
