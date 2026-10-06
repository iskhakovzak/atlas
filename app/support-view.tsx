"use client";

import {ArrowRight,ArrowUpRight,FileText,LifeBuoy,MessageCircle,Package,ShieldCheck,Smartphone,Trash2} from "lucide-react";
import Link from "@/components/site-link";
import {useMarket} from "@/lib/market/store";
import {signInPath} from "@/lib/market/access";
import type {Locale} from "@/lib/market/i18n";
import {PageHeading} from "./market-ui";
import {MissingContent,useHomeCopy} from "./home-sections";

// Public support page (/support): real contacts only when siteContent has them, the account route always.
const copy={
 ru:{
  overline:"ПОМОЩЬ",title:"Поддержка Atlas.",description:"Ответы приходят в личный кабинет и в уведомления. Здесь — как связаться и где искать ответы на частые вопросы.",
  contacts:"Как связаться",account:"Написать из кабинета",accountText:"Обращение сохраняется в вашем аккаунте: вы увидите ответ в кабинете и в уведомлениях.",accountGuest:"Чтобы написать в поддержку, войдите в аккаунт — обращение привяжется к вашим заказам, а ответ придёт в кабинет и в уведомления.",signin:"Войти и написать",open:"Открыть кабинет",email:"Почта",
  noContacts:"Почта и Telegram поддержки появятся на этой странице, как только Atlas их опубликует. До этого вопрос можно задать только из кабинета после входа.",
  faq:"Частые вопросы",faqMore:"Все вопросы на главной",
  sections:"Разделы",orders:"Статус заказа",ordersText:"Текущий этап каждого заказа, история и вопрос по конкретному заказу — в разделе «Мои заказы».",ordersLink:"Мои заказы",
  customs:"Таможня",customsText:"Беспошлинный лимит, ставка и калькулятор таможенного платежа.",customsLink:"Таможенные условия",
  del:"Удаление аккаунта",delText:"Аккаунт удаляется в настройках кабинета: профиль, документы, корзина и способы входа удаляются сразу; записи о заказах хранятся без личных данных по закону.",delLink:"Как удалить аккаунт",
  docs:"Документы",docsText:"Политика конфиденциальности и условия использования, включая условия приложений.",privacy:"Политика конфиденциальности",terms:"Условия использования",
  apps:"Приложения",appsText:"Приложение Atlas для iOS и Android — тот же аккаунт и те же заказы, что на сайте.",appsLink:"О приложении",
 },
 uz:{
  overline:"YORDAM",title:"Atlas yordam xizmati.",description:"Javoblar shaxsiy kabinetga va bildirishnomalarga keladi. Bu yerda qanday bog‘lanish va tez-tez so‘raladigan savollarga javobni qayerdan izlash mumkinligi yozilgan.",
  contacts:"Qanday bog‘lanish",account:"Kabinetdan yozish",accountText:"Murojaat akkauntingizda saqlanadi: javobni kabinetda va bildirishnomalarda ko‘rasiz.",accountGuest:"Yordamga yozish uchun akkauntga kiring — murojaat buyurtmalaringizga bog‘lanadi, javob esa kabinetga va bildirishnomalarga keladi.",signin:"Kirish va yozish",open:"Kabinetni ochish",email:"Pochta",
  noContacts:"Yordam pochtasi va Telegram Atlas ularni e’lon qilishi bilan shu sahifada paydo bo‘ladi. Ungacha savolni faqat kirgandan keyin kabinetdan berish mumkin.",
  faq:"Tez-tez so‘raladigan savollar",faqMore:"Barcha savollar bosh sahifada",
  sections:"Bo‘limlar",orders:"Buyurtma holati",ordersText:"Har bir buyurtmaning joriy bosqichi, tarixi va aniq buyurtma bo‘yicha savol — «Buyurtmalarim» bo‘limida.",ordersLink:"Buyurtmalarim",
  customs:"Bojxona",customsText:"Bojsiz limit, stavka va bojxona to‘lovi kalkulyatori.",customsLink:"Bojxona shartlari",
  del:"Akkauntni o‘chirish",delText:"Akkaunt kabinet sozlamalarida o‘chiriladi: profil, hujjatlar, savat va kirish usullari darhol o‘chiriladi; buyurtma yozuvlari qonun bo‘yicha shaxsiy ma’lumotlarsiz saqlanadi.",delLink:"Akkauntni qanday o‘chirish",
  docs:"Hujjatlar",docsText:"Maxfiylik siyosati va foydalanish shartlari, shu jumladan ilovalar shartlari.",privacy:"Maxfiylik siyosati",terms:"Foydalanish shartlari",
  apps:"Ilovalar",appsText:"iOS va Android uchun Atlas ilovasi — saytdagi bilan bir xil akkaunt va buyurtmalar.",appsLink:"Ilova haqida",
 },
 en:{
  overline:"HELP",title:"Atlas support.",description:"Replies arrive in your account and in notifications. Here is how to reach us and where to find answers to common questions.",
  contacts:"How to reach us",account:"Write from your account",accountText:"The request is saved in your account: you will see the reply in the account and in notifications.",accountGuest:"Sign in to write to support — the request will be linked to your orders and the reply will arrive in your account and in notifications.",signin:"Sign in and write",open:"Open account",email:"Email",
  noContacts:"The support e-mail and Telegram will appear on this page as soon as Atlas publishes them. Until then a question can only be sent from the account after signing in.",
  faq:"Frequently asked questions",faqMore:"All questions on the home page",
  sections:"Sections",orders:"Order status",ordersText:"The current stage of every order, its history and a question about a specific order are in “My orders”.",ordersLink:"My orders",
  customs:"Customs",customsText:"The duty-free allowance, the rate and the customs payment calculator.",customsLink:"Customs terms",
  del:"Account deletion",delText:"The account is deleted in the account settings: the profile, documents, cart and sign-in methods are removed immediately; order records are kept without personal data as the law requires.",delLink:"How to delete your account",
  docs:"Documents",docsText:"The privacy policy and the terms of use, including the terms for the apps.",privacy:"Privacy policy",terms:"Terms of use",
  apps:"Apps",appsText:"The Atlas app for iOS and Android — the same account and orders as on the website.",appsLink:"About the app",
 },
};

