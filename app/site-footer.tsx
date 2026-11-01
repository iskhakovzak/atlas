'use client';
import {ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {ThemeToggle} from './theme-control';
import {footerCopy,navCopy,routeTitle,type Locale} from '@/lib/market/i18n';
import {pickLocale} from '@/lib/market/uz-cyrl';

const isDev=(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true;
/** Dev-only marker for business data that is not filled yet; production renders nothing. */
export function MissingContent({what}:{what:string}){
 if(!isDev)return null;
 return <p className="home-missing" role="note">Нужно заполнить: {what} — в админке, раздел «Контент сайта»</p>;
}

export function SiteFooter(){
 const {siteContent,state}=useMarket();
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
 // Compact footer: brand and tagline on the left, link groups on the right (flex, so a missing contacts group leaves no hole), one bottom line.
 return <footer className="home-footer">
  <div className="home-footer-brand"><Link className="wordmark" href="/" aria-label="Atlas">atlas<ArrowUpRight aria-hidden="true"/></Link><p>{c.footer.tagline}</p></div>
  <div className="home-footer-groups">
  <nav aria-labelledby="footer-buyers"><h2 id="footer-buyers" className="home-footer-title">{c.footer.buyers}</h2><ul>
   {/* Phones hide the links the bottom bar already has (app/shell.css), so the footer stays short there. */}
   <li className="footer-dup"><Link href="/order-by-link">{routeTitle(locale,'link')}</Link></li><li className="footer-dup"><Link href="/catalog">{c.nav.catalog}</Link></li><li><Link href="/stores">{c.nav.stores}</Link></li><li><Link href="/#how">{c.nav.how}</Link></li><li><Link href="/delivery">{c.nav.delivery}</Link></li>
   <li><Link href="/customs">{c.footer.customs}</Link></li><li><Link href="/#faq">{c.footer.faq}</Link></li>
   <li><Link href="/support">{routeTitle(locale,'support')}</Link></li><li><Link href="/app">{routeTitle(locale,'app')}</Link></li>
  </ul>{!hasContacts&&<MissingContent what="Telegram-бот поддержки и канал, телефон, почта, часы работы, Instagram, адрес пункта выдачи"/>}</nav>
  {hasContacts&&<section aria-labelledby="footer-contacts"><h2 id="footer-contacts" className="home-footer-title">{c.footer.contacts}</h2><ul>
   {contactLinks.map(item=>{const external=item.href.startsWith('https:');return <li key={item.href}><a href={item.href} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined}><span>{item.label}</span> {item.value}</a></li>})}
   {hours&&<li><span>{c.footer.hours}:</span> {hours}</li>}
   {pickup&&<li><span>{c.footer.pickup}:</span> {pickup}</li>}
   <li><Link href="/account">{c.footer.support}</Link></li>
  </ul></section>}
  <section aria-labelledby="footer-legal"><h2 id="footer-legal" className="home-footer-title">{c.footer.legal}</h2><ul>
   {legal.entityName&&<li>{legal.entityName}</li>}
   {legal.inn&&<li>{c.trust.inn}: {legal.inn}</li>}
   {legalAddress&&<li>{legalAddress}</li>}
   <li><Link href="/terms">{routeTitle(locale,'terms')}</Link></li><li><Link href="/privacy">{routeTitle(locale,'privacy')}</Link></li><li><Link href="/legal">{c.footer.rules}</Link></li>
  </ul>{!legal.entityName&&<MissingContent what="юрлицо, ИНН (STIR) и юридический адрес"/>}</section>
  </div>
  <div className="home-footer-bottom"><span suppressHydrationWarning>© {new Date().getFullYear()} Atlas{legal.entityName?` · ${legal.entityName}`:''}</span><span className="home-footer-theme"><span>{c.footer.theme}</span><ThemeToggle locale={locale}/></span></div>
 </footer>;
}
