'use client';
import {useEffect,useRef} from 'react';
import {useMarket} from '@/lib/market/store';
import {homeCopy} from '@/lib/market/home-copy';
import {deliveryRegions,type DeliveryRegion} from '@/lib/market/site-content';
import type {Locale} from '@/lib/market/i18n';
import {homeChapters,homeWideLayoutEvent,homeWideMedia,homeWideZoom,type HomeChapter} from '@/lib/market/home-wide';
import {globeView,routeLabelSide,routeOrigins,sphereDots,tashkent,unitVector} from '@/lib/market/world-land';
import {cometKeyframes,skyPace} from './delivery-sky';
import {decorMedal,decorOrbit2,type DecorArt} from './home-decor-art';

// Wide-screen decor behind the home sheets, loaded by HomeDecorSlot (app/home-wide.tsx) only at homeWideMedia.wide:
// a soft mint pool on every sheet, a medallion in the right field where the field is wide enough (hero, rates,
// "your money", FAQ) and, on the closing sheet, a dot map with routes from the delivery regions to Tashkent — an
// illustration (approximate country centres, no times, no statuses). React owns only the root; the layers, SVG and
// parcels are drawn imperatively from the sheets' geometry. All sizes are window pixels: main itself is never zoomed
// (the 27"+ zoom sits on the sheets), so the root's CSS pixels are window pixels. Styles: app/home-wide-decor.css.

type Box={left:number;right:number;top:number;bottom:number;width:number;height:number};
type Labels={regions:Record<DeliveryRegion,string>;to:string};
type Layer={el:HTMLDivElement;glow:HTMLDivElement;anims:Animation[];mapKey:string;glowKey:string;skyKey:string;near:boolean;globe?:{play:()=>void;pause:()=>void;stop:()=>void}};
type Engine={setLabels:(labels:Labels)=>void;stop:()=>void};

const NS='http://www.w3.org/2000/svg';
const sheetArt:Partial<Record<HomeChapter,DecorArt>>={top:'globe',tariffs:'box',trust:'bill',faq:'ask'};
/** The blocks a sheet's medallion and mint pool line up with; on the closing sheet, the card the map stands on. */
const sheetTarget:Record<HomeChapter,string>={top:'.home-example',how:'.home-steps',finds:'.finds-grid',tariffs:'.tariff-grid',trust:'.home-trust-money, .home-trust-proof',faq:'.home-faq',end:'.home-closing'};

// A mint pool: a radial gradient with a long soft fall-off (alpha in % of the colour at each stop).
const fall=[[0,100],[8,97],[16,90],[24,80],[32,68],[40,55],[48,43],[56,32],[64,22],[72,14],[80,8],[88,4],[94,1.5]];
const pool=(color:string,w:number,h:number,x:number,y:number)=>`radial-gradient(${w.toFixed(0)}px ${h.toFixed(0)}px at ${x.toFixed(0)}px ${y.toFixed(0)}px, ${fall.map(([p,a])=>`color-mix(in srgb, ${color} ${a}%, transparent) ${p}%`).join(', ')}, transparent 100%)`;
const ease=skyPace;   // a parcel's pace along its arc
const svgEl=(tag:string,attrs:Record<string,string|number>,parent:Element)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,String(attrs[k]));parent.appendChild(n);return n};
/** A direct child of a layer by class, created once. */
function part<T extends Element>(layer:Layer,cls:string,make:()=>T):T{
 let n=layer.el.querySelector<T>(`:scope > .${cls}`);
 if(!n){n=make();n.classList.add(cls);layer.el.appendChild(n)}
 return n;
}
const svgPart=(layer:Layer,cls:string)=>part(layer,cls,()=>{const s=document.createElementNS(NS,'svg');s.setAttribute('focusable','false');s.setAttribute('aria-hidden','true');return s});
const dropParts=(layer:Layer,...cls:string[])=>{for(const c of cls)layer.el.querySelector(`:scope > .${c}`)?.remove()};
const stopAnims=(layer:Layer)=>{for(const a of layer.anims)a.cancel();layer.anims=[];layer.globe?.stop();layer.globe=undefined};

/** The closing sheet's globe (owner, 7.10.2026: "it looks flat, not 3D", "remove the lag"): a canvas sphere rising
 * over the closing card. The dots are lit from the upper left, shaded towards the limb and foreshortened by their
 * angle; the routes fly as 3D arcs over the surface with their shadows on the ground, the American one coming up from
 * behind the horizon. The dot field is precomputed once (sphereDots, a scanline) and painted once per size and theme;
 * a second, transparent canvas carries what moves (planes, city lights, Tashkent's pulse): at most 30 frames a second,
 * only while the sheet is on screen and never while the page scrolls. Reduced motion: one still frame. */
type Pal={b0:string;b1:string;b2:string;air:string;airA:number;dot:string;dotA:number;sea:string;seaA:number;hot:string;gold:string;grid:string;
 shade:string;spec:string;limb:string;arc:string;arcA:number;plane:string;pin:string;city:string;ring:string};
