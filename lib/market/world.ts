export const countries=['США','Испания','Германия','Великобритания','Франция','Италия','Румыния','Китай','Турция','Япония','Южная Корея','ОАЭ','Канада','Австралия','Другая страна'];
export const currencies=['USD','EUR','GBP','RON','CNY','TRY','JPY','KRW','AED','CAD','AUD'];
// Illustrative exchange rates, not a market feed. USD→UZS is defined in tariff.
export const usdRates:Record<string,number>={USD:1,EUR:1.1,GBP:1.28,RON:.23,CNY:.14,TRY:.025,JPY:.0068,KRW:.00075,AED:.2723,CAD:.74,AUD:.66};
export function toUsd(value:number,currency:string,rates:Record<string,number>=usdRates){if(!Number.isFinite(value)||value<0||!rates[currency])throw Error('Проверьте сумму и валюту.');return Math.round(value*rates[currency]*100)/100}
export function paddedWeight(boxed:number){if(!Number.isFinite(boxed)||boxed<=0||boxed>49.5)throw Error('Укажите вес с коробкой от 0,01 до 49,5 кг.');return Math.ceil((boxed+.3+.2)*100-1e-8)/100}
export const countryName=(p:{country?:string})=>p.country??'США';
export const customsVersion='uz-personal-import-2026-09-09-v1';
export const customsSources=[{title:'Таможенный кодекс, статья 169',url:'https://lex.uz/acts/2876352'},{title:'Таможенный комитет: нормы с 1 мая 2025 года',url:'https://t.me/s/customschannel/46341'},{title:'Разъяснение таможенной службы: месячный лимит',url:'https://www.customs.kg/site/ru/master/customskg/news/k-svedeniju-uchastnikov-vneshneehkonomicheskoj-dejatelnosti'}];
