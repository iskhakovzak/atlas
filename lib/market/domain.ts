import { z } from 'zod';
import {customsVersion} from './world.ts';

export const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' сум';
const positive = z.number().finite().positive();
const amount = z.number().int().nonnegative();
export const productSchema = z.object({
  id: z.string(), name: z.string().min(1).max(140), brand: z.string(), category: z.string(),
  usd: positive.max(10000), weight: positive.max(50), image: z.string(), variants: z.array(z.string()).min(1),
  sourceUrl: z.string().optional(), description: z.string().optional(),
  country:z.string().optional(), sourceCurrency:z.string().optional(), sourcePrice:z.number().nonnegative().optional(), sourceShippingUsd:z.number().nonnegative().optional(), sourceShipping:z.number().nonnegative().optional(), shippingKnown:z.boolean().optional(), boxedWeight:positive.optional(), weightOrigin:z.string().optional(), importedAt:amount.optional(), imageOrigin:z.string().optional(),
});
export type Product = z.infer<typeof productSchema>;
export const products: Product[] = [
  {id:'sneaker',country:'США',boxedWeight:1.6, name:'Кроссовки на каждый день', brand:'Обувь · США', category:'Обувь', usd:99, weight:2.1, image:'/images/sneaker.jpg', variants:['US 8','US 9','US 10','US 11'], description:'Спокойный силуэт для повседневного гардероба. Выберите размер и посмотрите, как складывается цена с доставкой.'},
  {id:'headphones',country:'Германия',boxedWeight:.2, name:'Беспроводные наушники', brand:'Аудио · Европа', category:'Электроника', usd:129, weight:.7, image:'/images/headphones.jpg', variants:['Чёрный','Светлый'], description:'Для любимой музыки и рабочего ритма. В этом примере можно пройти покупку электроники из зарубежного магазина.'},
  {id:'backpack',country:'Испания',boxedWeight:.7, name:'Городской рюкзак', brand:'Аксессуары · Европа', category:'Аксессуары', usd:65, weight:1.2, image:'/images/backpack.jpg', variants:['Стандартный'], description:'Один рюкзак для повседневных планов. Изучите расчёт покупки и доставки до оформления заказа.'},
];
export const tariff = {fx:12800, perKg:90000, margin:.12, reserve:.2, divisor:5000, version:'demo-1' as const};
const quoteSchema = z.object({id:z.string(), createdAt:amount, expiresAt:amount, merchandise:amount, service:amount, shipping:amount, reserve:amount, total:amount, weight:positive, tariffVersion:z.literal('demo-1'), perKg:positive.optional(), divisor:positive.optional(), sourceShipping:amount.optional()});
export type Quote = z.infer<typeof quoteSchema>;
export function price(usd:number, weight:number, quantity=1, sourceShippingUsd=0) {
  if (!Number.isFinite(usd)||usd<=0||usd>10000||!Number.isFinite(weight)||weight<=0||weight>50||!Number.isInteger(quantity)||quantity<1||quantity>10) throw Error('Проверьте цену, вес и количество (от 1 до 10).');
  if(!Number.isFinite(sourceShippingUsd)||sourceShippingUsd<0||sourceShippingUsd>10000)throw Error('Проверьте доставку магазина.');
  const sourceShipping=Math.ceil(sourceShippingUsd*quantity*tariff.fx);
  const merchandise=Math.round(usd*quantity*tariff.fx), service=Math.round(merchandise*tariff.margin), shipping=Math.ceil(weight*quantity*tariff.perKg), reserve=Math.ceil(shipping*tariff.reserve);
  return {merchandise,service,shipping,reserve,sourceShipping,total:merchandise+service+shipping+reserve+sourceShipping,weight:weight*quantity};
}
export function quote(usd:number, weight:number, now=Date.now(), quantity=1, sourceShippingUsd=0):Quote {
  return {id:crypto.randomUUID(),createdAt:now,expiresAt:now+15*60000,...price(usd,weight,quantity,sourceShippingUsd),tariffVersion:tariff.version,perKg:tariff.perKg,divisor:tariff.divisor};
}
const settlementSchema=z.object({actualWeight:positive,dimensionalWeight:positive,chargeableWeight:positive,shipping:amount,refund:amount,extra:amount,dimensions:z.array(positive).length(3).optional()});
export type Settlement=z.infer<typeof settlementSchema>;
export function settle(q:Quote,w:number,l:number,h:number,d:number):Settlement {
  if([w,l,h,d].some(n=>!Number.isFinite(n)||n<=0)||w>500||Math.max(l,h,d)>300)throw Error('Введите вес до 500 кг и размеры до 300 см. Все значения должны быть больше нуля.');
  const dimensionalWeight=l*h*d/(q.divisor??5000),chargeableWeight=Math.max(w,dimensionalWeight),shipping=Math.ceil(chargeableWeight*(q.perKg??90000)),diff=q.shipping+q.reserve-shipping;
  return {actualWeight:w,dimensionalWeight,chargeableWeight,shipping,refund:Math.max(0,diff),extra:Math.max(0,-diff),dimensions:[l,h,d]};
}
export const statuses=['Ожидает выкупа','Выкуплен','На складе США','Готов к отправке','В пути','Доставлен'];
const historySchema=z.object({at:amount,text:z.string()});
const orderSchema=z.object({id:z.string(),product:productSchema,variant:z.string(),quote:quoteSchema,status:z.number().int().min(0).max(5),createdAt:amount,history:z.array(historySchema),settlement:settlementSchema.optional(),extraApproved:z.boolean().optional(),quantity:z.number().int().min(1).max(10).default(1),cancelled:z.boolean().default(false),batchId:z.string().optional(),balanceUsed:amount.default(0),customsConsent:z.object({version:z.string(),acceptedAt:amount}).optional()});
export type Order=z.infer<typeof orderSchema>;
const entrySchema=z.object({id:z.string(),orderId:z.string(),at:amount,amount:amount,debit:z.string(),credit:z.string(),description:z.string()});
export type Entry=z.infer<typeof entrySchema>;
const cartSchema=z.object({id:z.string(),product:productSchema,variant:z.string(),quantity:z.number().int().min(1).max(10),quote:quoteSchema});
export type CartItem=z.infer<typeof cartSchema>;
export const stateSchema=z.object({orders:z.array(orderSchema),entries:z.array(entrySchema),cart:z.array(cartSchema).default([]),favorites:z.array(z.string()).default([]),checkoutKeys:z.array(z.string()).default([]),version:z.number().default(2)});
export type State=z.infer<typeof stateSchema>;
export const blank=():State=>({orders:[],entries:[],cart:[],favorites:[],checkoutKeys:[],version:2});
export const parseState=(raw:string):State=>stateSchema.parse(JSON.parse(raw));
export const balanceOf=(state:State)=>state.entries.reduce((sum,e)=>sum+(e.credit==='customer-credit'?e.amount:0)-(e.debit==='customer-credit'?e.amount:0),0);
export const totalOf=(items:CartItem[])=>items.reduce((sum,item)=>sum+item.quote.total,0);
export function addToCart(state:State,p:Product,variant:string,now=Date.now()):State {
  if(!p.variants.includes(variant))throw Error('Выберите вариант товара.');
  const item=state.cart.find(i=>i.product.id===p.id&&i.variant===variant);
  if(item)return changeQuantity(state,item.id,item.quantity+1,now);
  return {...state,cart:[...state.cart,{id:crypto.randomUUID(),product:p,variant,quantity:1,quote:quote(p.usd,p.weight,now,1,p.sourceShippingUsd??0)}]};
}
export function changeQuantity(state:State,id:string,quantity:number,now=Date.now()):State {
  const item=state.cart.find(i=>i.id===id);if(!item)throw Error('Товар уже удалён из корзины.');
  return {...state,cart:state.cart.map(i=>i.id===id?{...i,quantity,quote:quote(i.product.usd,i.product.weight,now,quantity,i.product.sourceShippingUsd??0)}:i)};
}
export function renewCart(state:State,now=Date.now()):State {return {...state,cart:state.cart.map(i=>({...i,quote:quote(i.product.usd,i.product.weight,now,i.quantity,i.product.sourceShippingUsd??0)}))};}
export const cartSignature=(items:CartItem[])=>items.map(i=>i.id+':'+i.quote.id).join('|');
export function checkoutCart(state:State,key:string,signature:string,useBalance:boolean,now=Date.now(),consentVersion?:string):State {
  if(state.checkoutKeys.includes(key))return state;
  if(!state.cart.length)throw Error('Корзина пуста.');
  if(consentVersion!==customsVersion)throw Error('Подтвердите таможенные условия.');
  if(state.cart.some(i=>i.product.sourceUrl&&i.product.shippingKnown!==true))throw Error('Уточните стоимость доставки магазина для каждого товара по ссылке.');
  if(cartSignature(state.cart)!==signature)throw Error('Корзина изменилась. Проверьте новый итог перед оформлением.');
  if(state.cart.some(i=>now>=i.quote.expiresAt))throw Error('Расчёт истёк. Обновите его перед оформлением.');
  let available=useBalance?Math.max(0,balanceOf(state)):0;
  const entries=[...state.entries];
  const orders=state.cart.map(i=>{
    const id='AT-'+crypto.randomUUID().slice(0,8).toUpperCase();const balanceUsed=Math.min(i.quote.total,available);available-=balanceUsed;
    if(balanceUsed)entries.push({id:'pay:'+id,orderId:id,at:now,amount:balanceUsed,debit:'customer-credit',credit:'order-funds',description:'Оплата заказа демобалансом'});
    return {id,product:i.product,variant:i.variant,quote:i.quote,quantity:i.quantity,createdAt:now,status:0,cancelled:false,balanceUsed,batchId:key,customsConsent:{version:customsVersion,acceptedAt:now},history:[{at:now,text:'Тестовый заказ оформлен. Сумма '+money(i.quote.total)+'. Ожидаем выкуп.'}]} as Order;
  });
  return {...state,cart:[],orders:[...orders,...state.orders],entries,checkoutKeys:[...state.checkoutKeys,key]};
}
const getOrder=(state:State,id:string)=>{const o=state.orders.find(o=>o.id===id);if(!o)throw Error('Заказ не найден.');return o};
const replace=(s:State,o:Order)=>({...s,orders:s.orders.map(x=>x.id===o.id?o:x)});
export function advanceOrder(state:State,id:string,expected:number,now=Date.now()):State {
  const o=getOrder(state,id);if(o.status!==expected)throw Error('Статус уже изменился. Проверьте заказ.');
  if(o.cancelled||o.status>=5||o.status===2||(o.settlement?.extra&&!o.extraApproved))throw Error('Этот переход пока недоступен.');
  if(o.status===3&&!o.settlement)throw Error('Сначала сохраните взвешивание.');
  return replace(state,{...o,status:o.status+1,history:[...o.history,{at:now,text:statuses[o.status+1]}]});
}
export function receiveOrder(state:State,id:string,dimensions:[number,number,number,number],now=Date.now()):State {
  const o=getOrder(state,id);if(o.settlement)return state;
  if(o.cancelled||o.status!==2)throw Error('Заказ ещё не готов к взвешиванию.');
  const s=settle(o.quote,...dimensions);
  const next=replace(state,{...o,settlement:s,status:3,history:[...o.history,{at:now,text:s.extra?'Взвешивание завершено. Требуется согласование доплаты '+money(s.extra):'Взвешивание завершено. Возврат остатка: '+money(s.refund)}]});
  if(s.refund)next.entries=[...state.entries,{id:'settlement:'+id,orderId:id,at:now,amount:s.refund,debit:'shipping-reserve',credit:'customer-credit',description:'Возврат остатка доставки'}];
  return next;
}
export function approveExtra(state:State,id:string,expectedAmount:number,now=Date.now()):State {
  const o=getOrder(state,id);if(o.extraApproved)return state;
  if(o.cancelled||!o.settlement?.extra||o.settlement.extra!==expectedAmount)throw Error('Сумма изменилась. Проверьте расчёт.');
  return replace(state,{...o,extraApproved:true,history:[...o.history,{at:now,text:'Покупатель подтвердил тестовую доплату '+money(o.settlement.extra)}]});
}
export function cancelOrder(state:State,id:string,now=Date.now()):State {
  const o=getOrder(state,id);if(o.cancelled)return state;
  if(o.status!==0)throw Error('Заказ уже выкуплен. Автоматическая отмена недоступна.');
  const next=replace(state,{...o,cancelled:true,history:[...o.history,{at:now,text:'Отменён до выкупа. Вся сумма возвращена на демобаланс.'}]});
  return {...next,entries:[...state.entries,{id:'cancel:'+id,orderId:id,at:now,amount:o.quote.total,debit:'order-funds',credit:'customer-credit',description:'Возврат отменённого заказа'}]};
}
export function validateSource(value:string):string {let url:URL;try{url=new URL(value)}catch{throw Error('Введите полную ссылку, начиная с https://.')}if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.hostname==='localhost'||/^\d[\d.]*$/.test(url.hostname))throw Error('Нужна HTTPS-ссылка на страницу магазина.');return url.toString();}