const palette=(el:Element):Pal=>{
 const cs=getComputedStyle(el),v=(n:string,f:string)=>cs.getPropertyValue(n).trim()||f,num=(n:string,f:number)=>parseFloat(v(n,''))||f;
 return {b0:v('--hwg-body-0','#fff'),b1:v('--hwg-body-1','#f2f7f4'),b2:v('--hwg-body-2','#d6e5dc'),air:v('--hwg-air','76,170,128'),airA:num('--hwg-air-a',.34),
  dot:v('--hwg-dot','#1f4d3b'),dotA:num('--hwg-dot-a',.75),sea:v('--hwg-sea','#1f4d3b'),seaA:num('--hwg-sea-a',.12),hot:v('--hwg-hot','#2f8f63'),gold:v('--hwg-gold','#c9974a'),
  grid:v('--hwg-grid','rgba(31,77,59,.08)'),shade:v('--hwg-shade','rgba(18,52,38,.2)'),spec:v('--hwg-spec','rgba(255,255,255,.6)'),limb:v('--hwg-limb','rgba(31,77,59,.2)'),
  arc:v('--hwg-arc','#1f4d3b'),arcA:num('--hwg-arc-a',.62),plane:v('--hwg-plane','#1f4d3b'),pin:v('--hwg-pin','#1f4d3b'),city:v('--hwg-city','#3fae7c'),ring:v('--hwg-ring','#fff')};
};
const planeShape=typeof Path2D==='function'?new Path2D('M22.5 12c0-.9-.8-1.5-1.7-1.5h-5.6L9.6 2.2H7.4l2.8 8.3H5.3L3.4 7.8H1.5l1.2 4.2-1.2 4.2h1.9l1.9-2.7h4.9l-2.8 8.3h2.2l5.6-8.3h5.6c.9 0 1.7-.6 1.7-1.5z'):null;
/** Shared by every globe: when the page last scrolled. */
const motion={scrollAt:0};
const TAU=Math.PI*2;

