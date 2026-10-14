// A foreign store's own price in its own currency, for operator screens (buyout facts, batch import options).
import {intlLocale} from './uz-cyrl.ts';

/** "$49.90" / "49,90 €" in the screen locale; an unknown currency code falls back to "49.9 XYZ" instead of throwing. */
export function formatStorePrice(price:number,currency:string,locale:string){
 try{return new Intl.NumberFormat(intlLocale(locale),{style:'currency',currency}).format(price)}
 catch{return `${price} ${currency}`}
}
