'use client';
import {ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {siteContent} from '@/lib/market/site-content';
import {ThemeToggle} from './theme-control';
import {MissingContent,useHomeCopy} from './home-sections';

export function SiteFooter(){
 const {locale,c}=useHomeCopy();
 const {contacts,legal}=siteContent;
 const pickup=contacts.pickupAddress?.[locale];
 const contactLinks=[
  contacts.telegramSupport&&{href:`https://t.me/${contacts.telegramSupport}`,label:c.footer.telegramSupport,value:'@'+contacts.telegramSupport},
  contacts.telegramChannel&&{href:`https://t.me/${contacts.telegramChannel}`,label:c.footer.telegramChannel,value:'@'+contacts.telegramChannel},
  contacts.phone&&{href:`tel:${contacts.phone.replace(/[^+\d]/g,'')}`,label:c.footer.phone,value:contacts.phone},
  contacts.instagram&&{href:`https://instagram.com/${contacts.instagram}`,label:c.footer.instagram,value:'@'+contacts.instagram},
 ].filter((item):item is {href:string;label:string;value:string}=>Boolean(item));
 const legalAddress=legal.address?.[locale];
 return <footer className="home-footer">
  <div className="home-footer-brand"><Link className="wordmark" href="/" aria-label="Atlas">atlas<ArrowUpRight aria-hidden="true"/></Link><p>{c.footer.tagline}</p></div>
  <nav aria-labelledby="footer-buyers"><h2 id="footer-buyers" className="home-footer-title">{c.footer.buyers}</h2><ul>
   <li><Link href="/stores">{c.nav.stores}</Link></li><li><Link href="/#how">{c.nav.how}</Link></li><li><Link href="/#tariffs">{c.nav.tariffs}</Link></li>
   <li><Link href="/customs">{c.footer.customs}</Link></li><li><Link href="/#faq">{c.footer.faq}</Link></li>
  </ul></nav>
  <section aria-labelledby="footer-contacts"><h2 id="footer-contacts" className="home-footer-title">{c.footer.contacts}</h2><ul>
   {contactLinks.map(item=><li key={item.href}><a href={item.href} target={item.href.startsWith('tel:')?undefined:'_blank'} rel={item.href.startsWith('tel:')?undefined:'noopener noreferrer'}><span>{item.label}</span> {item.value}</a></li>)}
   {pickup&&<li><span>{c.footer.pickup}:</span> {pickup}</li>}
   <li><Link href="/account">{c.footer.support}</Link></li>
  </ul>{!contactLinks.length&&<MissingContent what="Telegram-бот поддержки и канал, телефон, Instagram, адрес пункта выдачи"/>}</section>
  <section aria-labelledby="footer-legal"><h2 id="footer-legal" className="home-footer-title">{c.footer.legal}</h2><ul>
   {legal.entityName&&<li>{legal.entityName}</li>}
   {legal.inn&&<li>{c.trust.inn}: {legal.inn}</li>}
   {legalAddress&&<li>{legalAddress}</li>}
   <li><Link href="/legal#offer">{c.footer.rules}</Link></li><li><Link href="/legal#privacy">{c.footer.privacy}</Link></li>
  </ul>{!legal.entityName&&<MissingContent what="юрлицо и ИНН"/>}</section>
  <div className="home-footer-bottom"><span>© Atlas</span><span className="home-footer-theme"><span>{c.footer.theme}</span><ThemeToggle locale={locale}/></span></div>
 </footer>;
}
