"use client";

import {ArrowRight,ArrowUpRight,Bell,Calculator,FileCheck2,Link2,Package,Smartphone} from "lucide-react";
import Link from "@/components/site-link";
import {useMarket} from "@/lib/market/store";
import type {Locale} from "@/lib/market/i18n";
import {PageHeading} from "./market-ui";
import {MissingContent} from "./site-footer";
import {withCyrillic} from '@/lib/market/uz-cyrl';

// Public landing page for the mobile apps (/app). Store buttons appear only when the owner has filled
// siteContent.apps; no ratings, reviews, counters or screenshots are shown.
const copy:Record<Locale,{overline:string;title:string;description:string;features:string;list:{icon:typeof Link2;title:string;text:string}[];stores:string;appStore:string;playStore:string;pending:string;same:string;sameText:string;links:string;support:string;privacy:string;terms:string;del:string;web:string}>=/*@__PURE__*/withCyrillic({
 ru:{
  overline:"ПРИЛОЖЕНИЕ",title:"Atlas на телефоне.",description:"Приложение Atlas для iOS и Android делает то же, что и сайт: расчёт по ссылке, заказы, документы и уведомления — в одном аккаунте.",
  features:"Что умеет приложение",
  list:[
   {icon:Link2,title:"Импорт по ссылке",text:"Вставьте ссылку на товар из поддерживаемого магазина — Atlas подставит название, цену, фото и варианты. Вы проверяете эти данные, а цену Atlas сверяет с магазином."},
   {icon:Calculator,title:"Расчёт в сумах",text:"Товар, сервис Atlas, международная доставка и расчёт таможенного платежа — отдельными строками, до регистрации."},
   {icon:Package,title:"Заказы и статусы",text:"Этапы заказа, изменения цены и веса, согласования и вопросы по заказу — в кабинете."},
   {icon:FileCheck2,title:"Документы",text:"Паспорт для декларации распознаётся на вашем устройстве; вы проверяете каждое поле перед подтверждением."},
   {icon:Bell,title:"Уведомления",text:"Ответы поддержки и события заказа — в разделе уведомлений. Push-уведомления пока не отправляются."},
  ],
  stores:"Где скачать",appStore:"Открыть в App Store",playStore:"Открыть в Google Play",pending:"Приложение готовится к публикации в App Store и Google Play. Пока сайт atlasmarket.uz работает на телефоне без установки.",
  same:"Один аккаунт",sameText:"Вход в приложении — теми же способами, что на сайте: Apple, Google, Telegram, телефон или почта. Покупок внутри приложения и подписок нет; оплата заказов на сайте и в приложении не подключена — деньги не списываются.",
  links:"Документы и помощь",support:"Поддержка",privacy:"Политика конфиденциальности",terms:"Условия использования",del:"Удаление аккаунта",web:"Открыть сайт",
 },
 uz:{
  overline:"ILOVA",title:"Atlas telefonda.",description:"iOS va Android uchun Atlas ilovasi sayt bilan bir xil ishlaydi: havola bo‘yicha hisob, buyurtmalar, hujjatlar va bildirishnomalar — bitta akkauntda.",
  features:"Ilova nimalarni qila oladi",
  list:[
   {icon:Link2,title:"Havola orqali import",text:"Qo‘llab-quvvatlanadigan do‘kondan tovar havolasini qo‘ying — Atlas nom, narx, surat va variantlarni qo‘yadi. Siz bu ma’lumotlarni tekshirasiz, narxni esa Atlas do‘kon bilan solishtiradi."},
   {icon:Calculator,title:"So‘mda hisob",text:"Tovar, Atlas xizmati, xalqaro yetkazish va bojxona to‘lovi hisobi — alohida satrlarda, ro‘yxatdan o‘tishdan oldin."},
   {icon:Package,title:"Buyurtmalar va holatlar",text:"Buyurtma bosqichlari, narx va vazn o‘zgarishlari, kelishuvlar va buyurtma bo‘yicha savollar — kabinetda."},
   {icon:FileCheck2,title:"Hujjatlar",text:"Deklaratsiya uchun pasport qurilmangizda taniladi; tasdiqlashdan oldin har bir maydonni tekshirasiz."},
   {icon:Bell,title:"Bildirishnomalar",text:"Yordam javoblari va buyurtma voqealari — bildirishnomalar bo‘limida. Push-bildirishnomalar hali yuborilmaydi."},
  ],
  stores:"Qayerdan yuklab olish",appStore:"App Store’da ochish",playStore:"Google Play’da ochish",pending:"Ilova App Store va Google Play’da nashrga tayyorlanmoqda. Hozircha atlasmarket.uz sayti telefonda o‘rnatishsiz ishlaydi.",
  same:"Bitta akkaunt",sameText:"Ilovaga kirish — saytdagi usullar bilan: Apple, Google, Telegram, telefon yoki pochta. Ilova ichida xaridlar va obunalar yo‘q; saytda va ilovada buyurtma to‘lovi ulanmagan — pul yechilmaydi.",
  links:"Hujjatlar va yordam",support:"Yordam",privacy:"Maxfiylik siyosati",terms:"Foydalanish shartlari",del:"Akkauntni o‘chirish",web:"Saytni ochish",
 },
 en:{
  overline:"APP",title:"Atlas on your phone.",description:"The Atlas app for iOS and Android does the same as the website: link estimates, orders, documents and notifications — in one account.",
  features:"What the app does",
  list:[
   {icon:Link2,title:"Import by link",text:"Paste a product link from a supported store — Atlas fills in the title, price, photos and variants. You check these details, and Atlas checks the price with the store."},
   {icon:Calculator,title:"Estimate in soum",text:"Item, Atlas service, international delivery and the customs payment calculation — on separate lines, before you sign up."},
   {icon:Package,title:"Orders and statuses",text:"Order stages, price and weight changes, approvals and questions about an order — in your account."},
   {icon:FileCheck2,title:"Documents",text:"The passport for your declaration is recognised on your device; you check every field before confirming."},
   {icon:Bell,title:"Notifications",text:"Support replies and order events — in the notifications section. Push notifications are not sent yet."},
  ],
  stores:"Where to get it",appStore:"Open in the App Store",playStore:"Open in Google Play",pending:"The app is being prepared for publication in the App Store and Google Play. Meanwhile atlasmarket.uz works on your phone without installing anything.",
  same:"One account",sameText:"Sign in to the app the same way as on the website: Apple, Google, Telegram, phone or email. There are no in-app purchases or subscriptions; order payment is not connected on the website or in the app — no money is charged.",
  links:"Documents and help",support:"Support",privacy:"Privacy policy",terms:"Terms of use",del:"Account deletion",web:"Open the website",
 },
});

