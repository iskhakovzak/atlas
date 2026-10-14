import type {Locale} from './i18n.ts';
import {toCyrillic,verbatim} from './uz-cyrl.ts';

/**
 * Uzbek and English texts for the Russian refusals that domain code throws as plain `Error("…")`
 * (lib/market/domain.ts, actions.ts, policy.ts, world.ts, lib/importer/*) and that reach a customer through failure()
 * or /api/import. Without this table every such refusal became the generic "Check the details and try again."
 * Uzbek Cyrillic (`oz`) is the Uzbek Latin text transliterated; values taken from the message (numbers,
 * product names, amounts) stay as they were written. Operator-only refusals are not here: the operator
 * workspace is in Russian (tests/domain-errors.test.mjs keeps that list).
 * `{1}`, `{2}` in a template are the capture groups of the entry's pattern.
 */
type Texts={uz:string;en:string};
type Entry=Texts&{ru:string|RegExp};

/** Kept as written in Cyrillic: a protocol name, not an Uzbek word. */
const https=verbatim('https://');

const entries:readonly Entry[]=[
 // Cart and its services (lib/market/domain.ts).
 {ru:'Товар уже удалён из корзины.',uz:'Bu tovar savatdan allaqachon olib tashlangan. Sahifani yangilang.',en:'This item has already been removed from your cart. Refresh the page.'},
 {ru:'Товар уже удалён из корзины. Обновите страницу.',uz:'Bu tovar savatdan allaqachon olib tashlangan. Sahifani yangilang.',en:'This item has already been removed from your cart. Refresh the page.'},
 {ru:'Одна из услуг больше недоступна. Обновите страницу.',uz:'Xizmatlardan biri endi mavjud emas. Sahifani yangilang.',en:'One of the services is no longer available. Refresh the page.'},
 {ru:'Количество можно задать только для выбранной услуги.',uz:'Miqdorni faqat tanlangan xizmat uchun belgilash mumkin. Avval xizmatni tanlang.',en:'You can set a quantity only for a selected service. Select the service first.'},
 {ru:'Проверьте количество дополнительной услуги.',uz:'Qo‘shimcha xizmat miqdori noto‘g‘ri. Uni tekshirib, qayta urinib ko‘ring.',en:'The extra service quantity isn’t valid. Check it and try again.'},
 {ru:'Проверьте доставку магазина.',uz:'Do‘kon yetkazib berish narxi noto‘g‘ri ko‘rsatilgan. Uni tekshirib, tovarni qayta qo‘shing.',en:'The store delivery cost isn’t valid. Check it and add the item again.'},
 {ru:'Выберите экспресс или обычную доставку.',uz:'Ekspress yoki oddiy yetkazishni tanlang.',en:'Choose express or standard delivery.'},
 {ru:'Корзина пуста.',uz:'Savat bo‘sh. Avval tovar qo‘shing.',en:'Your cart is empty. Add items first.'},
 {ru:'Выберите вариант товара.',uz:'Tovar variantini tanlang, so‘ng uni savatga qo‘shing.',en:'Choose the item’s option, then add it to the cart.'},
 {ru:/^В магазине осталось (\d+) шт\. этого варианта\.$/,uz:'Do‘konda bu variantdan atigi {1} dona qoldi. Miqdorni kamaytiring.',en:'The store has only {1} of this option left. Lower the quantity.'},
 {ru:/^В магазине осталось (\d+) шт\. «([\s\S]+)»\. Уменьшите количество\.$/,uz:'Do‘konda «{2}» tovaridan atigi {1} dona qoldi. Miqdorni kamaytiring.',en:'The store has only {1} of “{2}” left. Lower the quantity.'},
 // Checkout.
 {ru:'Подтвердите таможенные условия.',uz:'Bojxona shartlarini tasdiqlang, so‘ng buyurtmani qayta rasmiylashtiring.',en:'Accept the customs terms, then check out again.'},
 {ru:'Уточните стоимость доставки магазина для каждого товара по ссылке.',uz:'Havola orqali qo‘shilgan har bir tovar uchun do‘kon yetkazib berish narxini ko‘rsating.',en:'Enter the store delivery cost for each item added by link.'},
 {ru:'Корзина изменилась. Проверьте новый итог перед оформлением.',uz:'Savat o‘zgardi. Rasmiylashtirishdan oldin yangi jami summani tekshiring.',en:'Your cart changed. Check the new total before checking out.'},
 {ru:'Одна из выбранных услуг больше недоступна. Обновите корзину.',uz:'Tanlangan xizmatlardan biri endi mavjud emas. Savatni yangilang.',en:'One of the selected services is no longer available. Refresh your cart.'},
 {ru:'Количество дополнительной услуги изменилось. Проверьте корзину заново.',uz:'Qo‘shimcha xizmat miqdori o‘zgardi. Savatni qayta tekshiring.',en:'The extra service quantity changed. Check your cart again.'},
 {ru:'Магазин изменил данные товара. Загрузите отмеченные товары заново.',uz:'Do‘kon tovar ma’lumotlarini o‘zgartirdi. Belgilangan tovarlarni qayta yuklang.',en:'The store changed the item details. Load the marked items again.'},
 {ru:'Корзина пересчитана. Проверьте новый итог перед оформлением.',uz:'Savat qayta hisoblandi. Rasmiylashtirishdan oldin yangi jami summani tekshiring.',en:'Your cart was recalculated. Check the new total before checking out.'},
 {ru:'Выбранный получатель больше не сохранён. Обновите профиль.',uz:'Tanlangan qabul qiluvchi endi saqlanmagan. Sahifani yangilab, qabul qiluvchini qayta tanlang.',en:'The selected recipient is no longer saved. Refresh the page and choose the recipient again.'},
 {ru:'Паспорт не привязан к выбранному получателю.',uz:'Pasport tanlangan qabul qiluvchiga bog‘lanmagan. Shu qabul qiluvchining pasport ma’lumotlarini kiriting.',en:'The passport isn’t linked to the selected recipient. Enter this recipient’s passport details.'},
 {ru:'Баланс изменился. Проверьте итог заново.',uz:'Balans o‘zgardi. Jami summani qayta tekshiring.',en:'Your balance changed. Check the total again.'},
 // Passport, recipients, declaration.
 {ru:'Проверьте номер паспорта.',uz:'Pasport raqami noto‘g‘ri. Seriya va raqamni pasportdagidek kiriting.',en:'The passport number isn’t valid. Enter the series and number as shown in the passport.'},
 {ru:'ПИНФЛ — 14 цифр. Проверьте его в паспорте или ID-карте.',uz:'JSHSHIR — 14 ta raqam. Uni pasport yoki ID-kartadan tekshiring.',en:'The PINFL has 14 digits. Check it in the passport or ID card.'},
 {ru:'Проверьте дату рождения.',uz:'Tug‘ilgan sana noto‘g‘ri. Uni pasportdagidek kiriting.',en:'The date of birth isn’t valid. Enter it as shown in the passport.'},
 {ru:'Документ паспорта не указан.',uz:'Pasport hujjati ko‘rsatilmagan. Pasport ma’lumotlarini qayta kiriting.',en:'No passport document was given. Enter the passport details again.'},
 {ru:'Получатель не найден. Обновите страницу.',uz:'Qabul qiluvchi topilmadi. Sahifani yangilang.',en:'Recipient not found. Refresh the page.'},
 {ru:'Выберите хотя бы один действующий заказ.',uz:'Kamida bitta faol buyurtmani tanlang.',en:'Select at least one active order.'},
 {ru:'Подготовьте отдельную декларацию для каждого получателя.',uz:'Har bir qabul qiluvchi uchun alohida deklaratsiya tayyorlang: faqat bitta qabul qiluvchining buyurtmalarini tanlang.',en:'Prepare a separate declaration for each recipient: select orders for one recipient only.'},
 {ru:'Сначала подтвердите паспортные данные получателя.',uz:'Avval qabul qiluvchining pasport ma’lumotlarini tasdiqlang.',en:'Confirm the recipient’s passport details first.'},
 // Orders, payments, extra payments.
 {ru:'Заказ не найден.',uz:'Buyurtma topilmadi. Sahifani yangilang.',en:'Order not found. Refresh the page.'},
 {ru:'Оплата недоступна: платёжный провайдер не подключён.',uz:'Bu buyurtma uchun to‘lov hozir mavjud emas. Uning joriy holatini ko‘rish uchun sahifani yangilang.',en:'Payment isn’t available for this order right now. Refresh the page to see its current status.'},
 {ru:'Сумма изменилась. Проверьте расчёт.',uz:'Summa o‘zgardi. Hisob-kitobni qayta tekshiring.',en:'The amount changed. Check the calculation again.'},
 {ru:'Запрос уже обработан или не найден.',uz:'So‘rov allaqachon ko‘rib chiqilgan yoki topilmadi. Sahifani yangilang.',en:'The request has already been handled or wasn’t found. Refresh the page.'},
 {ru:'Сумма изменилась. Проверьте запрос заново.',uz:'Summa o‘zgardi. So‘rovni qayta tekshiring.',en:'The amount changed. Review the request again.'},
 {ru:'Счёт на доплату не найден.',uz:'Qo‘shimcha to‘lov hisobi topilmadi. Sahifani yangilang.',en:'The extra payment invoice wasn’t found. Refresh the page.'},
 {ru:'Этот счёт больше не ждёт оплаты.',uz:'Bu hisob endi to‘lovni kutmayapti. Sahifani yangilang.',en:'This invoice is no longer awaiting payment. Refresh the page.'},
 {ru:'Заказ уже выкуплен. Автоматическая отмена недоступна.',uz:'Buyurtma allaqachon xarid qilingan, uni avtomatik bekor qilib bo‘lmaydi. Yordam xizmatiga yozing.',en:'The order has already been purchased, so it can’t be cancelled automatically. Contact support.'},
 // Warehouse services the customer asks for.
 {ru:'Услуги можно запросить после приёмки товара и до взвешивания.',uz:'Xizmatlarni tovar omborga qabul qilingandan keyin va tortilishidan oldin so‘rash mumkin.',en:'Services can be requested after the item is received at the warehouse and before it’s weighed.'},
 {ru:'Сначала дождитесь ответа на текущий запрос по заказу.',uz:'Avval buyurtma bo‘yicha joriy so‘rovga javobni kuting.',en:'Wait for a reply to the current request on this order first.'},
 {ru:'Достигнут лимит услуг для этого заказа.',uz:'Bu buyurtma uchun xizmatlar limiti tugadi. Yana kerak bo‘lsa, yordam xizmatiga yozing.',en:'This order has reached its service limit. Contact support if you need more.'},
 {ru:'Эта услуга сейчас недоступна.',uz:'Bu xizmat hozir mavjud emas. Boshqa xizmatni tanlang yoki keyinroq urinib ko‘ring.',en:'This service isn’t available right now. Choose another one or try later.'},
 {ru:'Опишите, что именно нужно сделать на складе.',uz:'Omborda aynan nima qilish kerakligini yozing.',en:'Describe exactly what should be done at the warehouse.'},
 {ru:'Комментарий к услуге должен быть не длиннее 500 символов.',uz:'Xizmatga izoh 500 belgidan oshmasligi kerak. Matnni qisqartiring.',en:'The service comment must be 500 characters or fewer. Shorten it.'},
 {ru:'Эта услуга уже запрошена для заказа.',uz:'Bu xizmat buyurtma uchun allaqachon so‘ralgan. Javobni kuting.',en:'This service has already been requested for the order. Wait for the reply.'},
 {ru:'Эта услуга уже запрошена для посылки этого магазина.',uz:'Bu xizmat shu do‘kon jo‘natmasi uchun allaqachon so‘ralgan. Javobni kuting.',en:'This service has already been requested for this store’s parcel. Wait for the reply.'},
 {ru:'Проверьте количество услуги.',uz:'Xizmat miqdori noto‘g‘ri: 1 dan 100 gacha kiriting.',en:'The service quantity isn’t valid: enter 1 to 100.'},
 // Parcel claims.
 {ru:'По этому заказу претензия уже подана.',uz:'Bu buyurtma bo‘yicha da’vo allaqachon yuborilgan. Javobimizni kuting.',en:'A claim for this order has already been filed. Wait for our reply.'},
 {ru:'По этому заказу уже рассмотрено несколько претензий — напишите в поддержку.',uz:'Bu buyurtma bo‘yicha bir nechta da’vo ko‘rib chiqilgan — yordam xizmatiga yozing.',en:'Several claims for this order have already been reviewed — contact support.'},
 {ru:/^Претензию принимаем в течение (\d+) дней после получения\.$/,uz:'Da’vo jo‘natma olingandan keyin {1} kun ichida qabul qilinadi. Bu muddat o‘tgan bo‘lsa, yordam xizmatiga yozing.',en:'Claims are accepted within {1} days of receiving the parcel. If that period has passed, contact support.'},
 {ru:'Претензию можно подать, когда посылка отправлена в Ташкент.',uz:'Da’voni jo‘natma Toshkentga yuborilgandan keyin berish mumkin.',en:'You can file a claim once the parcel has been shipped to Tashkent.'},
 {ru:'О порче сообщают после получения посылки.',uz:'Shikastlanish haqida jo‘natmani olgandan keyin xabar bering.',en:'Report damage after you receive the parcel.'},
 {ru:'Опишите, что случилось: от 10 до 1000 символов.',uz:'Nima bo‘lganini yozing: 10 dan 1000 gacha belgi.',en:'Describe what happened: 10 to 1,000 characters.'},
 // Links typed by the customer (domain.ts validateSource, importer/fetch.ts validateManualSourceUrl).
 {ru:'Введите полную ссылку, начиная с https://.',uz:`${https} bilan boshlanadigan to‘liq havolani kiriting.`,en:'Enter the full link, starting with https://.'},
 {ru:'Нужна HTTPS-ссылка на страницу магазина.',uz:`Do‘kon sahifasiga ${https} bilan boshlanadigan havola kerak. Havolani brauzerdan to‘liq nusxalang.`,en:'A https:// link to the store page is needed. Copy the full link from your browser.'},
 {ru:'Нужна публичная HTTPS-ссылка на страницу товара.',uz:`Tovar sahifasiga ${https} bilan boshlanadigan ochiq havola kerak. Havolani brauzerdan to‘liq nusxalang.`,en:'A public https:// link to the product page is needed. Copy the full link from your browser.'},
 // Cart limits (lib/market/policy.ts).
 {ru:/^В одной партии можно оформить до (\d+) разных позиций\.$/,uz:'Bir partiyada {1} tagacha turli tovarni rasmiylashtirish mumkin. Ba’zi tovarlarni keyingi buyurtmaga qoldiring.',en:'One batch can include up to {1} different items. Leave some for a later order.'},
 {ru:/^Расчётный вес партии превышает ([\d.,]+) кг\.$/,uz:'Partiyaning hisoblangan vazni {1} kg dan oshadi. Ba’zi tovarlarni keyingi buyurtmaga qoldiring.',en:'The batch’s estimated weight is over {1} kg. Leave some items for a later order.'},
 {ru:/^Стоимость товаров в партии выше управляемого предела \$([\d.,]+)\.$/,uz:'Partiyadagi tovarlar qiymati ${1} chegarasidan yuqori. Ba’zi tovarlarni keyingi buyurtmaga qoldiring.',en:'The goods in this batch are worth more than the ${1} limit. Leave some items for a later order.'},
 {ru:/^Категория «([\s\S]+)» временно недоступна для оформления\.$/,uz:'«{1}» toifasini hozircha rasmiylashtirib bo‘lmaydi. Bu tovarni savatdan olib tashlang.',en:'The “{1}” category can’t be ordered for now. Remove this item from the cart.'},
 {ru:/^Товар требует ручной проверки по ограничению «([\s\S]+)»\.$/,uz:'Tovar «{1}» cheklovi bo‘yicha qo‘lda tekshirilishi kerak. Yordam xizmatiga yozing.',en:'The item needs a manual check under the “{1}” restriction. Contact support.'},
 // Items typed in by the customer (lib/market/actions.ts).
 {ru:'Укажите страну, вес с коробкой и доставку магазина.',uz:'Mamlakat, qadoq bilan birga vazn va do‘kon yetkazib berish narxini kiriting.',en:'Enter the country, the weight with packaging and the store delivery cost.'},
 {ru:'Укажите цену, валюту и доставку магазина.',uz:'Narx, valyuta va do‘kon yetkazib berish narxini kiriting.',en:'Enter the price, currency and store delivery cost.'},
 {ru:'Проверьте сумму и валюту.',uz:'Summa yoki valyuta noto‘g‘ri. Ularni tekshirib, qayta urinib ko‘ring.',en:'The amount or currency isn’t valid. Check them and try again.'},
 {ru:'Проверьте общий вес отправления.',uz:'Jo‘natmaning umumiy vazni noto‘g‘ri. Uni tekshirib, qayta urinib ko‘ring.',en:'The total parcel weight isn’t valid. Check it and try again.'},
 {ru:'Укажите вес с коробкой от 0,01 до 49,5 кг.',uz:'Qadoq bilan birga vaznni 0,01 dan 49,5 kg gacha kiriting.',en:'Enter the weight with packaging, from 0.01 to 49.5 kg.'},
 {ru:'Некорректная ссылка на изображение.',uz:'Rasm havolasi noto‘g‘ri. Tovarni do‘kon havolasi orqali qayta yuklang.',en:'The image link isn’t valid. Load the item again from the store link.'},
 // Store checks (lib/importer/*).
 {ru:'Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.',uz:'Do‘kon tovar sahifasi topilmaganini bildirdi. Havolani tekshiring.',en:'The store says this product page wasn’t found. Check the link.'},
 {ru:'Магазин убрал карточку товара. Укажите другую ссылку.',uz:'Do‘kon tovar sahifasini olib tashladi. Boshqa havolani kiriting.',en:'The store removed this product page. Paste another link.'},
 {ru:'Не удалось проверить регион Amazon.',uz:'Amazon mintaqasini tekshirib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',en:'Couldn’t check the Amazon region. Try again in a little while.'},
 {ru:'Не удалось загрузить товар.',uz:'Tovarni yuklab bo‘lmadi. Bir necha daqiqadan so‘ng qayta urinib ko‘ring.',en:'Couldn’t load the item. Try again in a few minutes.'},
 {ru:'Ссылки на товары не найдены. Вставьте прямые ссылки на карточки.',uz:'Tovar havolalari topilmadi. Tovar sahifalariga to‘g‘ridan-to‘g‘ri havolalarni qo‘ying.',en:'No product links were found. Paste direct links to product pages.'},
 {ru:'Не удалось определить товар магазина.',uz:'Do‘kon tovarini aniqlab bo‘lmadi. Tovar sahifasining havolasini qo‘ying.',en:'Couldn’t identify the store’s product. Paste the link to the product page.'},
 {ru:'Магазин не подтвердил валюту цены.',uz:'Do‘kon narx valyutasini tasdiqlamadi. Havolani qayta yuklang yoki ma’lumotlarni qo‘lda kiriting.',en:'The store didn’t confirm the price currency. Load the link again or enter the details by hand.'},
 {ru:'Проверьте и подтвердите цену и вариант товара вручную.',uz:'Tovar narxi va variantini qo‘lda tekshirib, tasdiqlang.',en:'Check and confirm the item’s price and option manually.'},
 {ru:'Выбранный вариант не совпадает с артикулом магазина. Загрузите товар заново.',uz:'Tanlangan variant do‘kon artikuliga mos kelmaydi. Tovarni qayta yuklang.',en:'The selected option doesn’t match the store’s item code. Load the item again.'},
 {ru:/^Цена изменилась: было ([\s\S]+?), сейчас ([\s\S]+?)\. Обновите товар\.$/,uz:'Narx o‘zgardi: {1} edi, hozir {2}. Tovarni yangilang.',en:'The price changed: it was {1}, now {2}. Update the item.'},
 {ru:/^Доставка магазина изменилась: было ([\s\S]+?), сейчас ([\s\S]+?)\. Обновите товар\.$/,uz:'Do‘kon yetkazib berish narxi o‘zgardi: {1} edi, hozir {2}. Tovarni yangilang.',en:'The store delivery cost changed: it was {1}, now {2}. Update the item.'},
 {ru:'Магазин изменил валюту витрины. Обновите товар.',uz:'Do‘kon vitrina valyutasini o‘zgartirdi. Tovarni yangilang.',en:'The store changed its currency. Update the item.'},
 {ru:'Магазин показал цену без валюты. Проверьте валюту товара и загрузите ссылку заново.',uz:'Do‘kon narxni valyutasiz ko‘rsatdi. Tovar valyutasini tekshirib, havolani qayta yuklang.',en:'The store showed the price without a currency. Check the item’s currency and load the link again.'},
 // Catalog availability answers (app/api/catalog-availability).
 {ru:'Товар каталога не найден.',uz:'Katalogda bu tovar topilmadi. Sahifani yangilang.',en:'This catalog item wasn’t found. Refresh the page.'},
 {ru:'Не удалось сохранить ответ о наличии.',uz:'Mavjudlik haqidagi javobni saqlab bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring.',en:'Couldn’t save your availability answer. Refresh the page and try again.'},
 {ru:'Лимит сообщений на сегодня исчерпан.',uz:'Bugungi xabarlar limiti tugadi. Ertaga qayta urinib ko‘ring.',en:'You’ve reached today’s message limit. Try again tomorrow.'},
];