export function SupportView(){
 const {status,siteContent}=useMarket();
 const {locale,c}=useHomeCopy();
 const t=copy[locale];
 const {contacts}=siteContent;
 const links=[
  contacts.telegramSupport&&{href:`https://t.me/${contacts.telegramSupport}`,label:c.footer.telegramSupport,value:"@"+contacts.telegramSupport},
  contacts.telegramChannel&&{href:`https://t.me/${contacts.telegramChannel}`,label:c.footer.telegramChannel,value:"@"+contacts.telegramChannel},
  contacts.phone&&{href:`tel:${contacts.phone.replace(/[^+\d]/g,"")}`,label:c.footer.phone,value:contacts.phone},
  contacts.supportEmail&&{href:`mailto:${contacts.supportEmail}`,label:t.email,value:contacts.supportEmail},
  contacts.instagram&&{href:`https://instagram.com/${contacts.instagram}`,label:c.footer.instagram,value:"@"+contacts.instagram},
 ].filter((item):item is {href:string;label:string;value:string}=>Boolean(item));
 const signedIn=status==="authenticated";
 // The home FAQ entries are reused as they are; the delivery-time question needs pricing and stays on the home page.
 const faq=[c.faq.items.customs,c.faq.items.returns,c.faq.items.weight,c.faq.items.account];
 const sections:{icon:typeof Package;title:string;text:string;links:{href:string;label:string}[]}[]=[
  {icon:Package,title:t.orders,text:t.ordersText,links:[{href:"/orders",label:t.ordersLink}]},
  {icon:ShieldCheck,title:t.customs,text:t.customsText,links:[{href:"/customs",label:t.customsLink}]},
  {icon:Trash2,title:t.del,text:t.delText,links:[{href:"/delete-account",label:t.delLink}]},
  {icon:FileText,title:t.docs,text:t.docsText,links:[{href:"/privacy",label:t.privacy},{href:"/terms",label:t.terms}]},
  {icon:Smartphone,title:t.apps,text:t.appsText,links:[{href:"/app",label:t.appsLink}]},
 ];
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}/>
  <section className="page-block" aria-labelledby="support-contacts"><h2 id="support-contacts">{t.contacts}</h2>
   <div className="page-contacts">
    <article className="surface page-contact page-contact-main"><LifeBuoy aria-hidden="true"/><div><h3>{t.account}</h3><p>{signedIn?t.accountText:t.accountGuest}</p>
     {signedIn?<Link className="btn primary" href="/account#support">{t.open}<ArrowRight size={18} aria-hidden="true"/></Link>:<a className="btn primary" href={signInPath("/account#support")} target="_top">{t.signin}<ArrowRight size={18} aria-hidden="true"/></a>}</div></article>
    {links.map(item=><a key={item.href} className="surface page-contact" href={item.href} target={item.href.startsWith("http")?"_blank":undefined} rel={item.href.startsWith("http")?"noopener noreferrer":undefined}><MessageCircle aria-hidden="true"/><div><h3>{item.label}</h3><p>{item.value}</p></div><ArrowUpRight size={18} aria-hidden="true"/></a>)}
   </div>
   {links.length===0&&<><p className="page-more">{t.noContacts}</p><MissingContent what="Telegram-бот поддержки и канал, телефон, почта поддержки, Instagram"/></>}
  </section>
  <section className="page-block" aria-labelledby="support-faq"><h2 id="support-faq">{t.faq}</h2>
   <div className="home-faq">{faq.map(item=><details key={item.q}><summary>{item.q}</summary><div><p>{item.a}</p></div></details>)}</div>
   <p className="page-more"><Link href="/#faq">{t.faqMore}<ArrowRight size={16} aria-hidden="true"/></Link></p>
  </section>
  <section className="page-block" aria-labelledby="support-sections"><h2 id="support-sections">{t.sections}</h2>
   <div className="page-grid">{sections.map(item=>{const Icon=item.icon;return <article key={item.title} className="surface page-card"><Icon aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p><div className="page-card-links">{item.links.map(link=><Link key={link.href} href={link.href}>{link.label}<ArrowRight size={16} aria-hidden="true"/></Link>)}</div></article>})}</div>
  </section>
 </>;
}

