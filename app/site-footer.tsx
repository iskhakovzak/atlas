'use client';
import {ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {ThemeToggle} from './theme-control';
import {routeTitle} from '@/lib/market/i18n';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {MissingContent,useHomeCopy} from './home-sections';

export function SiteFooter(){
 const {locale,c}=useHomeCopy();
 const {siteContent}=useMarket();
 const {contacts,legal}=siteContent;
 const pickup=(contacts.pickupAddress?pickLocale(contacts.pickupAddress,locale):undefined);
 const contactLinks=[
  contacts.telegramSupport&&{href:`https://t.me/${contacts.telegramSupport}`,label:c.footer.telegramSupport,value:'@'+contacts.telegramSupport},
  contacts.telegramChannel&&{href:`https://t.me/${contacts.telegramChannel}`,label:c.footer.telegramChannel,value:'@'+contacts.telegramChannel},
  contacts.phone&&{href:`tel:${contacts.phone.replace(/[^+\d]/g,'')}`,label:c.footer.phone,value:contacts.phone},
  contacts.instagram&&{href:`https://instagram.com/${contacts.instagram}`,label:c.footer.instagram,value:'@'+contacts.instagram},
 ].filter((item):item is {href:string;label:string;value:string}=>Boolean(item));
 const legalAddress=(legal.address?pickLocale(legal.address,locale):undefined);
 // No real contacts yet: no column that would only say "support in your account"; that link joins the shoppers' list.
 const hasContacts=contactLinks.length>0||Boolean(pickup);
 // Compact footer: brand and tagline on the left, link groups on the right (flex, so a missing contacts group leaves no hole), one bottom line.
 return <footer className="home-footer">
  <div className="home-footer-brand"><Link className="wordmark" href="/" aria-label="Atlas">atlas<ArrowUpRight aria-hidden="true"/></Link><p>{c.footer.tagline}</p></div>
  <div className="home-footer-groups">
  <nav aria-labelledby="footer-buyers"><h2 id="footer-buyers" className="home-footer-title">{c.footer.buyers}</h2><ul>
   <li><Link href="/catalog">{c.nav.catalog}</Link></li><li><Link href="/stores">{c.nav.stores}</Link></li><li><Link href="/#how">{c.nav.how}</Link></li><li><Link href="/#tariffs">{c.nav.tariffs}</Link></li>
   <li><Link href="/customs">{c.footer.customs}</Link></li><li><Link href="/#faq">{c.footer.faq}</Link></li>
   <li><Link href="/support">{routeTitle(locale,'support')}</Link></li><li><Link href="/app">{routeTitle(locale,'app')}</Link></li>
  </ul>{!hasContacts&&<MissingContent what="Telegram-бот поддержки и канал, телефон, Instagram, адрес пункта выдачи"/>}</nav>
  {hasContacts&&<section aria-labelledby="footer-contacts"><h2 id="footer-contacts" className="home-footer-title">{c.footer.contacts}</h2><ul>
   {contactLinks.map(item=><li key={item.href}><a href={item.href} target={item.href.startsWith('tel:')?undefined:'_blank'} rel={item.href.startsWith('tel:')?undefined:'noopener noreferrer'}><span>{item.label}</span> {item.value}</a></li>)}
   {pickup&&<li><span>{c.footer.pickup}:</span> {pickup}</li>}
   <li><Link href="/account">{c.footer.support}</Link></li>
  </ul></section>}
  <section aria-labelledby="footer-legal"><h2 id="footer-legal" className="home-footer-title">{c.footer.legal}</h2><ul>
   {legal.entityName&&<li>{legal.entityName}</li>}
   {legal.inn&&<li>{c.trust.inn}: {legal.inn}</li>}
   {legalAddress&&<li>{legalAddress}</li>}
   <li><Link href="/terms">{routeTitle(locale,'terms')}</Link></li><li><Link href="/privacy">{routeTitle(locale,'privacy')}</Link></li><li><Link href="/legal">{c.footer.rules}</Link></li>
  </ul>{!legal.entityName&&<MissingContent what="юрлицо и ИНН"/>}</section>
  </div>
  <div className="home-footer-bottom"><span>© Atlas</span><span className="home-footer-theme"><span>{c.footer.theme}</span><ThemeToggle locale={locale}/></span></div>
 </footer>;
}
