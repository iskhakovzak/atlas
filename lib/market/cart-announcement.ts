import {ruPlural} from './format.ts';
import {isUzbek,type Locale} from './i18n.ts';
import {uzText} from './uz-cyrl.ts';

/** "В корзине 2 товара" / "Savatda 2 ta tovar" / "2 items in your cart"; "Корзина пуста" at zero. */
export function cartAnnouncement(count:number,locale:Locale){
  if(locale==='ru')return count?`В корзине ${count} ${ruPlural(count,['товар','товара','товаров'])}`:'Корзина пуста';
  if(isUzbek(locale))return uzText(locale,count?`Savatda ${count} ta tovar`:'Savat bo‘sh');
  return count?`${count} ${count===1?'item':'items'} in your cart`:'Your cart is empty';
}