const deleteCopy:Record<Locale,{overline:string;title:string;description:string;steps:string;step:string[];what:string;removed:string;removedList:string[];kept:string;keptText:string;blockers:string;blockersText:string;alt:string;altText:string;subject:string;open:string;signin:string;support:string;privacy:string}>={
 ru:{
  overline:"АККАУНТ",title:"Как удалить аккаунт Atlas.",description:"Аккаунт удаляется самостоятельно на сайте и в приложении. Инструкция одинакова для iOS, Android и браузера.",
  steps:"Шаги в приложении или на сайте",step:["Войдите в аккаунт и откройте «Кабинет».","Перейдите в «Настройки» внизу кабинета.","Нажмите «Удалить аккаунт», прочитайте, что будет удалено, и подтвердите."],
  what:"Что произойдёт",removed:"Удаляется сразу",removedList:["профиль и контакты","получатели и адреса","документы и сканы паспорта","корзина, избранное и уведомления","способы входа (Apple, Google, Telegram, телефон, почта) и все сеансы","история обращений в поддержку"],
  kept:"Хранится без ваших личных данных",keptText:"Записи о заказах и платежах сохраняются обезличенно в течение срока, установленного законодательством о бухгалтерском учёте. Восстановить аккаунт после удаления нельзя; новый вход создаст пустой аккаунт.",
  blockers:"Когда удаление недоступно",blockersText:"Если есть активные оплаченные заказы, сначала дождитесь их завершения или отмените их — иначе кнопка покажет, какие заказы мешают. Неиспользованный баланс потребует отдельного подтверждения.",
  alt:"Если войти не получается",altText:"Напишите в поддержку с темой «Удаление аккаунта» с того способа входа, который привязан к аккаунту. Мы проверим, что запрос исходит от владельца, и удалим аккаунт.",subject:"Удаление аккаунта",
  open:"Открыть настройки аккаунта",signin:"Войти и открыть настройки",support:"Поддержка",privacy:"Раздел политики об удалении",
 },
 uz:{
  overline:"AKKAUNT",title:"Atlas akkauntini qanday o‘chirish.",description:"Akkaunt saytda va ilovada mustaqil o‘chiriladi. Ko‘rsatma iOS, Android va brauzer uchun bir xil.",
  steps:"Ilovada yoki saytda qadamlar",step:["Akkauntga kiring va «Kabinet»ni oching.","Kabinet pastidagi «Sozlamalar»ga o‘ting.","«Akkauntni o‘chirish»ni bosing, nima o‘chirilishini o‘qing va tasdiqlang."],
  what:"Nima bo‘ladi",removed:"Darhol o‘chiriladi",removedList:["profil va kontaktlar","qabul qiluvchilar va manzillar","hujjatlar va pasport skanlari","savat, saqlanganlar va bildirishnomalar","kirish usullari (Apple, Google, Telegram, telefon, pochta) va barcha seanslar","yordam murojaatlari tarixi"],
  kept:"Shaxsiy ma’lumotlaringizsiz saqlanadi",keptText:"Buyurtma va to‘lov yozuvlari buxgalteriya hisobi to‘g‘risidagi qonunchilikda belgilangan muddat davomida shaxssiz saqlanadi. O‘chirilgandan keyin akkauntni tiklab bo‘lmaydi; yangi kirish bo‘sh akkaunt yaratadi.",
  blockers:"O‘chirish qachon mumkin emas",blockersText:"Faol to‘langan buyurtmalar bo‘lsa, avval ular tugashini kuting yoki bekor qiling — aks holda tugma qaysi buyurtmalar to‘sqinlik qilayotganini ko‘rsatadi. Ishlatilmagan balans alohida tasdiq talab qiladi.",
  alt:"Agar kirish imkoni bo‘lmasa",altText:"Akkauntga bog‘langan kirish usulidan «Akkauntni o‘chirish» mavzusi bilan yordam xizmatiga yozing. So‘rov egadan ekanini tekshirib, akkauntni o‘chiramiz.",subject:"Akkauntni o‘chirish",
  open:"Akkaunt sozlamalarini ochish",signin:"Kirish va sozlamalarni ochish",support:"Yordam",privacy:"Siyosatning o‘chirish bo‘limi",
 },
 en:{
  overline:"ACCOUNT",title:"How to delete your Atlas account.",description:"You delete the account yourself on the website and in the app. The steps are the same on iOS, Android and in a browser.",
  steps:"Steps in the app or on the website",step:["Sign in and open “Account”.","Go to “Settings” at the bottom of the account page.","Tap “Delete account”, read what will be removed and confirm."],
  what:"What happens",removed:"Removed immediately",removedList:["profile and contacts","recipients and addresses","documents and passport scans","cart, favourites and notifications","sign-in methods (Apple, Google, Telegram, phone, email) and all sessions","support history"],
  kept:"Kept without your personal data",keptText:"Order and payment records are kept anonymised for the period required by accounting legislation. A deleted account cannot be restored; signing in again creates an empty account.",
  blockers:"When deletion is unavailable",blockersText:"If you have active paid orders, wait for them to finish or cancel them first — otherwise the button shows which orders are in the way. An unused balance needs a separate confirmation.",
  alt:"If you cannot sign in",altText:"Write to support with the subject “Account deletion” from the sign-in method linked to the account. We will check that the request comes from the owner and delete the account.",subject:"Account deletion",
  open:"Open account settings",signin:"Sign in and open settings",support:"Support",privacy:"Deletion section of the policy",
 },
};

