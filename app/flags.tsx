import {useId,type ReactNode} from 'react';
import type {DeliveryRegion} from '@/lib/market/site-content';
import type {StoreCountry} from '@/lib/market/store-brands';
import {storeGeo} from '@/lib/market/store-geo';

/**
 * Inline SVG flags for the delivery regions, 24×16 with rounded corners. Emoji flags are not used: Windows
 * renders them as letter pairs. The flags are decorative; the country name always stands next to them as text.
 */
const starPoints=(cx:number,cy:number,r:number,rotate=0)=>{
 const points:string[]=[];
 for(let i=0;i<10;i++){
  const radius=i%2===0?r:r*0.42;
  const angle=(-90+i*36+rotate)*Math.PI/180;
  points.push(`${(cx+radius*Math.cos(angle)).toFixed(2)},${(cy+radius*Math.sin(angle)).toFixed(2)}`);
 }
 return points.join(' ');
};

const flags:Record<DeliveryRegion,ReactNode>={
 us:<>
  <rect width="24" height="16" fill="#fff"/>
  {[0,2,4,6,8,10,12].map(i=><rect key={i} y={i*16/13} width="24" height={16/13} fill="#b22234"/>)}
  <rect width="10.4" height="8.6" fill="#3c3b6e"/>
  {[1.3,3.9,6.5,9.1].flatMap(x=>[1.4,4.3,7.2].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r=".55" fill="#fff"/>))}
  {[2.6,5.2,7.8].flatMap(x=>[2.85,5.75].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r=".55" fill="#fff"/>))}
 </>,
 uk:<>
  <rect width="24" height="16" fill="#012169"/>
  <path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" strokeWidth="3.2"/>
  <path d="M0 0 L24 16 M24 0 L0 16" stroke="#c8102e" strokeWidth="1.1"/>
  <path d="M12 0 V16 M0 8 H24" stroke="#fff" strokeWidth="5"/>
  <path d="M12 0 V16 M0 8 H24" stroke="#c8102e" strokeWidth="3"/>
 </>,
 cn:<>
  <rect width="24" height="16" fill="#de2910"/>
  <polygon points={starPoints(4.5,4.6,2.6)} fill="#ffde00"/>
  <polygon points={starPoints(9,1.8,0.85,20)} fill="#ffde00"/>
  <polygon points={starPoints(10.8,3.6,0.85,40)} fill="#ffde00"/>
  <polygon points={starPoints(10.8,6.2,0.85,0)} fill="#ffde00"/>
  <polygon points={starPoints(9,8,0.85,-20)} fill="#ffde00"/>
 </>,
 de:<>
  <rect width="24" height="16" fill="#ffce00"/>
  <rect width="24" height="10.67" fill="#dd0000"/>
  <rect width="24" height="5.33" fill="#000"/>
 </>,
 it:<>
  <rect width="24" height="16" fill="#fff"/>
  <rect width="8" height="16" fill="#009246"/>
  <rect x="16" width="8" height="16" fill="#ce2b37"/>
 </>,
 es:<>
  <rect width="24" height="16" fill="#aa151b"/>
  <rect y="4" width="24" height="8" fill="#f1bf00"/>
 </>,
};

/** Three equal vertical bands, left to right. */
const vertical=(left:string,middle:string,right:string)=><>
 <rect width="24" height="16" fill={middle}/>
 <rect width="8" height="16" fill={left}/>
 <rect x="16" width="8" height="16" fill={right}/>
</>;
/** Three equal horizontal bands, top to bottom. */
const horizontal=(top:string,middle:string,bottom:string)=><>
 <rect width="24" height="16" fill={middle}/>
 <rect width="24" height="5.33" fill={top}/>
 <rect y="10.67" width="24" height="5.33" fill={bottom}/>
</>;
/** Nordic cross: the upright sits left of centre. */
const nordic=(field:string,cross:string)=><>
 <rect width="24" height="16" fill={field}/>
 <rect x="7" width="3" height="16" fill={cross}/>
 <rect y="6.5" width="24" height="3" fill={cross}/>
</>;

/** Simple flags of store countries Atlas has no dispatch region for yet; the rest fall back to the two-letter code. */
const countryFlags:Partial<Record<StoreCountry,ReactNode>>={
 fr:vertical('#0055a4','#fff','#ef4135'),
 ie:vertical('#169b62','#fff','#ff883e'),
 be:vertical('#000','#fdda24','#ef3340'),
 nl:horizontal('#ae1c28','#fff','#21468b'),
 at:horizontal('#ed2939','#fff','#ed2939'),
 pl:<>
  <rect width="24" height="16" fill="#dc143c"/>
  <rect width="24" height="8" fill="#fff"/>
 </>,
 se:nordic('#006aa7','#fecc00'),
 dk:nordic('#c8102e','#fff'),
 ch:<>
  <rect width="24" height="16" fill="#da291c"/>
  <rect x="10.75" y="3" width="2.5" height="10" fill="#fff"/>
  <rect x="7" y="6.75" width="10" height="2.5" fill="#fff"/>
 </>,
 jp:<>
  <rect width="24" height="16" fill="#fff"/>
  <circle cx="12" cy="8" r="4.8" fill="#bc002d"/>
 </>,
};

function FlagFrame({id,className,children}:{id:string;className?:string;children:ReactNode}){
 return <svg className={className?`flag ${className}`:'flag'} width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
  <defs><clipPath id={id}><rect width="24" height="16" rx="3"/></clipPath></defs>
  <g clipPath={`url(#${id})`}>{children}</g>
  <rect width="24" height="16" rx="3" fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1"/>
 </svg>;
}

export function Flag({region,className}:{region:DeliveryRegion;className?:string}){
 // useId: the same flag may appear several times on a page, and duplicate clipPath ids would break clipping.
 const id=`flag-${region}-${useId().replace(/[^a-zA-Z0-9]/g,'')}`;
 return <FlagFrame id={id} className={className}>{flags[region]}</FlagFrame>;
}

/**
 * Flag of a store country: the region flag for the six dispatch countries, a drawn flag for the other European
 * and Japanese storefronts, and the two-letter code on a soft field for the rest. Decorative: the country name
 * always stands next to it as text.
 */
export function CountryFlag({code,className}:{code:StoreCountry;className?:string}){
 const id=`flag-${code}-${useId().replace(/[^a-zA-Z0-9]/g,'')}`;
 const region=storeGeo[code]?.region;
 const art=region?flags[region]:countryFlags[code];
 if(art) return <FlagFrame id={id} className={className}>{art}</FlagFrame>;
 return <FlagFrame id={id} className={className?`flag-code ${className}`:'flag-code'}>
  <rect width="24" height="16" fill="var(--cat-soft)"/>
  <text x="12" y="8.6" textAnchor="middle" dominantBaseline="middle" fontFamily="inherit" fontSize="8" fontWeight="700" letterSpacing=".4" fill="var(--cat-muted)">{code.toUpperCase()}</text>
 </FlagFrame>;
}
