'use client';
import {ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {ThemeToggle} from './theme-control';
import {footerCopy,navCopy,routeTitle,type Locale} from '@/lib/market/i18n';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {consentOpenEvent} from '@/lib/market/cookie-consent';
import './footer.css';

const isDev=(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true;
/** Dev-only marker for business data that is not filled yet; production renders nothing. */
export function MissingContent({what}:{what:string}){
 if(!isDev)return null;
 return <p className="home-missing" role="note">Нужно заполнить: {what} — в админке, раздел «Контент сайта»</p>;
}

export function SiteFooter(){
 const {siteContent,state,setLocale}=useMarket();
 const locale=state.communication.language as Locale,c={footer:footerCopy[locale],nav:navCopy[locale],trust:{inn:footerCopy[locale].inn}};
 const {contacts,legal}=siteContent;
 const pickup=(contacts.pickupAddress?pickLocale(contacts.pickupAddress,locale):undefined);
 const contactLinks=[
  contacts.telegramSupport&&{href:`https://t.me/${contacts.telegramSupport}`,label:c.footer.telegramSupport,value:'@'+contacts.telegramSupport},
  contacts.telegramChannel&&{href:`https://t.me/${contacts.telegramChannel}`,label:c.footer.telegramChannel,value:'@'+contacts.telegramChannel},
  contacts.phone&&{href:`tel:${contacts.phone.replace(/[^+\d]/g,'')}`,label:c.footer.phone,value:contacts.phone},
  contacts.instagram&&{href:`https://instagram.com/${contacts.instagram}`,label:c.footer.instagram,value:'@'+contacts.instagram},
  contacts.supportEmail&&{href:`mailto:${contacts.supportEmail}`,label:c.footer.email,value:contacts.supportEmail},
 ].filter((item):item is {href:string;label:string;value:string}=>Boolean(item));
 const hours=(contacts.supportHours?pickLocale(contacts.supportHours,locale):undefined);
 const legalAddress=(legal.address?pickLocale(legal.address,locale):undefined);
 // No real contacts yet: no column that would only say "support in your account"; that link joins the shoppers' list.
 const hasContacts=contactLinks.length>0||Boolean(pickup||hours);
 // Compact footer (owner, 2 November 2026): brand and a one-line tagline, the shoppers' links as a wrapped line, contacts,
 // the legal links in one small line, then one bottom line — © · data settings · language · theme. Desktop: one row of
 // columns under a hairline. Styles: app/footer.css. Hidden in the app shell (app/native.css).
 const languages=[{code:'ru',short:'RU',lang:'ru',name:'Русский'},{code:'uz',short:'UZ',lang:'uz-Latn',name:'O‘zbekcha'},{code:'oz',short:'ЎЗ',lang:'uz-Cyrl',name:'Ўзбекча'},{code:'en',short:'EN',lang:'en',name:'English'}] as const;
 return <footer className="home-footer">
  <div className="home-footer-brand"><Link className="wordmark" href="/" aria-label="Atlas">atlas<ArrowUpRight aria-hidden="true"/></Link><p><span className="home-footer-tagline-long">{c.footer.tagline}</span><span className="home-footer-tagline-short">{c.footer.taglineShort}</span></p></div>
  <div className="home-footer-groups">
  <nav className="home-footer-buyers" aria-labelledby="footer-buyers"><h2 id="footer-buyers" className="home-footer-title">{c.footer.buyers}</h2><ul>
   {/* Phones hide the links the bottom bar already has, so the footer stays short there. */}
   <li className="footer-dup"><Link href="/order-by-link">{routeTitle(locale,'link')}</Link></li><li className="footer-dup"><Link href="/catalog">{c.nav.catalog}</Link></li><li><Link href="/stores">{c.nav.stores}</Link></li><li><Link href="/#how">{c.nav.how}</Link></li><li><Link href="/delivery">{c.nav.delivery}</Link></li>
   <li><Link href="/customs">{c.footer.customs}</Link></li><li><Link href="/#faq">{c.footer.faq}</Link></li>
   <li><Link href="/support">{routeTitle(locale,'support')}</Link></li><li><Link href="/app">{routeTitle(locale,'app')}</Link></li>
  </ul>{!hasContacts&&<MissingContent what="Telegram-бот поддержки и канал, телефон, почта, часы работы, Instagram, адрес пункта выдачи"/>}</nav>
  {hasContacts&&<section className="home-footer-contacts" aria-labelledby="footer-contacts"><h2 id="footer-contacts" className="home-footer-title">{c.footer.contacts}</h2><ul>
   {contactLinks.map(item=>{const external=item.href.startsWith('https:');return <li key={item.href}><a href={item.href} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined}><span>{item.label}</span> {item.value}</a></li>})}
   {hours&&<li><span>{c.footer.hours}:</span> {hours}</li>}
   {pickup&&<li><span>{c.footer.pickup}:</span> {pickup}</li>}
   <li><Link href="/account">{c.footer.support}</Link></li>
  </ul></section>}
  <section className="home-footer-legal" aria-labelledby="footer-legal"><h2 id="footer-legal" className="home-footer-title">{c.footer.legal}</h2><ul>
   <li><Link href="/terms">{routeTitle(locale,'terms')}</Link></li><li><Link href="/privacy">{c.footer.privacy}</Link></li><li><Link href="/legal">{c.footer.rules}</Link></li>
  </ul>
  {(legal.entityName||legal.inn||legalAddress)&&<p className="home-footer-entity">{[legal.entityName,legal.inn&&`${c.trust.inn}: ${legal.inn}`,legalAddress].filter(Boolean).join(' · ')}</p>}
  {!legal.entityName&&<MissingContent what="юрлицо, ИНН (STIR) и юридический адрес"/>}</section>
  </div>
  <div className="home-footer-bottom">
   <span className="home-footer-copy" suppressHydrationWarning>© {new Date().getFullYear()} Atlas</span>
   {/* Cookies can be changed or withdrawn at any time: opens the consent card with its switches (app/storage-notice.tsx). */}
   <button type="button" className="home-footer-consent" onClick={()=>window.dispatchEvent(new Event(consentOpenEvent))}>{c.footer.dataSettings}</button>
   <span className="home-footer-langs" role="group" aria-label={c.nav.language}>{languages.map(item=><a key={item.code} href={`?lang=${item.code}`} lang={item.lang} hrefLang={item.lang==='uz-Latn'?'uz':item.lang} aria-label={item.name} aria-current={item.code===locale||undefined} onClick={event=>{event.preventDefault();setLocale(item.code)}}>{item.short}</a>)}</span>
   <span className="home-footer-theme"><span className="sr-only">{c.footer.theme}</span><ThemeToggle locale={locale}/></span>
  </div>
 </footer>;
}