export function DeleteAccountView(){
 const {status,state}=useMarket();
 const t=deleteCopy[state.communication.language];
 const signedIn=status==="authenticated";
 return <>
  <PageHeading overline={t.overline} title={t.title} description={t.description}/>
  <section className="page-block" aria-labelledby="delete-steps"><h2 id="delete-steps">{t.steps}</h2>
   <ol className="page-steps">{t.step.map((text,index)=><li key={index}><span className="page-step-number" aria-hidden="true">{index+1}</span><p>{text}</p></li>)}</ol>
   <div className="page-actions">{signedIn?<Link className="btn primary" href="/account">{t.open}<ArrowRight size={18} aria-hidden="true"/></Link>:<a className="btn primary" href={signInPath("/account")} target="_top">{t.signin}<ArrowRight size={18} aria-hidden="true"/></a>}</div>
  </section>
  <section className="page-block" aria-labelledby="delete-what"><h2 id="delete-what">{t.what}</h2>
   <div className="page-grid">
    <article className="surface page-card"><Trash2 aria-hidden="true"/><h3>{t.removed}</h3><ul className="page-list">{t.removedList.map(item=><li key={item}>{item}</li>)}</ul></article>
    <article className="surface page-card"><ShieldCheck aria-hidden="true"/><h3>{t.kept}</h3><p>{t.keptText}</p></article>
    <article className="surface page-card"><Package aria-hidden="true"/><h3>{t.blockers}</h3><p>{t.blockersText}</p></article>
    <article className="surface page-card"><MessageCircle aria-hidden="true"/><h3>{t.alt}</h3><p>{t.altText}</p><div className="page-card-links"><Link href="/support">{t.support}<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/privacy#privacy-delete">{t.privacy}<ArrowRight size={16} aria-hidden="true"/></Link></div></article>
   </div>
  </section>
 </>;
}