function drawMap(layer:Layer,W:number,H:number,col:Box,card:Box,_foot:number,clipL:number,zoom:number,labels:Labels,still:boolean){
 stopAnims(layer);
 const sky=card.top;
 if(sky<300){dropParts(layer,'hw-decor-globe','hw-decor-globe-fx','hw-decor-pins');return}
 const routes=deliveryRegions.flatMap(({id})=>{const at=routeOrigins[id];return at?[{id,lon:at[0],lat:at[1]}]:[]});
 const z=Math.max(1,zoom),rad=Math.PI/180;
 const R=Math.max(240,Math.min((sky-90)/.8,col.width*.43,620*z)),cx=(col.left+col.right)/2,cy=sky+.2*R,bottom=card.bottom-24;
 // The canvas covers the globe, its air and the arcs above it, down to under the card.
 const x0=Math.max(clipL,Math.floor(cx-R*1.32)),x1=Math.min(W,Math.ceil(cx+R*1.32)),y0=Math.max(0,Math.floor(cy-R*1.42)),y1=Math.ceil(Math.min(H,bottom));
 const cw=x1-x0,ch=y1-y0;if(cw<50||ch<50){dropParts(layer,'hw-decor-globe','hw-decor-globe-fx','hw-decor-pins');return}
 const dpr=Math.min(2,window.devicePixelRatio||1);
 const canvas=part(layer,'hw-decor-globe',()=>document.createElement('canvas'));
 canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);
 Object.assign(canvas.style,{left:`${x0}px`,top:`${y0}px`,width:`${cw}px`,height:`${ch}px`});
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const ox=cx-x0,oy=cy-y0;   // the globe's centre in canvas pixels

 // The dot field and what lies on it, in world space (computed once per size)
 const {land,sea}=sphereDots(5.6*z/R/rad);
 const nLand=land.length/3,nSea=sea.length/3;
 const T=unitVector(tashkent[0],tashkent[1]);
 const hots=[...routes.map(r=>({v:unitVector(r.lon,r.lat),cls:1})),{v:T,cls:2}],hotCos=Math.cos(7*rad);
 const cls=new Uint8Array(nLand),heat=new Float32Array(nLand);
 for(let i=0;i<nLand;i++){const a=land[i*3],b=land[i*3+1],c=land[i*3+2];
  for(const h of hots){const d=a*h.v[0]+b*h.v[1]+c*h.v[2];if(d>hotCos){const t=(d-hotCos)/(1-hotCos);if(t>heat[i]){heat[i]=t;cls[i]=h.cls}}}}
 // City lights: a few plain land dots that twinkle
 const lights:number[]=[];{let seed=11;for(let i=0;i<nLand;i++){seed=(seed*16807)%2147483647;if(!cls[i]&&seed/2147483647<.004)lights.push(i)}}
 // Arcs: great circles lifted by a sine bump, and their ground tracks; world space, so they turn with the globe
 const N=72;
 const arcs=routes.map(({id,lon,lat})=>{
  const O=unitVector(lon,lat),w=Math.acos(Math.max(-1,Math.min(1,O[0]*T[0]+O[1]*T[1]+O[2]*T[2]))),sw=Math.sin(w)||1,hmax=Math.min(.2,.05+.22*w);
  const air=new Float32Array((N+1)*3),ground=new Float32Array((N+1)*3);
  for(let k=0;k<=N;k++){const t=k/N,a=Math.sin((1-t)*w)/sw,b=Math.sin(t*w)/sw,lift=1+hmax*Math.sin(Math.PI*t);
   for(let j=0;j<3;j++){const g=a*O[j]+b*T[j];ground[k*3+j]=g;air[k*3+j]=g*lift}}
  return {id,air,ground};
 });

 // Static paint: the air and the body below the dots, the shading and the lit rim above them
 const pal=palette(layer.el);
 const paint=(draw:(c:CanvasRenderingContext2D)=>void)=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const g=c.getContext('2d');if(g){g.scale(dpr,dpr);draw(g)}return c};
 const under=paint(g=>{
  const air=g.createRadialGradient(ox,oy,R*.8,ox,oy,R*1.18);
  air.addColorStop(0,`rgba(${pal.air},0)`);air.addColorStop(.17,`rgba(${pal.air},${pal.airA})`);air.addColorStop(.4,`rgba(${pal.air},${pal.airA*.3})`);air.addColorStop(1,`rgba(${pal.air},0)`);
  g.fillStyle=air;g.beginPath();g.arc(ox,oy,R*1.18,0,TAU);g.fill();
  const body=g.createRadialGradient(ox-R*.36,oy-R*.42,0,ox-R*.1,oy-R*.12,R*1.12);
  body.addColorStop(0,pal.b0);body.addColorStop(.55,pal.b1);body.addColorStop(1,pal.b2);
  g.fillStyle=body;g.beginPath();g.arc(ox,oy,R,0,TAU);g.fill();
 });
 const over=paint(g=>{
  g.save();g.beginPath();g.arc(ox,oy,R,0,TAU);g.clip();
  const shade=g.createRadialGradient(ox-R*.34,oy-R*.4,R*.2,ox-R*.12,oy-R*.14,R*1.16);
  shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.6,'rgba(0,0,0,0)');shade.addColorStop(1,pal.shade);
  g.fillStyle=shade;g.fillRect(ox-R,oy-R,R*2,R*2);
  const spec=g.createRadialGradient(ox-R*.4,oy-R*.48,0,ox-R*.4,oy-R*.48,R*.55);
  spec.addColorStop(0,pal.spec);spec.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=spec;g.fillRect(ox-R,oy-R,R*2,R*2);g.restore();
  const rim=g.createLinearGradient(ox-R,oy-R,ox+R*.4,oy+R*.4);
  rim.addColorStop(0,`rgba(${pal.air},.9)`);rim.addColorStop(.5,`rgba(${pal.air},0)`);
  g.lineWidth=2.5*z;g.strokeStyle=rim;g.beginPath();g.arc(ox,oy,R-1,0,TAU);g.stroke();
  g.lineWidth=1;g.strokeStyle=pal.limb;g.beginPath();g.arc(ox,oy,R,0,TAU);g.stroke();
 });

 // Name tags: HTML, moved by transform each frame
 const pins=part(layer,'hw-decor-pins',()=>document.createElement('div'));pins.replaceChildren();
 Object.assign(pins.style,{left:'0px',top:'0px',width:`${W}px`,height:`${H}px`});pins.style.setProperty('--hwd-u',`${z}px`);
 const pin=(text:string,side:string,extra='')=>{const p=document.createElement('b');p.className='hw-decor-pin';const t=document.createElement('span');
  t.className=`hw-decor-tag hw-decor-tag-${side}${extra}`;t.textContent=text;p.appendChild(t);pins.appendChild(p);return {el:p,key:''}};
 const tags=routes.map(({id})=>labels.regions[id]?pin(labels.regions[id]!,routeLabelSide[id]??'l'):null);
 const farTags=routes.map(({id})=>labels.regions[id]?pin(labels.regions[id]!,'l',' hw-decor-tag-far'):null);
 const home=labels.to?pin(labels.to,'b',' hw-decor-tag-to'):null;
 const place=(p:{el:HTMLElement;key:string}|null,x:number,y:number,on:boolean)=>{if(!p)return;
  const key=on?`${Math.round((x0+x)*4)},${Math.round((y0+y)*4)}`:'off';if(key===p.key)return;p.key=key;
  if(on){p.el.style.transform=`translate(${(x0+x).toFixed(2)}px,${(y0+y).toFixed(2)}px)`;p.el.style.opacity='1'}else p.el.style.opacity='0'};

 // The view is fixed (owner, 7.10.2026: "if the globe's motion eats resources, remove it"): the sway redrew ~10k dots
 // every frame, a fifth of the main thread. The globe, its routes and pins are painted once; only the planes, the city
 // lights and Tashkent's pulse move, on a transparent canvas above it.
 const lam=globeView[0]*rad,phi=globeView[1]*rad,sl=Math.sin(lam),cl=Math.cos(lam),sp=Math.sin(phi),cp=Math.cos(phi);
 const ex=-sl,ey=cl,nx=-sp*cl,ny=-sp*sl,nz=cp,vx=cp*cl,vy=cp*sl,vz=sp;
 const P=(arr:ArrayLike<number>,k:number)=>{const a=arr[k*3],b=arr[k*3+1],c=arr[k*3+2],px=a*ex+b*ey,py=a*nx+b*ny+c*nz,dz=a*vx+b*vy+c*vz;
  return {x:ox+R*px,y:oy-R*py,on:dz>0||px*px+py*py>1,front:dz>0}};
 const tP=P(T,0);
 const paths=arcs.map(arc=>{const pts=Array.from({length:N+1},(_,k)=>P(arc.air,k));return {pts,first:pts.findIndex(p=>p.on)}});

 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
 ctx.drawImage(under,0,0,cw,ch);
 // Graticule, front only
 ctx.beginPath();
 const gline=(pt:(k:number)=>[number,number,number],n:number)=>{let pen=false;for(let k=0;k<=n;k++){const [a,b,c]=pt(k),dz=a*vx+b*vy+c*vz;
  if(dz>.03){const X=ox+R*(a*ex+b*ey),Y=oy-R*(a*nx+b*ny+c*nz);if(pen)ctx.lineTo(X,Y);else{ctx.moveTo(X,Y);pen=true}}else pen=false}};
 for(let lo=-180;lo<180;lo+=20)gline(k=>unitVector(lo,-80+k*4),40);
 for(let la=-60;la<=80;la+=20)gline(k=>unitVector(-180+k*4,la),90);
 ctx.lineWidth=1;ctx.strokeStyle=pal.grid;ctx.stroke();
 // Sea: tiny squares, fading to the limb
 const levels=6,sizes=4,kinds=3,sas:number[][]=Array.from({length:levels},()=>[]),bx:number[][]=Array.from({length:kinds*sizes*levels},()=>[]);
 for(let i=0;i<nSea;i++){const a=sea[i*3],b=sea[i*3+1],c=sea[i*3+2],dz=a*vx+b*vy+c*vz;if(dz<.12)continue;
  const Y=oy-R*(a*nx+b*ny+c*nz);if(Y+y0>bottom)continue;
  sas[Math.min(levels-1,Math.floor(Math.min(1,(dz-.08)/.6)*levels))].push(ox+R*(a*ex+b*ey),Y)}
 const ss=1.15*z;ctx.fillStyle=pal.sea;
 sas.forEach((s,l)=>{if(!s.length)return;ctx.globalAlpha=pal.seaA*(l+1)/levels;ctx.beginPath();for(let k=0;k<s.length;k+=2)ctx.rect(s[k]-ss/2,s[k+1]-ss/2,ss,ss);ctx.fill()});
 // Land: lit from the upper left, foreshortened, the delivery countries and Tashkent glowing; dots batched by look
 const light=[-.5,.62,.6].map((c,_,l)=>c/Math.hypot(...l)),colours=[pal.dot,pal.hot,pal.gold];
 for(let i=0;i<nLand;i++){const a=land[i*3],b=land[i*3+1],c=land[i*3+2],dz=a*vx+b*vy+c*vz;if(dz<.1)continue;
  const px=a*ex+b*ey,py=a*nx+b*ny+c*nz,Y=oy-R*py;if(Y+y0>bottom)continue;
  const lit=Math.max(0,px*light[0]+py*light[1]+dz*light[2]),face=Math.min(1,(dz-.08)/.42),h=heat[i];
  const f=face*(.38+.62*lit)*(h?Math.min(1,.6+h):1);
  const size=Math.min(sizes-1,Math.floor(Math.min(.999,Math.sqrt(dz)*(.5+.5*lit)+h*.45)*sizes));
  bx[(cls[i]*sizes+size)*levels+Math.min(levels-1,Math.floor(f*levels))].push(ox+R*px,Y);
 }
 for(let k=0;k<bx.length;k++){const b=bx[k];if(!b.length)continue;
  const level=k%levels,size=Math.floor(k/levels)%sizes,kind=Math.floor(k/(levels*sizes)),r=z*(.62+.95*(size+.5)/sizes);
  ctx.globalAlpha=pal.dotA*(level+1)/levels;ctx.fillStyle=colours[kind];ctx.beginPath();
  for(let j=0;j<b.length;j+=2){ctx.moveTo(b[j]+r,b[j+1]);ctx.arc(b[j],b[j+1],r,0,TAU)}ctx.fill()}
 ctx.globalAlpha=1;ctx.drawImage(over,0,0,cw,ch);
 // Routes: the shadow on the ground, the arc with its glow, the origin's pin and name tag
 arcs.forEach((arc,i)=>{
  const {pts,first}=paths[i];
  ctx.beginPath();let pen=false;
  for(let k=0;k<=N;k++){const g=P(arc.ground,k);if(g.front){if(pen)ctx.lineTo(g.x,g.y);else{ctx.moveTo(g.x,g.y);pen=true}}else pen=false}
  ctx.setLineDash([1.5*z,5*z]);ctx.lineWidth=1.6*z;ctx.strokeStyle=pal.arc;ctx.globalAlpha=.28;ctx.stroke();ctx.setLineDash([]);
  if(first<0){place(tags[i],0,0,false);place(farTags[i],0,0,false);return}
  const s=pts[first],grad=ctx.createLinearGradient(s.x,s.y,tP.x,tP.y);grad.addColorStop(0,pal.arc);grad.addColorStop(1,pal.gold);
  ctx.beginPath();ctx.moveTo(s.x,s.y);for(let k=first+1;k<=N;k++)ctx.lineTo(pts[k].x,pts[k].y);
  ctx.strokeStyle=grad;ctx.lineCap='round';ctx.globalAlpha=.1;ctx.lineWidth=10*z;ctx.stroke();ctx.globalAlpha=pal.arcA;ctx.lineWidth=2*z;ctx.stroke();
  ctx.globalAlpha=1;
  if(first===0){
   ctx.fillStyle=pal.pin;ctx.globalAlpha=.14;ctx.beginPath();ctx.arc(s.x,s.y,8*z,0,TAU);ctx.fill();ctx.globalAlpha=1;
   ctx.beginPath();ctx.arc(s.x,s.y,3.2*z,0,TAU);ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=pal.ring;ctx.stroke();
   place(tags[i],s.x,s.y,true);place(farTags[i],0,0,false);
  }else{place(tags[i],0,0,false);place(farTags[i],s.x,s.y,true)}
 });
 // Tashkent's warm glow and ring; the pin itself goes on the moving layer, over the planes that land on it
 const glow=ctx.createRadialGradient(tP.x,tP.y,0,tP.x,tP.y,30*z);glow.addColorStop(0,pal.gold);glow.addColorStop(1,'rgba(0,0,0,0)');
 ctx.globalAlpha=.3;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(tP.x,tP.y,30*z,0,TAU);ctx.fill();
 ctx.globalAlpha=.6;ctx.strokeStyle=pal.gold;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(tP.x,tP.y,12*z,0,TAU);ctx.stroke();ctx.globalAlpha=1;
 place(home,tP.x,tP.y,tP.on);

 // The moving layer
 const fx=part(layer,'hw-decor-globe-fx',()=>document.createElement('canvas'));
 fx.width=canvas.width;fx.height=canvas.height;
 Object.assign(fx.style,{left:`${x0}px`,top:`${y0}px`,width:`${cw}px`,height:`${ch}px`});
 const fc=fx.getContext('2d');if(!fc)return;
 const lightPts=lights.flatMap((i,k)=>{const p=P(land,i),dz=land[i*3]*vx+land[i*3+1]*vy+land[i*3+2]*vz;return dz<.3||p.y+y0>bottom-6?[]:[{x:p.x,y:p.y,k}]});
 const frame=(t:number)=>{
  fc.setTransform(dpr,0,0,dpr,0,0);fc.clearRect(0,0,cw,ch);
  // City lights
  fc.fillStyle=pal.city;
  for(const {x,y,k} of lightPts){const tw=still?.6:Math.max(0,Math.sin(t*TAU/(3.2+(k*37%23)/10)+k*1.7));if(tw<.05)continue;
   fc.globalAlpha=.22*tw;fc.beginPath();fc.arc(x,y,5*z,0,TAU);fc.fill();fc.globalAlpha=.95*tw;fc.beginPath();fc.arc(x,y,1.7*z,0,TAU);fc.fill()}
  // The planes, their contrails and the ripple at departure
  if(!still)paths.forEach(({pts,first},i)=>{
   if(first<0)return;
   const cyc=((t+i*1.13+.6)/6.8)%1;if(cyc>=.72)return;
   const tau=cyc/.72,fk=ease(tau)*N,k0=Math.min(N-1,Math.floor(fk)),u=fk-k0,a=pts[k0],b=pts[k0+1];
   const fade=cyc<.05?cyc/.05:cyc<.64?1:Math.max(0,1-(cyc-.64)/.08);
   if(a.on&&b.on){
    const tail=Math.max(first,Math.floor(fk-N*.16));
    fc.beginPath();fc.moveTo(pts[tail].x,pts[tail].y);for(let k=tail+1;k<=k0;k++)fc.lineTo(pts[k].x,pts[k].y);fc.lineTo(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);
    fc.strokeStyle=pal.gold;fc.lineCap='round';fc.lineWidth=2.6*z;fc.globalAlpha=.85*fade;fc.stroke();
    if(planeShape){fc.save();fc.translate(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);fc.rotate(Math.atan2(b.y-a.y,b.x-a.x));fc.scale(.84*z,.84*z);fc.translate(-12,-12);
     fc.globalAlpha=fade;fc.fillStyle=pal.plane;fc.fill(planeShape);fc.restore()}
   }
   const s=pts[first];
   if(first===0&&cyc<.2){fc.globalAlpha=.75*(1-cyc/.2);fc.strokeStyle=pal.gold;fc.lineWidth=1.5;fc.beginPath();fc.arc(s.x,s.y,(3+17*cyc/.2)*z,0,TAU);fc.stroke()}
  });
  // Tashkent: the pulse and the pin
  const pulse=(t%2.8)/2.8;
  if(!still){fc.globalAlpha=.55*(1-pulse);fc.strokeStyle=pal.gold;fc.lineWidth=1.4;fc.beginPath();fc.arc(tP.x,tP.y,(6+22*pulse)*z,0,TAU);fc.stroke()}
  fc.globalAlpha=1;fc.fillStyle=pal.gold;fc.beginPath();fc.arc(tP.x,tP.y,5*z,0,TAU);fc.fill();fc.lineWidth=2;fc.strokeStyle=pal.ring;fc.stroke();
 };

 let raf=0,running=false,prev=0,last=0,clock=0;
 const tick=(now:number)=>{
  raf=requestAnimationFrame(tick);
  const dt=prev?Math.min(64,now-prev):0;prev=now;
  if(now-motion.scrollAt<180)return;   // the page is scrolling: stay on the last frame
  clock+=dt;if(now-last<31)return;last=now;frame(clock/1000);
 };
 frame(0);
 layer.globe={
  play(){if(still||running)return;running=true;prev=0;raf=requestAnimationFrame(tick)},
  pause(){running=false;cancelAnimationFrame(raf)},
  stop(){running=false;cancelAnimationFrame(raf)},
 };
 if(layer.el.dataset.live==='1')layer.globe.play();
}

