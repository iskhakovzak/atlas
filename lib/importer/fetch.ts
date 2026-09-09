import {extractProduct} from './extract.ts';
import {isSupportedStoreHost,supportedStoreCount} from './stores.ts';
export {supportedStoreCount};
export function allowedUrl(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!isSupportedStoreHost(u.hostname))throw Error('Этот магазин пока не в списке поддерживаемых. Вставьте ссылку из одного из '+supportedStoreCount+' магазинов или заполните товар вручную.');return u;}
export async function fetchProduct(value:string){let url=allowedUrl(value);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{
 let response:Response|undefined;for(let i=0;i<4;i++){response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9','Cache-Control':'no-cache'}});if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location||i===3)throw Error('Магазин перенаправляет запрос. Используйте прямую ссылку на товар.');url=allowedUrl(new URL(location,url).href);continue}break}
 if(!response?.ok)throw Error('Магазин не разрешил загрузить страницу. Заполните данные вручную.');
 if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();throw Error('По ссылке нет HTML-страницы товара.')}
 const reader=response.body?.getReader();if(!reader)throw Error('Пустая страница');let size=0;let html='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3_000_000){await reader.cancel();throw Error('Страница слишком большая для автозагрузки. Заполните данные вручную.')}html+=decoder.decode(value,{stream:true})}html+=decoder.decode();
 if(/captcha|verify you are human|pardon our interruption|robot check/i.test(html.slice(0,60000)))throw Error('Магазин запросил проверку посетителя. Используйте ручной ввод.');
 return extractProduct(html,url.href);
 }finally{clearTimeout(timer)}}
