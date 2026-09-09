import {z} from 'zod';
import {productSchema,parseState,addToCart,changeQuantity,renewCart,checkoutCart,advanceOrder,receiveOrder,approveExtra,cancelOrder,balanceOf,totalOf,validateSource,type State} from './domain.ts';
import {customsVersion,paddedWeight,toUsd} from './world.ts';
import {safeImage} from '../importer/extract.ts';
const id=z.string().max(5000),amount=z.number().finite().nonnegative();
export const actionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('favorite'),id}),z.object({type:z.literal('order-image'),id,image:z.string().max(5000)}),z.object({type:z.literal('cart-add'),product:productSchema,variant:z.string()}),z.object({type:z.literal('cart-quantity'),id,quantity:z.number().int().min(1).max(10)}),z.object({type:z.literal('cart-remove'),id}),z.object({type:z.literal('cart-renew')}),
 z.object({type:z.literal('checkout'),key:id,signature:z.string().max(100000),useBalance:z.boolean(),expectedCredit:amount,consentVersion:z.literal(customsVersion)}),
 z.object({type:z.literal('advance'),id,expected:z.number().int()}),z.object({type:z.literal('receive'),id,dimensions:z.tuple([z.number(),z.number(),z.number(),z.number()])}),z.object({type:z.literal('approve-extra'),id,amount}),z.object({type:z.literal('cancel'),id}),z.object({type:z.literal('import-legacy'),data:z.string().max(1000000)})]);
export type Action=z.infer<typeof actionSchema>;
export function applyAction(s:State,a:Action,isOperator:boolean):State {
 if((a.type==='advance'||a.type==='receive')&&!isOperator)throw Error('Доступно только оператору.');
 switch(a.type){
 case 'order-image':{const o=s.orders.find(o=>o.id===a.id);if(!o?.product.sourceUrl)throw Error('У заказа нет ссылки на источник.');const image=safeImage(a.image,o.product.sourceUrl);if(!image)throw Error('Изображение недоступно.');return {...s,orders:s.orders.map(x=>x.id===a.id?{...x,product:{...x.product,image,imageOrigin:'страница магазина'},history:[...x.history,{at:Date.now(),text:'Обновлено фото товара из источника.'}]}:x)}}
 case 'favorite':return {...s,favorites:s.favorites.includes(a.id)?s.favorites.filter(i=>i!==a.id):[...s.favorites,a.id]};
 case 'cart-add':{if(a.product.sourceUrl){if(a.product.boxedWeight===undefined||!a.product.country||!a.product.shippingKnown)throw Error('Укажите страну, вес с коробкой и доставку магазина.');a.product.sourceUrl=validateSource(a.product.sourceUrl);if(a.product.sourcePrice===undefined||a.product.sourceShipping===undefined||!a.product.sourceCurrency)throw Error('Укажите цену, валюту и доставку магазина.');a.product.usd=toUsd(a.product.sourcePrice,a.product.sourceCurrency);a.product.sourceShippingUsd=toUsd(a.product.sourceShipping,a.product.sourceCurrency);a.product.weight=paddedWeight(a.product.boxedWeight);if(a.product.image&&!safeImage(a.product.image,a.product.sourceUrl))throw Error('Некорректная ссылка на изображение.');}return addToCart(s,a.product,a.variant)}
 case 'cart-quantity':return changeQuantity(s,a.id,a.quantity);
 case 'cart-remove':return {...s,cart:s.cart.filter(i=>i.id!==a.id)};
 case 'cart-renew':return renewCart(s);
 case 'checkout':if(s.checkoutKeys.includes(a.key))return s;if((a.useBalance?Math.min(totalOf(s.cart),Math.max(0,balanceOf(s))):0)!==a.expectedCredit)throw Error('Баланс изменился. Проверьте итог заново.');return checkoutCart(s,a.key,a.signature,a.useBalance,Date.now(),a.consentVersion);
 case 'advance':return advanceOrder(s,a.id,a.expected);
 case 'receive':return receiveOrder(s,a.id,a.dimensions);
 case 'approve-extra':return approveExtra(s,a.id,a.amount);
 case 'cancel':return cancelOrder(s,a.id);
 case 'import-legacy':if(s.orders.length||s.entries.length||s.cart.length||s.favorites.length)throw Error('Импорт возможен только в пустой профиль.');return parseState(a.data);
 }
}