/** Every entry, for tests: the Russian text or pattern with its translations. */
export const domainErrorEntries:readonly Entry[]=entries;

const exact=new Map(entries.flatMap(entry=>typeof entry.ru==='string'?[[entry.ru,entry] as const]:[]));
const patterns=entries.filter((entry):entry is Texts&{ru:RegExp}=>entry.ru instanceof RegExp);

const plain=(text:string)=>text.replace(/[]/g,'');
function fill(template:string,groups:readonly string[],mark:(value:string)=>string){
 return template.replace(/\{(\d)\}/g,(match,index:string)=>groups[Number(index)-1]===undefined?match:mark(groups[Number(index)-1]));
}

/**
 * The customer's-language text of a Russian domain refusal, or undefined when the message is not in the table
 * (the caller then keeps its generic text). Russian needs no translation and also returns undefined.
 */
export function translateDomainError(message:string,locale:Locale):string|undefined{
 if(locale==='ru')return undefined;
 const key=message.trim();
 const found=exact.get(key);
 let groups:string[]=[],entry:Texts|undefined=found;
 if(!entry){
  for(const candidate of patterns){
   const match=candidate.ru.exec(key);
   if(match){entry=candidate;groups=match.slice(1);break}
  }
 }
 if(!entry)return undefined;
 if(locale==='en')return plain(fill(entry.en,groups,value=>value));
 if(locale==='oz')return toCyrillic(fill(entry.uz,groups,verbatim));
 return plain(fill(entry.uz,groups,value=>value));
}
