"use client";

import {Fragment,useEffect,useRef} from "react";
import Link from "@/components/site-link";
import {ChevronDown,ListOrdered,ShieldCheck} from "lucide-react";
import {useMarket} from "@/lib/market/store";
import type {Locale} from "@/lib/market/i18n";
import {offerToc,privacyToc,refundsToc,type LegalTocEntry} from "@/lib/market/legal-toc";
import {PageHeading} from "./market-ui";
import {LegalEditionBadge,LegalSources,LegalStatus,OfferDocument,PrivacyDocument,RefundsDocument,useLegalHash} from "./legal-documents";
import {withCyrillic} from '@/lib/market/uz-cyrl';

// Standalone /privacy and /terms: the same documents as /legal, opened on load, with their own headings.
const copy=/*@__PURE__*/withCyrillic({
 ru:{
  privacy:{overline:"КОНФИДЕНЦИАЛЬНОСТЬ",title:"Политика конфиденциальности Atlas.",description:"Какие данные обрабатывает сайт и приложения Atlas, зачем, кому они могут передаваться, как удалить аккаунт и отозвать согласие."},
  terms:{overline:"УСЛОВИЯ",title:"Условия использования Atlas.",description:"Публичная оферта на посреднические и логистические услуги, условия приложений для iOS и Android и политика оплаты и возврата."},
  related:"Связанные документы",allDocs:"Все документы",privacyLink:"Политика конфиденциальности",termsLink:"Условия использования",support:"Поддержка",deleteLink:"Удаление аккаунта",
  policy:"Политика",offer:"Оферта",refunds:"Оплата и возврат",toc:"Содержание",
 },
 uz:{
  privacy:{overline:"MAXFIYLIK",title:"Atlas maxfiylik siyosati.",description:"Atlas sayti va ilovalari qanday ma’lumotlarni, nima uchun qayta ishlaydi, ular kimga uzatilishi mumkin, akkauntni qanday o‘chirish va rozilikni qaytarib olish mumkin."},
  terms:{overline:"SHARTLAR",title:"Atlas foydalanish shartlari.",description:"Vositachilik va logistika xizmatlari bo‘yicha ommaviy oferta, iOS va Android ilovalari shartlari hamda to‘lov va qaytarish siyosati."},
  related:"Bog‘liq hujjatlar",allDocs:"Barcha hujjatlar",privacyLink:"Maxfiylik siyosati",termsLink:"Foydalanish shartlari",support:"Yordam",deleteLink:"Akkauntni o‘chirish",
  policy:"Siyosat",offer:"Oferta",refunds:"To‘lov va qaytarish",toc:"Mundarija",
 },
 en:{
  privacy:{overline:"PRIVACY",title:"Atlas privacy policy.",description:"Which data the Atlas website and apps process, why, who it may be shared with, how to delete your account and withdraw consent."},
  terms:{overline:"TERMS",title:"Atlas terms of use.",description:"The public offer for intermediary and logistics services, the terms for the iOS and Android apps, and the payment and refund policy."},
  related:"Related documents",allDocs:"All documents",privacyLink:"Privacy policy",termsLink:"Terms of use",support:"Support",deleteLink:"Account deletion",
  policy:"Policy",offer:"Offer",refunds:"Payment and refunds",toc:"Contents",
 },
});

function RelatedLinks({locale,current}:{locale:keyof typeof copy;current:"privacy"|"terms"}){
 const t=copy[locale];
 return <nav className="legal-related" aria-label={t.related}><ShieldCheck aria-hidden="true"/><span>{t.related}:</span>
  {current==="privacy"?<Link href="/terms">{t.termsLink}</Link>:<Link href="/privacy">{t.privacyLink}</Link>}
  <Link href="/delete-account">{t.deleteLink}</Link><Link href="/support">{t.support}</Link><Link href="/legal">{t.allDocs}</Link>
 </nav>;
}

/** One document's part of the contents; a page with several documents (/terms) heads each with a link to the document. */
type LegalTocGroup={entries:readonly LegalTocEntry[];doc?:{id:string;label:string}};

// Contents of a long document: folded on phones, opened after mount on wide screens (no hydration mismatch);
// labels repeat the Russian <h3>s, so they carry lang="ru" when the site is in uz/en. A document heading is in the
// site language, like the document's own badge.
function LegalToc({locale,groups}:{locale:Locale;groups:readonly LegalTocGroup[]}){
 const ref=useRef<HTMLDetailsElement>(null),t=copy[locale];
 useEffect(()=>{if(ref.current&&window.matchMedia("(min-width: 1100px)").matches)ref.current.open=true},[]);
 return <details className="legal-toc" ref={ref}>
  <summary><ListOrdered aria-hidden="true"/><span>{t.toc}</span><ChevronDown className="disclosure-chevron" aria-hidden="true"/></summary>
  <nav aria-label={t.toc}>{groups.map(group=><Fragment key={group.doc?.id??group.entries[0]?.id}>
   {group.doc&&<a className="legal-toc-doc" href={`#${group.doc.id}`}>{group.doc.label}</a>}
   <ul lang={locale==="ru"?undefined:"ru"}>{group.entries.map(entry=><li key={entry.id}><a href={`#${entry.id}`}>{entry.title}</a></li>)}</ul>
  </Fragment>)}</nav>
 </details>;
}

export function PrivacyPage(){
 const {state}=useMarket(),locale=state.communication.language,t=copy[locale].privacy;
 useLegalHash();
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}><LegalEditionBadge locale={locale}/></PageHeading>
  <LegalStatus locale={locale}/>
  <LegalToc locale={locale} groups={[{entries:privacyToc}]}/>
  <PrivacyDocument open number={copy[locale].policy} locale={locale}/>
  <LegalSources locale={locale}/>
  <RelatedLinks locale={locale} current="privacy"/>
 </>;
}

export function TermsPage(){
 const {state}=useMarket(),locale=state.communication.language,t=copy[locale].terms;
 useLegalHash();
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}><LegalEditionBadge locale={locale}/></PageHeading>
  <LegalStatus locale={locale}/>
  <LegalToc locale={locale} groups={[{doc:{id:"offer",label:copy[locale].offer},entries:offerToc},{doc:{id:"refunds",label:copy[locale].refunds},entries:refundsToc}]}/>
  <OfferDocument open number={copy[locale].offer} locale={locale}/>
  <RefundsDocument open number={copy[locale].refunds} locale={locale}/>
  <LegalSources locale={locale}/>
  <RelatedLinks locale={locale} current="terms"/>
 </>;
}