// The delivery skies: one over sheets 2 and 3 (1200 x 1400, a sheet is half), one over sheets 4, 5 and 6 (1200 x 2100,
// a sheet is a third; owner, 7.10.2026: "the comets on 4, 5, 6 too"). Routes cross the seams, so one leaving a sheet
// comes in at the top of the next. Sparks: left %, top % of the whole sky, size, delay, gold. Comets: route index, run
// time and delay in seconds, gold.
type Sky={chapters:HomeChapter[];space:number;routes:string[];sparks:[number,number,number,number,boolean][];comets:[number,number,number,boolean][]};
const skies:Sky[]=[
 {chapters:['how','finds'],space:1400,
  routes:['M-40 150 C 260 30, 720 60, 1240 250','M1240 360 C 860 560, 240 520, 210 760 S 720 1090, 1240 1030','M-40 560 C 300 650, 540 860, 900 770 S 1180 650, 1240 700','M180 640 C 420 960, 800 1000, 1080 640','M-40 1330 C 380 1210, 820 1420, 1240 1250'],
  sparks:[[3,6,8,0,false],[16,2,6,2.6,true],[52,3,7,4.2,false],[94,7,8,1.4,true],[5,31,7,3.4,false],[96,28,6,5.2,true],
   [2,46,8,1.9,false],[97,52,7,3.9,true],[40,49,6,.7,false],[63,51,7,4.8,true],[4,72,6,2.2,true],[95,76,8,.3,false],[18,97,6,3.1,false],[48,98,7,1.2,true],[80,96,6,4.4,false]],
  comets:[[0,7,0,false],[1,9,2.5,true],[2,11,5,false],[3,12.5,5.1,false],[4,14,6.8,false]]},
 {chapters:['tariffs','trust','faq'],space:2100,
  routes:['M-40 110 C 320 10, 820 50, 1240 190','M1240 520 C 880 760, 300 600, 110 880 S 520 1250, 1240 1170','M-40 1330 C 280 1440, 680 1290, 980 1470 S 1180 1610, 1240 1590',
   'M160 1250 C 480 1620, 860 1760, 1240 1890','M-40 2010 C 400 1900, 820 2090, 1240 1950'],
  sparks:[[4,4,7,.4,false],[93,9,8,2.2,true],[60,2,6,3.6,false],[3,27,6,1.1,true],[97,30,7,4.4,false],[2,40,8,2.8,false],[95,44,6,.9,true],
   [45,34,6,3.9,false],[5,58,7,1.6,true],[96,63,8,3.2,false],[52,66,6,5,true],[3,82,6,.6,false],[94,86,7,2.5,true],[30,97,7,4.1,false],[72,98,6,1.8,true]],
  comets:[[0,8,.8,false],[1,11,3.2,true],[2,9.5,6,false],[3,12,1.6,false],[4,13.5,7.4,true]]},
];
/** The sky's clock: the comets of all sheets keep to it, so one leaving a sheet enters the next in time. */
let skyOrigin=0;
function drawSky(layer:Layer,sky:Sky,W:number,H:number,off:number,span:number){
 stopAnims(layer);
 const sx=W/1200,sy=span/sky.space,scale=(d:string)=>{let n=0;return d.replace(/-?\d*\.?\d+/g,v=>(n++%2?+v*sy:+v*sx).toFixed(1))};
 const svg=svgPart(layer,'hw-decor-sky');
 svg.setAttribute('viewBox',`0 ${off.toFixed(1)} ${W} ${H.toFixed(1)}`);
 Object.assign(svg.style,{left:'0px',top:'0px',width:`${W}px`,height:`${H}px`});svg.replaceChildren();
 sky.routes.forEach((route,k)=>{const g=svgEl('g',{class:`sky-route r${k}`},svg);svgEl('path',{class:'sky-route-dots',d:scale(route)},g)});
 const sparks=part(layer,'hw-decor-sky-sparks',()=>document.createElement('div'));sparks.replaceChildren();
 Object.assign(sparks.style,{left:'0px',top:'0px',width:`${W}px`,height:`${H}px`});
 for(const [x,y,size,delay,gold] of sky.sparks){
  const top=y/100*span-off;if(top<0||top>H)continue;
  const i=document.createElement('i');i.className='sky-spark'+(gold?' gold':'');
  Object.assign(i.style,{left:`${x}%`,top:`${top.toFixed(0)}px`,width:`${size*1.4}px`,height:`${size*1.4}px`,animationDelay:`${delay}s`});sparks.appendChild(i);
 }
 // A comet of light along each route (was a stroke-dashoffset pulse, which the browser recomputed and repainted on the
 // main thread every frame): the route is sampled once into transform keyframes, so the comet runs on the compositor.
 // Web Animations on the sky's shared clock.
 const routePaths=[...svg.querySelectorAll<SVGPathElement>('.sky-route-dots')];
 for(const [k,run,delay,gold] of sky.comets){
  const path=routePaths[k];if(!path?.getTotalLength)continue;
  const frames=cometKeyframes(path,(x,y)=>[x,y-off]);
  const c=document.createElement('i');c.className='sky-comet'+(gold?' gold':'');sparks.appendChild(c);
  const a=c.animate(frames,{duration:run*1000,delay:delay*1000,iterations:Infinity});
  a.id='sky';a.startTime=skyOrigin;layer.anims.push(a);
  if(layer.el.dataset.live!=='1')a.pause();
 }
}

