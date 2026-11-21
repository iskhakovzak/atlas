import type {Locale} from './i18n';

/** Keep the task's product link, filters, sign-in return and fragment when choosing another language. */
export function languageSwitchHref(href:string,locale:Locale):string{
 const url=new URL(href,'https://atlas.local');
 url.searchParams.set('lang',locale);
 return url.pathname+url.search+url.hash;
}

/** An explicit language address must agree with the chosen device language after reload; x-default stays x-default. */
export function explicitLanguageReplacement(href:string,locale:Locale):string|null{
 const url=new URL(href,'https://atlas.local');
 return url.searchParams.has('lang')?languageSwitchHref(href,locale):null;
}
