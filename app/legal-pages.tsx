"use client";

import Link from "@/components/site-link";
import {ShieldCheck} from "lucide-react";
import {useMarket} from "@/lib/market/store";
import {PageHeading} from "./market-ui";
import {LegalEditionBadge,LegalSources,LegalStatus,OfferDocument,PrivacyDocument,RefundsDocument,useLegalHash} from "./legal-documents";
import {withCyrillic} from '@/lib/market/uz-cyrl';

// Standalone /privacy and /terms: the same documents as /legal, opened on load, with their own headings.
const copy=withCyrillic({
 ru:{
  privacy:{overline:"КОНФИДЕНЦИАЛЬНОСТЬ",title:"Политика конфиденциальности Atlas.",description:"Какие данные обрабатывает сайт и приложения Atlas, зачем, кому они могут передаваться, как удалить аккаунт и отозвать согласие."},
  terms:{overline:"УСЛОВИЯ",title:"Условия использования Atlas.",description:"Публичная оферта на посреднические и логистические услуги, условия приложений для iOS и Android и политика оплаты и возврата."},
  related:"Связанные документы",allDocs:"Все документы",privacyLink:"Политика конфиденциальности",termsLink:"Условия использования",support:"Поддержка",deleteLink:"Удаление аккаунта",
 },
 uz:{
  privacy:{overline:"MAXFIYLIK",title:"Atlas maxfiylik siyosati.",description:"Atlas sayti va ilovalari qanday ma’lumotlarni, nima uchun qayta ishlaydi, ular kimga uzatilishi mumkin, akkauntni qanday o‘chirish va rozilikni qaytarib olish mumkin."},
  terms:{overline:"SHARTLAR",title:"Atlas foydalanish shartlari.",description:"Vositachilik va logistika xizmatlari bo‘yicha ommaviy oferta, iOS va Android ilovalari shartlari hamda to‘lov va qaytarish siyosati."},
  related:"Bog‘liq hujjatlar",allDocs:"Barcha hujjatlar",privacyLink:"Maxfiylik siyosati",termsLink:"Foydalanish shartlari",support:"Yordam",deleteLink:"Akkauntni o‘chirish",
 },
 en:{
  privacy:{overline:"PRIVACY",title:"Atlas privacy policy.",description:"Which data the Atlas website and apps process, why, who it may be shared with, how to delete your account and withdraw consent."},
  terms:{overline:"TERMS",title:"Atlas terms of use.",description:"The public offer for intermediary and logistics services, the terms for the iOS and Android apps, and the payment and refund policy."},
  related:"Related documents",allDocs:"All documents",privacyLink:"Privacy policy",termsLink:"Terms of use",support:"Support",deleteLink:"Account deletion",
 },
});

function RelatedLinks({locale,current}:{locale:keyof typeof copy;current:"privacy"|"terms"}){
 const t=copy[locale];
 return <nav className="legal-related" aria-label={t.related}><ShieldCheck aria-hidden="true"/><span>{t.related}:</span>
  {current==="privacy"?<Link href="/terms">{t.termsLink}</Link>:<Link href="/privacy">{t.privacyLink}</Link>}
  <Link href="/delete-account">{t.deleteLink}</Link><Link href="/support">{t.support}</Link><Link href="/legal">{t.allDocs}</Link>
 </nav>;
}

export function PrivacyPage(){
 const {state}=useMarket(),locale=state.communication.language,t=copy[locale].privacy;
 useLegalHash();
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}><LegalEditionBadge locale={locale}/></PageHeading>
  <LegalStatus locale={locale}/>
  <PrivacyDocument open number="Политика"/>
  <LegalSources/>
  <RelatedLinks locale={locale} current="privacy"/>
 </>;
}

export function TermsPage(){
 const {state}=useMarket(),locale=state.communication.language,t=copy[locale].terms;
 useLegalHash();
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}><LegalEditionBadge locale={locale}/></PageHeading>
  <LegalStatus locale={locale}/>
  <OfferDocument open number="Оферта"/>
  <RefundsDocument open number="Оплата и возврат"/>
  <LegalSources/>
  <RelatedLinks locale={locale} current="terms"/>
 </>;
}