export function AppLanding(){
 const {state,siteContent}=useMarket();
 const t=copy[state.communication.language];
 const {apps}=siteContent;
 const hasStores=Boolean(apps.appStoreUrl||apps.playStoreUrl);
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}/>
  <section className="page-block" aria-labelledby="app-stores"><h2 id="app-stores">{t.stores}</h2>
   {hasStores?<div className="page-actions">
    {apps.appStoreUrl&&<a className="btn primary" href={apps.appStoreUrl} target="_blank" rel="noopener noreferrer">{t.appStore}<ArrowUpRight size={18} aria-hidden="true"/></a>}
    {apps.playStoreUrl&&<a className="btn primary" href={apps.playStoreUrl} target="_blank" rel="noopener noreferrer">{t.playStore}<ArrowUpRight size={18} aria-hidden="true"/></a>}
   </div>:<div className="notice page-pending"><Smartphone aria-hidden="true"/><span>{t.pending}</span></div>}
   {!hasStores&&<MissingContent what="ссылки на App Store и Google Play (siteContent.apps)"/>}
  </section>
  <section className="page-block" aria-labelledby="app-features"><h2 id="app-features">{t.features}</h2>
   <div className="page-grid">{t.list.map(item=>{const Icon=item.icon;return <article key={item.title} className="surface page-card"><Icon aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></article>})}</div>
  </section>
  <section className="page-block" aria-labelledby="app-same"><h2 id="app-same">{t.same}</h2><p className="page-lead">{t.sameText}</p></section>
  <section className="page-block" aria-labelledby="app-links"><h2 id="app-links">{t.links}</h2>
   <div className="page-card-links page-links-row"><Link href="/support">{t.support}<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/privacy">{t.privacy}<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/terms">{t.terms}<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/delete-account">{t.del}<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/">{t.web}<ArrowRight size={16} aria-hidden="true"/></Link></div>
  </section>
 </>;
}
