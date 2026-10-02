import type {Order} from './domain';

export type SavedQuoteLine={key:string;label:string;amount:number};

export function summarizeSavedQuotes(orders:Order[]){
 const included=orders.filter(order=>!order.cancelled);
 const sum=(get:(order:Order)=>number)=>included.reduce((total,order)=>total+get(order),0);
 const lines:SavedQuoteLine[]=[
  {key:'merchandise',label:'Товары',amount:sum(order=>order.quote.merchandise)},
  {key:'service',label:'Сервис Atlas',amount:sum(order=>order.quote.service)},
  {key:'buyout',label:'Выкуп',amount:sum(order=>order.quote.buyout??0)},
  {key:'conversion',label:'Конвертация',amount:sum(order=>order.quote.conversion??0)},
  {key:'merchant-shipping',label:'Доставка магазина',amount:sum(order=>order.quote.sourceShipping??0)},
  {key:'international-shipping',label:'Международная доставка',amount:sum(order=>order.quote.shipping)},
  {key:'international-reserve',label:'Резерв международной доставки',amount:sum(order=>order.quote.reserve)},
  {key:'delivery-margin',label:'Маржа доставки',amount:sum(order=>order.quote.deliveryMargin??0)},
  {key:'optional-services',label:'Дополнительные услуги',amount:sum(order=>order.quote.optionalServices??0)},
 ];
 const paymentStates={pending:{count:0,amount:0},paid:{count:0,amount:0},refunded:{count:0,amount:0},unrecorded:{count:0,amount:0}};
 for(const order of included){
  const payment=order.payment;
  const key=payment?.status??'unrecorded';
  const bucket=paymentStates[key];
  bucket.count++;
  bucket.amount+=payment?.amount??0;
 }
 return{
  includedCount:included.length,
  cancelledCount:orders.length-included.length,
  quoteTotal:sum(order=>order.quote.total),
  atlasFees:lines.filter(line=>['service','buyout','conversion','delivery-margin','optional-services'].includes(line.key)).reduce((total,line)=>total+line.amount,0),
  lines,
  paymentStates,
 };
}
