// Line art for the home page's wide-screen medallions (app/home-decor.tsx): static SVG strings, no user data.
// Each piece is drawn with stroke = currentColor on a 200 x 200 box; app/home-wide-decor.css colours the hw-decor-* classes.
export type DecorArt='globe'|'box'|'bill'|'ask';
export const decorArt:Record<DecorArt,string>={
 globe:'<circle class="hw-decor-f1" cx="100" cy="102" r="38"/><circle cx="100" cy="102" r="38"/><ellipse cx="100" cy="102" rx="16" ry="38"/><path d="M62 102h76"/><path class="hw-decor-soft" d="M67.1 83h65.8M67.1 121h65.8"/><g transform="translate(110 58)"><path class="hw-decor-pin" d="M8 20s7-5.8 7-11.6A7 7 0 0 0 1 8.4C1 14.2 8 20 8 20z"/><circle class="hw-decor-hole" cx="8" cy="8.4" r="2.4"/></g>',
 box:'<path class="hw-decor-f1" d="M60 82v40l40 20v-40z"/><path class="hw-decor-f1" d="M140 82v40l-40 20v-40z"/><path class="hw-decor-f2" d="M100 62l40 20-40 20-40-20z"/><path d="M100 62l40 20v40l-40 20-40-20V82zM60 82l40 20 40-20M100 102v40"/><path class="hw-decor-soft" d="M80 72l40 20v40"/><path class="hw-decor-soft" d="M68 100l18 9v12l-18-9z"/>',
 bill:'<path class="hw-decor-f1" d="M70 56h60v86l-7.5-5-7.5 5-7.5-5-7.5 5-7.5-5-7.5 5-7.5-5-7.5 5z"/><path d="M70 56h60v86l-7.5-5-7.5 5-7.5-5-7.5 5-7.5-5-7.5 5-7.5-5-7.5 5z"/><path d="M80 72h22" stroke-width="3"/><path d="M80 88h20M80 100h14M80 112h18"/><path class="hw-decor-soft hw-decor-dots" d="M104 88h8M98 100h14M102 112h10"/><path d="M116 88h4M116 100h4M116 112h4"/><path class="hw-decor-soft" d="M80 122h40"/><path d="M106 130h14" stroke-width="3"/>',
 ask:'<path class="hw-decor-f1" d="M68 64h52a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H90l-14 12v-12h-8a10 10 0 0 1-10-10V74a10 10 0 0 1 10-10z"/><path d="M68 64h52a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H90l-14 12v-12h-8a10 10 0 0 1-10-10V74a10 10 0 0 1 10-10z"/><path d="M88 80.5a6.5 6.5 0 1 1 9 6c-2 .9-3 2.2-3 4.2v1.3"/><circle class="hw-decor-dot" cx="94" cy="99" r="1.9"/><path class="hw-decor-f2" d="M108 100h30a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-2v9l-10-9h-18a8 8 0 0 1-8-8v-14a8 8 0 0 1 8-8z"/><path d="M108 100h30a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-2v9l-10-9h-18a8 8 0 0 1-8-8v-14a8 8 0 0 1 8-8z"/><circle class="hw-decor-dot" cx="113" cy="115" r="2.2" opacity=".6"/><circle class="hw-decor-dot" cx="123" cy="115" r="2.2" opacity=".6"/><circle class="hw-decor-dot" cx="133" cy="115" r="2.2" opacity=".6"/>',
};
/** Where the inner orbit's satellite sits, in degrees. */
const satellite:Record<DecorArt,number>={globe:-38,box:-142,bill:-38,ask:-142};
/** Outer orbit radius on the 200 box: a full medallion's footprint is size * 236 / 200, a compact one (no outer orbit) size * 197 / 200. */
export const decorOrbit2=118;
/** The medallion behind an art piece: a pearl disk, a dotted orbit with a satellite and, when full, a second fainter orbit. */
export function decorMedal(art:DecorArt,full:boolean){
 const r=95,t=satellite[art]*Math.PI/180,o=decorOrbit2;
 return `<defs><radialGradient id="hw-decor-disk-${art}" cx="42%" cy="34%" r="72%"><stop offset="0" class="hw-decor-da"/><stop offset="1" class="hw-decor-db"/></radialGradient></defs>`
  +(full?`<circle class="hw-decor-orbit hw-decor-orbit2" cx="100" cy="100" r="${o}"/><circle class="hw-decor-sat hw-decor-sat2" cx="${(100+o*Math.cos(t+2.6)).toFixed(1)}" cy="${(100+o*Math.sin(t+2.6)).toFixed(1)}" r="2.8"/>`:'')
  +`<circle class="hw-decor-orbit" cx="100" cy="100" r="${r}"/><circle class="hw-decor-disk" cx="100" cy="100" r="78" fill="url(#hw-decor-disk-${art})"/><circle class="hw-decor-sat" cx="${(100+r*Math.cos(t)).toFixed(1)}" cy="${(100+r*Math.sin(t)).toFixed(1)}" r="3.4"/>`
  +decorArt[art];
}
