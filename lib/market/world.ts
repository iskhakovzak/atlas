export const countries=['США','Испания','Германия','Великобритания','Франция','Италия','Румыния','Китай','Турция','Япония','Южная Корея','ОАЭ','Канада','Австралия','Другая страна'];
export const currencies=['USD','EUR','GBP','RON','CNY','TRY','JPY','KRW','AED','CAD','AUD'];
export const currencyForCountry=(country:string)=>({США:'USD',Испания:'EUR',Германия:'EUR',Великобритания:'GBP',Франция:'EUR',Италия:'EUR',Румыния:'RON',Китай:'CNY',Турция:'TRY',Япония:'JPY','Южная Корея':'KRW',ОАЭ:'AED',Канада:'CAD',Австралия:'AUD'} as Record<string,string>)[country];
// Illustrative exchange rates, not a market feed. USD→UZS is defined in tariff.
export const usdRates:Record<string,number>={USD:1,EUR:1.1,GBP:1.28,RON:.23,CNY:.14,TRY:.025,JPY:.0068,KRW:.00075,AED:.2723,CAD:.74,AUD:.66};
export function toUsd(value:number,currency:string,rates:Record<string,number>=usdRates){if(!Number.isFinite(value)||value<0||!rates[currency])throw Error('Проверьте сумму и валюту.');return Math.round(value*rates[currency]*100)/100}
export function combinedShipmentWeight(boxed:number){if(!Number.isFinite(boxed)||boxed<=0||boxed>5000)throw Error('Проверьте общий вес отправления.');return Math.max(1,Math.ceil((boxed+.3+.2)*100-1e-8)/100)}
export function paddedWeight(boxed:number){if(!Number.isFinite(boxed)||boxed<=0||boxed>49.5)throw Error('Укажите вес с коробкой от 0,01 до 49,5 кг.');return combinedShipmentWeight(boxed)}
export const countryName=(p:{country?:string})=>p.country??'США';
export const customsVersion='uz-personal-import-2026-09-09-v1';
export { customsReferences as customsSources } from './customs.ts';