function startDecor(root:HTMLDivElement):Engine{
 const main=root.closest<HTMLElement>('main.catalog-home');
 const ac=new AbortController(),on={signal:ac.signal,passive:true};
 const layers=new Map<HomeChapter,Layer>(),byEl=new WeakMap<Element,Layer>(),watched=new Set<Element>();
 const wide=matchMedia(homeWideMedia.wide),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let raf=0,stopped=false,labels:Labels={regions:homeCopy.ru.tariffs.regions,to:homeCopy.ru.example.to};
 const schedule=()=>{if(!stopped&&!raf)raf=requestAnimationFrame(render)};
 const idle=(f:()=>void)=>{if(typeof requestIdleCallback==='function')requestIdleCallback(f,{timeout:1500});else setTimeout(f,400)};
 const idleWait=new Set<Layer>(),idleDraw=new Set<Layer>();
 // Parcels and the pulse run only while their sheet is on screen
 const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries){
  const layer=byEl.get(e.target);if(!layer)continue;
  layer.el.dataset.live=e.isIntersecting?'1':'0';
  for(const a of layer.anims){if(!e.isIntersecting)a.pause();else if(a.id==='sky')a.startTime=skyOrigin;else a.play()}
  if(e.isIntersecting)layer.globe?.play();else layer.globe?.pause();
 }},{rootMargin:'-2px 0px'}):null;   // a sheet only touching the screen's edge is not on it
 // The map is drawn only within half a window of the screen: a load, a theme or language switch or a resize up top
 // never pays for it, and it is ready before the closing sheet scrolls in.
 const nearIo=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries){
  const layer=byEl.get(e.target);if(!layer)continue;
  layer.near=e.isIntersecting;if(layer.near)schedule();
 }},{rootMargin:'50% 0px'}):null;
 // CSS loops (the store ribbon, the sky's pulses, the FAQ chat) hold still on sheets off the screen: the pulses
 // animate stroke-dashoffset, which the browser recomputes on the main thread every frame, seen or not.
 const sheetIo=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)
  (e.target as HTMLElement).toggleAttribute('data-offscreen',!e.isIntersecting)},{rootMargin:'-2px 0px'}):null;
 if(main)for(const el of main.querySelectorAll<HTMLElement>(':scope > [data-chapter]'))sheetIo?.observe(el);
 ac.signal.addEventListener('abort',()=>{sheetIo?.disconnect();main?.querySelectorAll(':scope > [data-offscreen]').forEach(el=>el.removeAttribute('data-offscreen'))});
 const ro=new ResizeObserver(schedule);
 const layerFor=(chapter:HomeChapter)=>{
  let layer=layers.get(chapter);if(layer)return layer;
  const el=document.createElement('div');el.className='hw-decor-layer';el.dataset.chapter=chapter;el.dataset.live=io?'0':'1';
  const glow=document.createElement('div');glow.className='hw-decor-glow';el.appendChild(glow);root.appendChild(el);
  layer={el,glow,anims:[],mapKey:'',glowKey:'',skyKey:'',near:!nearIo};layers.set(chapter,layer);byEl.set(el,layer);io?.observe(el);
  if(chapter==='end')nearIo?.observe(el);
  return layer;
 };
 const dropLayer=(chapter:HomeChapter,layer:Layer)=>{stopAnims(layer);io?.unobserve(layer.el);nearIo?.unobserve(layer.el);layer.el.remove();layers.delete(chapter)};
 const setGlow=(layer:Layer,value:string)=>{if(layer.glowKey!==value){layer.glowKey=value;layer.glow.style.background=value}};

 function render(){
  raf=0;
  if(stopped||!main||!wide.matches)return;
  // Reads first (one layout), then writes
  const vw=document.documentElement.clientWidth,m=main.getBoundingClientRect(),zoom=homeWideZoom(),z=Math.max(1,zoom);
  const rail=document.querySelector<HTMLElement>('[data-home-rail]');
  const railBox=rail&&getComputedStyle(rail).display!=='none'?rail.getBoundingClientRect():null;
  const seen=new Set<HomeChapter>(),sheets:{chapter:HomeChapter;el:HTMLElement}[]=[];
  for(const el of main.querySelectorAll<HTMLElement>('[data-chapter]')){
   const chapter=el.dataset.chapter as HomeChapter;
   if(root.contains(el)||!homeChapters.includes(chapter)||seen.has(chapter))continue;
   seen.add(chapter);sheets.push({chapter,el});
  }
  const plans=sheets.map(({chapter,el})=>{
   const S=el.getBoundingClientRect();
   const rel=(r:DOMRect):Box=>({left:r.left,right:r.right,top:r.top-S.top,bottom:r.bottom-S.top,width:r.width,height:r.height});
   const targets=[...el.querySelectorAll<HTMLElement>(sheetTarget[chapter])];
   const blocks=targets.map(n=>rel(n.getBoundingClientRect())).filter(b=>b.width&&b.height);
   const foot=chapter==='end'?el.querySelector<HTMLElement>('.home-footer'):null;
   // A sheet keeps its height while its blocks change size (logos and fonts load, the theme changes, an answer opens)
   // and move inside it: the blocks are watched too.
   return {chapter,S,col:rel(S),blocks,foot:foot?rel(foot.getBoundingClientRect()).top:S.height,watch:[el,...targets,...(foot?[foot]:[])]};
  });
  const rootTop=m.top+main.clientTop,still=reduce.matches;

  // Watch the sheets present now and their blocks (the selection arrives later, an FAQ answer opens), forget the ones that are gone
  const want=new Set<Element>(plans.flatMap(plan=>plan.watch));
  for(const el of watched)if(!want.has(el)){ro.unobserve(el);watched.delete(el)}
  for(const el of want)if(!watched.has(el)){watched.add(el);ro.observe(el)}
  root.style.left=`${-(m.left+main.clientLeft)}px`;root.style.width=`${vw}px`;
  for(const [chapter,layer] of layers)if(!seen.has(chapter))dropLayer(chapter,layer);
  for(const {chapter,S,col,blocks,foot} of plans){
   const layer=layerFor(chapter),W=vw,H=S.height;
   layer.el.style.top=`${(S.top-rootTop).toFixed(2)}px`;layer.el.style.height=`${H.toFixed(2)}px`;
   if(!W||!H)continue;
   if(chapter==='end'){
    const card=blocks[0];
    if(!card){stopAnims(layer);dropParts(layer,'hw-decor-globe','hw-decor-globe-fx','hw-decor-pins');layer.mapKey='';setGlow(layer,'');continue}
    const clipL=railBox&&railBox.width?Math.max(railBox.right+24,col.left-40):0;
    const key=[W,H,col.left,col.right,card.left,card.right,card.top,card.bottom,foot,clipL].map(v=>Math.round(v)).join()+`|${zoom}|${still}|${document.documentElement.dataset.theme}|${labels.to}|${Object.values(labels.regions).join()}`;
    // Redraw (and restart the parcels) only when the geometry, the labels or the motion setting changed, and only near
    // the screen: far off it the old drawing (or none) waits, and nearIo schedules the redraw on the way in.
    // On screen: now. Near it (the sheet before): when the page is idle, so the globe's first paint never lands in
    // the middle of the move to the last sheet.
    if(layer.mapKey!==key&&layer.near&&(layer.el.dataset.live==='1'||idleDraw.has(layer))){idleDraw.delete(layer);layer.mapKey=key;drawMap(layer,W,H,col,card,foot,clipL,zoom,labels,still)}
    else if(layer.mapKey!==key&&layer.near){if(!idleWait.has(layer)){idleWait.add(layer);idle(()=>{idleWait.delete(layer);idleDraw.add(layer);schedule()})}}
    else if(!layer.near&&card.top>=300){
     // Far from the screen: compute the globe's dot field while the page is idle, so the way in never pays for it
     const R=Math.max(240,Math.min((card.top-90)/.8,col.width*.43,620*z)),step=5.6*z/R/(Math.PI/180);
     idle(()=>{if(!stopped)sphereDots(step)});
    }
    const gx=(col.left+col.right)/2;
    setGlow(layer,[pool('var(--hwd-mint)',W*.5,H*.36,gx,Math.max(0,card.top-H*.16)),pool('var(--hwd-mint-2)',W*.44,H*.26,gx,card.bottom)].join(','));
    continue;
   }
   // A medallion centred in the right field: full (two orbits) with 64px to the content and the window edge,
   // compact (one orbit) with 36px where the field is narrower, or none — then only the mint pool.
   const mr=W-col.right,art=sheetArt[chapter];
   const bt=blocks.length?Math.min(...blocks.map(b=>b.top)):col.top,bb=blocks.length?Math.max(...blocks.map(b=>b.bottom)):col.bottom;
   let kind:''|'full'|'compact'='',size=0;
   if(art){
    const full=Math.min(220*z,(mr-128)*200/(decorOrbit2*2)),compact=Math.min(170*z,(mr-72)*200/197);
    if(full>=150){kind='full';size=full}else if(compact>=116){kind='compact';size=compact}
   }
   const mx=col.right+mr/2,reach=kind?size*(kind==='full'?decorOrbit2*2:197)/200:0;
   const my=Math.min(Math.max((bt+bb)/2,reach/2+8),H-reach/2-8);
   if(art&&kind){
    const medal=svgPart(layer,'hw-decor-medal');
    medal.setAttribute('viewBox','0 0 200 200');medal.classList.add('hw-decor-art');
    if(medal.dataset.art!==art+kind){medal.innerHTML=decorMedal(art,kind==='full');medal.dataset.art=art+kind}
    Object.assign(medal.style,{left:`${(mx-size/2).toFixed(1)}px`,top:`${(my-size/2).toFixed(1)}px`,width:`${size.toFixed(1)}px`,height:`${size.toFixed(1)}px`});
   }else dropParts(layer,'hw-decor-medal');
   // One soft pool in the right field (behind the medallion, if any), a fainter one behind the content
   setGlow(layer,[pool('var(--hwd-mint)',W*.3,H*.5,mx,my),pool('var(--hwd-mint-2)',W*.26,H*.4,col.left+col.width*.3,bt+(bb-bt)*.4)].join(','));
  }
  // The delivery skies (owner, 7.10.2026: "the effects of sheet 3 on sheet 2 too, and joined up"): one set of routes in
  // the window space of its sheets, each layer showing its slice. A sky's layers redraw together, on the shared clock.
  for(const sky of skies){
   const own=sky.chapters.map(ch=>plans.find(p=>p.chapter===ch));
   if(own.some(p=>!p))continue;
   const list=own as NonNullable<typeof own[number]>[],top=list[0].S.top,span=list[list.length-1].S.bottom-top;
   const parts=list.map(p=>({layer:layerFor(p.chapter),off:p.S.top-top,H:p.S.height}));
   const key=`${vw}|${Math.round(span)}|${parts.map(p=>`${Math.round(p.off)}:${Math.round(p.H)}`).join()}`;
   if(parts.some(p=>p.layer.skyKey!==key)){
    if(!skyOrigin)skyOrigin=Number(document.timeline.currentTime)||0;
    for(const {layer,off,H} of parts){layer.skyKey=key;drawSky(layer,sky,vw,H,off,span)}
   }
  }
 }

 if(main)ro.observe(main);
 window.addEventListener('scroll',()=>{motion.scrollAt=performance.now()},on);
 // The globe paints its colours into the canvas: a theme switch redraws it
 const themeMo=new MutationObserver(schedule);themeMo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 ac.signal.addEventListener('abort',()=>themeMo.disconnect());
 window.addEventListener('resize',schedule,on);
 window.addEventListener(homeWideLayoutEvent,schedule,on);
 reduce.addEventListener('change',schedule,on);
 wide.addEventListener('change',schedule,on);
 void document.fonts?.ready.then(schedule);
 schedule();
 return {
  setLabels(next){labels=next;schedule()},
  stop(){
   stopped=true;ac.abort();cancelAnimationFrame(raf);raf=0;ro.disconnect();io?.disconnect();nearIo?.disconnect();watched.clear();
   for(const layer of layers.values())stopAnims(layer);
   layers.clear();root.replaceChildren();root.style.removeProperty('left');root.style.removeProperty('width');
  },
 };
}

/** The decor root, the last child of main.catalog-home; mounted only on wide screens (homeWideMedia.wide). */
export function HomeDecor(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 const root=useRef<HTMLDivElement>(null),engine=useRef<Engine|null>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const decor=startDecor(el);engine.current=decor;
  return ()=>{engine.current=null;decor.stop()};
 },[]);
 // Map labels come from the copy (not the page): the tariff country names and the example's destination
 useEffect(()=>{const c=homeCopy[locale]??homeCopy.ru;engine.current?.setLabels({regions:c.tariffs.regions,to:c.example.to})},[locale]);
 return <div className="hw-decor" aria-hidden="true" ref={root}/>;
}
