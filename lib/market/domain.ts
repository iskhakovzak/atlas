export const money=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' сум';
export type Product={id:string;name:string;brand:string;category:string;usd:number;weight:number;image:string;variants:string[]};
export const products:Product[]=[
{id:'sneaker',name:'Кроссовки на каждый день',brand:'Обувь · США',category:'Обувь',usd:99,weight:2.1,image:'/images/sneaker.jpg',variants:['US 8','US 9','US 10','US 11']},
{id:'headphones',name:'Беспроводные наушники',brand:'Аудио · США',category:'Электроника',usd:129,weight:.7,image:'/images/headphones.jpg',variants:['Чёрный','Светлый']},
{id:'backpack',name:'Городской рюкзак',brand:'Аксессуары · США',category:'Аксессуары',usd:65,weight:1.2,image:'/images/backpack.jpg',variants:['Стандартный']}
];
export const tariff={fx:12800,perKg:90000,margin:.12,reserve:.2,version:'demo-1'};
export type Quote={id:string;createdAt:number;expiresAt:number;merchandise:number;service:number;shipping:number;reserve:number;total:number;weight:number;tariffVersion:string};
export function quote(usd:number,weight:number,now=Date.now()):Quote {if(!Number.isFinite(usd)||!Number.isFinite(weight)||usd<=0||usd>10000||weight<=0||weight>50)throw Error('Проверьте цену и вес');const merchandise=Math.round(usd*tariff.fx),service=Math.round(merchandise*tariff.margin),shipping=Math.ceil(weight*tariff.perKg),reserve=Math.ceil(shipping*tariff.reserve);return {id:crypto.randomUUID(),createdAt:now,expiresAt:now+15*60000,merchandise,service,shipping,reserve,total:merchandise+service+shipping+reserve,weight,tariffVersion:tariff.version};}
export const statuses=['Ожидает выкупа','Выкуплен','На складе США','Готов к отправке','В пути','Доставлен'];
export type Settlement={actualWeight:number;dimensionalWeight:number;chargeableWeight:number;shipping:number;refund:number;extra:number};
export function settle(q:Quote,w:number,l:number,h:number,d:number):Settlement {if([w,l,h,d].some(n=>!Number.isFinite(n)||n<=0)||w>100||Math.max(l,h,d)>300)throw Error('Введите корректный вес и размеры');const dimensionalWeight=l*h*d/5000,chargeableWeight=Math.max(w,dimensionalWeight),shipping=Math.ceil(chargeableWeight*tariff.perKg),diff=q.shipping+q.reserve-shipping;return {actualWeight:w,dimensionalWeight,chargeableWeight,shipping,refund:Math.max(0,diff),extra:Math.max(0,-diff)};}
export type Order={id:string;product:Product;variant:string;quote:Quote;status:number;createdAt:number;history:{at:number;text:string}[];settlement?:Settlement;extraApproved?:boolean};
export type Entry={id:string;orderId:string;at:number;amount:number;debit:string;credit:string;description:string};
export type State={orders:Order[];entries:Entry[]};
