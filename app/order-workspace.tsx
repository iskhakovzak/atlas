"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "@/components/site-link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  IdCard,
  Loader2,
  Package,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
  Bell,
  CheckCheck,
  CreditCard,
  Info,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  RotateCcw,
  Truck,
  UserCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CopyText } from "./copy-text";
import { useMarket } from "@/lib/market/store";
import {
  balanceOf,
  money,
  settle,
  orderPayable,
  orderNeedsOperatorAttention,
  serviceDescription,
  serviceFeeForCountry,
  serviceTitle,
  type Pricing,
  type State,
  type Order,
  type OrderIssueCategory,
  type OrderIssueStatus,
  type Notification,
  type Communication,
  type ServiceOffering,
  type WarehouseServiceRequest,
} from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import { countries } from "@/lib/market/world";
import { localizedStatuses, type Locale } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/home-copy";
import { balanceCopy, countryLabel, formatDateTime, formatShortDate, noticesCopy, orderCount, ordersCopy } from "@/lib/market/customer-copy";
import { allowanceMonth, countsTowardAllowance, monthOf, monthlyUsedFor, orderPerson, orderRecipientName, recipientKey } from "@/lib/market/allowance";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { calcCopy } from "@/lib/market/calc-copy";
import {
  PageHeading,
  Empty,
  Modal,
  CostLines,
  ProductImage,
} from "./market-ui";
// Payments are simulated: the notice speaks of a placed request, never of a payment received.
const passportCopy: Record<Locale, { title: (name: string) => string; text: string; action: string }> = {
  ru: { title: name => `Нужен паспорт получателя: ${name}`, text: "Заявка оформлена. Чтобы подготовить декларацию и таможенное оформление, привяжите паспорт именно этого получателя. Оплата на сайте пока не подключена — деньги не списывались.", action: "Привязать паспорт" },
  uz: { title: name => `Qabul qiluvchi pasporti kerak: ${name}`, text: "Ariza rasmiylashtirildi. Deklaratsiya va bojxona rasmiylashtiruvi uchun aynan shu qabul qiluvchining pasportini biriktiring. Saytda to‘lov hali ulanmagan — pul yechilmagan.", action: "Pasportni biriktirish" },
  en: { title: name => `Recipient passport needed: ${name}`, text: "The request is placed. To prepare the declaration and customs clearance, link this recipient’s own passport. Online payment is not connected yet — no money was charged.", action: "Link passport" },
};
const storeShippingExtra = (o: Order) =>
  !o.storeShippingExtraApproved ? (o.storeShippingSettlement?.extra ?? 0) : 0;
const warehouseExtra = (o: Order) =>
  !o.extraApproved ? (o.settlement?.extra ?? 0) : 0;
const isExtra = (o: Order) =>
  !o.cancelled && Boolean(storeShippingExtra(o) || warehouseExtra(o));
const pendingChange = (o: Order) => (o.changeRequests ?? []).some((request) => request.status === "pending");
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
const localeTag = (locale: Locale) => locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US";
const legacyStoredCopy: Record<string, Record<Locale, string>> = {
  "Оплата заказа из внутреннего баланса Atlas": {
    ru: "Учтено во внутреннем балансе Atlas",
    uz: "Atlas ichki balansida hisobga olindi",
    en: "Accounted for in the Atlas internal balance",
  },
  "Статус оплаты записан в Atlas; провайдер не подключён": {
    ru: "Отметка оплаты записана в Atlas; провайдер не подключён",
    uz: "To‘lov holati Atlasda qayd etildi; provayder ulanmagan",
    en: "Payment status recorded in Atlas; provider not connected",
  },
  "Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание.": {
    ru: "Статус отмечен в Atlas; провайдер не подтвердил списание.",
    uz: "Holat Atlasda qayd etildi; provayder pul yechilishini tasdiqlamadi.",
    en: "Status recorded in Atlas; the provider did not confirm a charge.",
  },
  "Статус оплаты обновлён в Atlas": {
    ru: "Статус оплаты записан в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Платёжный провайдер не подключён: списания и банковского подтверждения нет.": {
    ru: "Платёжный провайдер не подключён: списания и банковского подтверждения нет.",
    uz: "To‘lov provayderi ulanmagan: pul yechilmagan va bank tasdig‘i yo‘q.",
    en: "No payment provider is connected; no charge or bank confirmation exists.",
  },
  "Черновик декларации подготовлен": {
    ru: "Черновик декларации сохранён в Atlas",
    uz: "Deklaratsiya qoralamasi Atlasda saqlandi",
    en: "Declaration draft saved in Atlas",
  },
  "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся.": {
    ru: "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся.",
    uz: "Farq Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.",
    en: "The difference was recorded in the Atlas internal balance. No bank transfer was made.",
  },
  "Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.": {
    ru: "Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.",
    uz: "Qoldiq Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.",
    en: "The remainder was recorded in the Atlas internal balance. No bank transfer was made.",
  },
  "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.": {
    ru: "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.",
    uz: "Buyurtma xariddan oldin bekor qilindi. Summa Atlas ichki balansida qayd etildi; bank o‘tkazmasi bajarilmadi.",
    en: "Order cancelled before purchase. The amount was recorded in the Atlas internal balance; no bank transfer was made.",
  },
  "Оплата заказа демобалансом": {
    ru: "Учтено во внутреннем балансе Atlas",
    uz: "Atlas ichki balansida hisobga olindi",
    en: "Accounted for in the Atlas internal balance",
  },
  "Тестовая оплата по платёжной ссылке": {
    ru: "Отметка оплаты записана в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Тестовый платёж подтверждён. Реального списания не было.": {
    ru: "В Atlas записана отметка; платёж провайдером не подтверждён и деньги не списывались.",
    uz: "Atlasda qayd yozildi; to‘lov provayder tomonidan tasdiqlanmagan va pul yechilmagan.",
    en: "Recorded in Atlas; not confirmed by a payment provider and no money was charged.",
  },
  "Предрелизный платёж принят в тестовом режиме. Реального списания не было.": {
    ru: "Статус записан в Atlas. Платёжный провайдер не подключён, деньги не списывались.",
    uz: "Holat Atlasda qayd etildi. To‘lov provayderi ulanmagan, pul yechilmagan.",
    en: "Status recorded in Atlas. No payment provider is connected and no money was charged.",
  },
  "Оплата подтверждена": {
    ru: "Статус оплаты записан в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Тестовая декларация подготовлена": {
    ru: "Предпросмотр декларации сохранён в Atlas",
    uz: "Deklaratsiya ko‘rib chiqish uchun Atlasda saqlandi",
    en: "Declaration preview saved in Atlas",
  },
  "Разница с резервом возвращена на демобаланс.": {
    ru: "Разница учтена во внутреннем балансе Atlas; перевод не выполнялся.",
    uz: "Farq Atlas ichki balansida qayd etildi; pul o‘tkazilmadi.",
    en: "The difference was recorded in the Atlas internal balance; no transfer was made.",
  },
  "Остаток доставки возвращён на демобаланс.": {
    ru: "Остаток доставки учтён во внутреннем балансе Atlas; перевод не выполнялся.",
    uz: "Yetkazib berish qoldig‘i Atlas ichki balansida qayd etildi; pul o‘tkazilmadi.",
    en: "The shipping remainder was recorded in the Atlas internal balance; no transfer was made.",
  },
  "Отменён до выкупа. Вся сумма возвращена на демобаланс.": {
    ru: "Заказ отменён; сумма учтена во внутреннем балансе Atlas. Перевод денег не выполнялся.",
    uz: "Buyurtma bekor qilindi; summa Atlas ichki balansida qayd etildi. Pul o‘tkazilmadi.",
    en: "Order cancelled; the amount was recorded in the Atlas internal balance. No transfer was made.",
  },
};
function localizeLegacyStoredCopy(value: string, locale: Locale): string {
  const exact = legacyStoredCopy[value];
  if (exact) return exact[locale];

  const checkout = value.match(/^Предрелизный заказ оформлен\. Сумма (.+)\. (Ожидается тестовая оплата|Оплачен демобалансом)\.$/);
  if (checkout) {
    const status = checkout[2] === "Оплачен демобалансом";
    const suffix = status
      ? { ru: "Учтено во внутреннем балансе Atlas", uz: "Atlas ichki balansida hisobga olindi", en: "Accounted for in the Atlas internal balance" }[locale]
      : { ru: "Платёжный провайдер не подключён", uz: "To‘lov provayderi ulanmagan", en: "Payment provider not connected" }[locale];
    return { ru: "Заказ сохранён в Atlas. Сумма", uz: "Buyurtma Atlasda saqlandi. Summa", en: "Order saved in Atlas. Total" }[locale] + ` ${checkout[1]}. ${suffix}.`;
  }

  const currentCheckout = value.match(/^Заказ оформлен в Atlas\. Сумма (.+)\. (Ожидается подтверждение платёжного провайдера|Учтено из внутреннего баланса Atlas)\.$/);
  if (currentCheckout) {
    const accounted = currentCheckout[2] === "Учтено из внутреннего баланса Atlas";
    const suffix = accounted
      ? { ru: "Учтено во внутреннем балансе Atlas", uz: "Atlas ichki balansida hisobga olindi", en: "Accounted for in the Atlas internal balance" }[locale]
      : { ru: "Ожидается подтверждение платёжного провайдера", uz: "To‘lov provayderi tasdig‘i kutilmoqda", en: "Awaiting payment-provider confirmation" }[locale];
    return { ru: "Заказ сохранён в Atlas. Сумма", uz: "Buyurtma Atlasda saqlandi. Summa", en: "Order saved in Atlas. Total" }[locale] + ` ${currentCheckout[1]}. ${suffix}.`;
  }

  const extraApproval = value.match(/^Покупатель подтвердил тестовую доплату (.+)$/);
  if (extraApproval) {
    return {
      ru: `В Atlas записано согласие на доплату ${extraApproval[1]}; списания нет.`,
      uz: `Atlasda ${extraApproval[1]} qo‘shimcha summa bo‘yicha rozilik qayd etildi; pul yechilmadi.`,
      en: `Approval for the additional amount ${extraApproval[1]} was recorded in Atlas; no charge was made.`,
    }[locale];
  }

  const currentExtraApproval = value.match(/^Покупатель согласовал доплату (.+)$/);
  if (currentExtraApproval) {
    return {
      ru: `В Atlas записано согласие на доплату ${currentExtraApproval[1]}; списания нет.`,
      uz: `Atlasda ${currentExtraApproval[1]} qo‘shimcha summa bo‘yicha rozilik qayd etildi; pul yechilmadi.`,
      en: `Approval for the additional amount ${currentExtraApproval[1]} was recorded in Atlas; no charge was made.`,
    }[locale];
  }

  const declaration = value.match(/^Пакет ([A-Z0-9-]+) сохранён внутри Atlas\. В таможню он не отправлялся\.$/);
  if (declaration) {
    return {
      ru: `Пакет ${declaration[1]} сохранён в Atlas; в таможню не отправлялся.`,
      uz: `${declaration[1]} paketi Atlasda saqlandi; bojxonaga yuborilmadi.`,
      en: `Package ${declaration[1]} was saved in Atlas and was not sent to customs.`,
    }[locale];
  }

  return value;
}
const customerOrderCopy = {
  ru: {
    loginTitle: "Войдите, чтобы открыть заказы", loginDescription: "История покупок, фото и расчёты доступны в вашем профиле Atlas.", loginLabel: "Открыть вход", loading: "Загружаем заказы…", emptyTitle: "Здесь начнётся путь вашей покупки", emptyDescription: "Оформите заказ из корзины, чтобы попробовать выкуп, склад и доставку.", choose: "Выбрать товар", filteredTitle: "В этом разделе пока пусто", filteredDescription: "Измените фильтр или поисковый запрос.", search: "Поиск заказа", source: "Источник товара", loadPhoto: "Загрузить фото из ссылки", loadingPhoto: "Загружаем…", checkoutTotal: "Сумма при оформлении", checkoutAt: "При оформлении", buyer: "Покупатель", cancelled: "Отменён", needDecision: "Нужно решение", extra: "Требуется доплата", awaitingPayment: "Ожидает оплаты", paymentWaiting: "Платёжный провайдер не подключён", paymentPaid: "Отметка сохранена в Atlas; провайдером не подтверждена", paymentRefunded: "Возврат отмечен во внутреннем балансе Atlas; перевода нет", paymentLine: "Платёж", noCharge: "Платёжный провайдер не подключён", providerPassed: "Платёжный провайдер не подключён", recordPayment: "Записать статус в Atlas", recipient: "Получатель", tracking: "Трек-номер", parcelRegistered: "Посылка зарегистрирована", warehouseDone: "Приёмка на складе завершена", warehouseProblem: "Склад зафиксировал проблему", received: "Получено", operations: "Операции", noOperations: "Дополнительные операции не назначены", agreements: "Согласования по заказу", pending: "НУЖНО РЕШЕНИЕ", approved: "ПОДТВЕРЖДЕНО", declined: "ОТКЛОНЕНО", reject: "Отклонить", confirm: "Подтвердить", managerChecking: "Менеджер уточняет доставку магазина", reserveIncluded: "В сумму заказа пока включён резерв", reserveWaived: "Резерв на доставку магазина не включён: заказы на такую сумму магазины обычно доставляют бесплатно. Если магазин всё же возьмёт плату, сначала спросим вас.", beforeBuyout: "Перед выкупом вы увидите подтверждённую стоимость.", managerConfirmed: "Менеджер подтвердил доставку магазина", actual: "Фактическая стоимость", reservedAtCheckout: "Резерв при оформлении", refundToBalance: "Вернули на баланс", extraApproved: "Доплата подтверждена", needApprove: "Нужно согласовать", reserveMatch: "Сумма совпала с резервом", balance: "Баланс", shippingOver: "Доставка превысила резерв", shippingCheaper: "Доставка оказалась дешевле", shippingRecalculated: "Доставка пересчитана", payableWeight: "Оплачиваемый вес", cost: "Стоимость", noExtra: "Доплата не требуется", checkExtra: "Проверить доплату", confirmStore: "Подтвердить доставку магазина", confirmBuyout: "Подтвердить выкуп", receiveWarehouse: "Принять на склад", weigh: "Взвесить и пересчитать", sendUzbekistan: "Отправить в Узбекистан", confirmDelivery: "Подтвердить доставку", sendAfterApproval: "Отправка станет доступна после подтверждения в разделе «Мои заказы».", saveReceivingFirst: "Сначала сохраните приёмку товара в блоке оператора.", payFirst: "Выкуп станет доступен после подключения платёжного провайдера и подтверждения оплаты.", trackingFirst: "Перед отправкой добавьте перевозчика и трек-номер.", calculationHistory: "Расчёт и история", customsAccepted: "Таможенные условия приняты", balanceUsed: "Учтено во внутреннем балансе Atlas", actualWeight: "Фактический вес", dimensional: "Объёмный", cancelOrder: "Отменить заказ", storeModalTitle: "Доставка от магазина до склада", storeModalDescription: "Укажите фактическую итоговую стоимость в долларах. Если она ниже резерва, разница сразу вернётся покупателю на баланс.", actualStoreShipping: "Фактическая доставка магазина, USD", reserved: "Было заложено", saveRecalculate: "Подтвердить и пересчитать", warehouseModalTitle: "Взвешивание на складе", warehouseModalDescription: "Вес и размеры всей посылки, включая упаковку. Тариф зафиксирован в заказе.", dimensions: ["Фактический вес, кг", "Длина, см", "Ширина, см", "Высота, см"], volumeWeight: "Объёмный вес", paidShipping: "Было оплачено за доставку", afterWeighing: "После взвешивания", requestExtra: "Запросить доплату", returnBalance: "Зачислить во внутренний баланс Atlas", invalidValues: "Укажите корректные положительные значения.", confirmRecalculate: "Подтвердить перерасчёт", cancelTitle: "Отменить заказ до выкупа?", paymentTitle: "Записать статус оплаты в Atlas?", extraTitle: "Подтвердить сумму доплаты?", cancelDescription: "Заказ будет отменён, а запись внутреннего баланса Atlas пересчитана. Перевод денег не выполняется.", paymentDescription: "Действие изменит только статус заказа в Atlas. Платёжный провайдер не подключён: деньги не списываются, подтверждения банка нет.", extraDescription: "Подтверждение сохранит сумму для дальнейшего согласования. Платёжный провайдер не подключён, деньги не списываются.", refund: "К зачислению на внутренний баланс Atlas", paymentStatusLabel: "Статус оплаты в Atlas", toPay: "К доплате", back: "Назад", saveChanges: "Изменения сохранены", saving: "Сохраняем…", statusUpdated: "Статус заказа обновлён", photoUpdated: "Фото заказа обновлено"
  },
  uz: {
    loginTitle: "Buyurtmalarni ochish uchun kiring", loginDescription: "Xaridlar tarixi, rasmlar va hisob-kitoblar Atlas profilingizda mavjud.", loginLabel: "Kirishni ochish", loading: "Buyurtmalar yuklanmoqda…", emptyTitle: "Xaridingiz yo‘li shu yerda boshlanadi", emptyDescription: "Xarid, ombor va yetkazib berishni sinash uchun savatdan buyurtma bering.", choose: "Tovar tanlash", filteredTitle: "Bu bo‘lim hozircha bo‘sh", filteredDescription: "Filtr yoki qidiruv so‘rovini o‘zgartiring.", search: "Buyurtmani qidirish", source: "Tovar manbasi", loadPhoto: "Havoladan rasm yuklash", loadingPhoto: "Yuklanmoqda…", checkoutTotal: "Rasmiylashtirish summasi", checkoutAt: "Rasmiylashtirishda", buyer: "Xaridor", cancelled: "Bekor qilingan", needDecision: "Qaror kerak", extra: "Qo‘shimcha to‘lov kerak", awaitingPayment: "To‘lov kutilmoqda", paymentWaiting: "To‘lov provayderi ulanmagan", paymentPaid: "Atlasda qayd etildi; to‘lov provayderi tasdiqlamagan", paymentRefunded: "Qaytarish Atlas ichki balansida qayd etildi; pul o‘tkazilmadi", paymentLine: "To‘lov", noCharge: "To‘lov provayderi ulanmagan", providerPassed: "To‘lov provayderi ulanmagan", recordPayment: "To‘lov holatini Atlasda qayd etish", recipient: "Qabul qiluvchi", tracking: "Kuzatuv raqami", parcelRegistered: "Jo‘natma ro‘yxatga olindi", warehouseDone: "Omborda qabul qilish yakunlandi", warehouseProblem: "Ombor muammo qayd etdi", received: "Qabul qilindi", operations: "Amallar", noOperations: "Qo‘shimcha amallar tayinlanmagan", agreements: "Buyurtma bo‘yicha kelishuvlar", pending: "QAROR KERAK", approved: "TASDIQLANGAN", declined: "RAD ETILGAN", reject: "Rad etish", confirm: "Tasdiqlash", managerChecking: "Menejer do‘kon yetkazib berishini aniqlamoqda", reserveIncluded: "Buyurtma summasiga hozircha zaxira kiritilgan", reserveWaived: "Do‘kon yetkazishi uchun zaxira kiritilmagan: bunday summadagi buyurtmalarni do‘konlar odatda bepul yetkazadi. Do‘kon baribir haq olsa, avval sizdan so‘raymiz.", beforeBuyout: "Xariddan oldin tasdiqlangan narxni ko‘rasiz.", managerConfirmed: "Menejer do‘kon yetkazib berishini tasdiqladi", actual: "Haqiqiy summa", reservedAtCheckout: "Rasmiylashtirishdagi zaxira", refundToBalance: "Balansga qaytarildi", extraApproved: "Qo‘shimcha to‘lov tasdiqlandi", needApprove: "Kelishish kerak", reserveMatch: "Summa zaxiraga teng", balance: "Balans", shippingOver: "Yetkazib berish zaxiradan oshdi", shippingCheaper: "Yetkazib berish arzonroq chiqdi", shippingRecalculated: "Yetkazib berish qayta hisoblandi", payableWeight: "Hisoblanadigan vazn", cost: "Narx", noExtra: "Qo‘shimcha to‘lov talab qilinmaydi", checkExtra: "Qo‘shimcha to‘lovni tekshirish", confirmStore: "Do‘kon yetkazib berishini tasdiqlash", confirmBuyout: "Xaridni tasdiqlash", receiveWarehouse: "Omborga qabul qilish", weigh: "Tortish va qayta hisoblash", sendUzbekistan: "O‘zbekistonga jo‘natish", confirmDelivery: "Yetkazib berishni tasdiqlash", sendAfterApproval: "Jo‘natish «Buyurtmalarim» bo‘limida tasdiqlangandan keyin mavjud bo‘ladi.", saveReceivingFirst: "Avval operator blokida tovar qabulini saqlang.", payFirst: "Xarid to‘lov provayderi ulanib, to‘lovni tasdiqlagandan keyin mavjud bo‘ladi.", trackingFirst: "Jo‘natishdan oldin tashuvchi va kuzatuv raqamini kiriting.", calculationHistory: "Hisob-kitob va tarix", customsAccepted: "Bojxona shartlari qabul qilindi", balanceUsed: "Atlas ichki balansida hisobga olindi", actualWeight: "Haqiqiy vazn", dimensional: "Hajmiy", cancelOrder: "Buyurtmani bekor qilish", storeModalTitle: "Do‘kondan omborgacha yetkazib berish", storeModalDescription: "Dollar hisobidagi yakuniy haqiqiy summani kiriting. Zaxiradan kam bo‘lsa, farq xaridor balansiga qaytariladi.", actualStoreShipping: "Do‘konning haqiqiy yetkazib berishi, USD", reserved: "Kiritilgan zaxira", saveRecalculate: "Tasdiqlash va qayta hisoblash", warehouseModalTitle: "Omborda tortish", warehouseModalDescription: "Qadoq bilan birga jo‘natmaning vazni va o‘lchamlari. Tarif buyurtmada qayd etilgan.", dimensions: ["Haqiqiy vazn, kg", "Uzunlik, sm", "Eni, sm", "Balandlik, sm"], volumeWeight: "Hajmiy vazn", paidShipping: "Yetkazib berish uchun to‘langan", afterWeighing: "Tortishdan keyin", requestExtra: "Qo‘shimcha to‘lov so‘rash", returnBalance: "Atlas ichki balansiga qayd etish", invalidValues: "Musbat qiymatlarni to‘g‘ri kiriting.", confirmRecalculate: "Qayta hisoblashni tasdiqlash", cancelTitle: "Xariddan oldin buyurtma bekor qilinsinmi?", paymentTitle: "To‘lov holatini Atlasda qayd etasizmi?", extraTitle: "Qo‘shimcha to‘lov summasini tasdiqlaysizmi?", cancelDescription: "Buyurtma bekor qilinadi va Atlas ichki balansi qayta hisoblanadi. Pul o‘tkazilmaydi.", paymentDescription: "Bu amal faqat Atlasdagi buyurtma holatini o‘zgartiradi. To‘lov provayderi ulanmagan: pul yechilmaydi, bank tasdig‘i olinmaydi.", extraDescription: "Tasdiq summa bo‘yicha kelishuvni qayd etadi. To‘lov provayderi ulanmagan, pul yechilmaydi.", refund: "Atlas ichki balansiga qayd etiladigan summa", paymentStatusLabel: "Atlasda qayd etilgan to‘lov", toPay: "Qo‘shimcha to‘lov", back: "Ortga", saveChanges: "O‘zgarishlar saqlandi", saving: "Saqlanmoqda…", statusUpdated: "Buyurtma holati yangilandi", photoUpdated: "Buyurtma rasmi yangilandi"
  },
  en: {
    loginTitle: "Sign in to open your orders", loginDescription: "Purchase history, photos and calculations are available in your Atlas profile.", loginLabel: "Open sign in", loading: "Loading orders…", emptyTitle: "Your purchase journey starts here", emptyDescription: "Place an order from the cart to try purchase, warehouse and delivery steps.", choose: "Choose an item", filteredTitle: "Nothing in this section yet", filteredDescription: "Change the filter or search query.", search: "Search orders", source: "Product source", loadPhoto: "Load photo from link", loadingPhoto: "Loading…", checkoutTotal: "Checkout total", checkoutAt: "At checkout", buyer: "Buyer", cancelled: "Cancelled", needDecision: "Decision needed", extra: "Additional payment needed", awaitingPayment: "Awaiting payment", paymentWaiting: "Payment provider not connected", paymentPaid: "Recorded in Atlas; not confirmed by a payment provider", paymentRefunded: "Refund recorded in Atlas internal balance; no transfer was made", paymentLine: "Payment", noCharge: "Payment provider is not connected", providerPassed: "Payment provider is not connected", recordPayment: "Record payment status in Atlas", recipient: "Recipient", tracking: "Tracking number", parcelRegistered: "Parcel registered", warehouseDone: "Warehouse intake complete", warehouseProblem: "Warehouse flagged an issue", received: "Received", operations: "Operations", noOperations: "No extra operations assigned", agreements: "Order approvals", pending: "DECISION NEEDED", approved: "APPROVED", declined: "DECLINED", reject: "Decline", confirm: "Approve", managerChecking: "Manager is confirming store shipping", reserveIncluded: "A reserve is included in the order for now", reserveWaived: "No store-delivery reserve is included: stores usually ship orders of this size free. If the store still charges, we ask you first.", beforeBuyout: "You will see the confirmed amount before purchase.", managerConfirmed: "Manager confirmed store shipping", actual: "Actual amount", reservedAtCheckout: "Checkout reserve", refundToBalance: "Refunded to balance", extraApproved: "Additional payment approved", needApprove: "Approval needed", reserveMatch: "Amount matched the reserve", balance: "Balance", shippingOver: "Shipping exceeded the reserve", shippingCheaper: "Shipping was lower", shippingRecalculated: "Shipping recalculated", payableWeight: "Chargeable weight", cost: "Cost", noExtra: "No additional payment required", checkExtra: "Review additional payment", confirmStore: "Confirm store shipping", confirmBuyout: "Confirm purchase", receiveWarehouse: "Receive at warehouse", weigh: "Weigh and recalculate", sendUzbekistan: "Ship to Uzbekistan", confirmDelivery: "Confirm delivery", sendAfterApproval: "Shipping becomes available after approval in My orders.", saveReceivingFirst: "Save the warehouse intake in the operator block first.", payFirst: "Purchase becomes available after a payment provider is connected and confirms payment.", trackingFirst: "Add a carrier and tracking number before shipping.", calculationHistory: "Calculation and history", customsAccepted: "Customs terms accepted", balanceUsed: "Accounted for in Atlas internal balance", actualWeight: "Actual weight", dimensional: "Dimensional", cancelOrder: "Cancel order", storeModalTitle: "Store-to-warehouse shipping", storeModalDescription: "Enter the final actual amount in USD. If it is below the reserve, the difference is returned to the customer balance.", actualStoreShipping: "Actual store shipping, USD", reserved: "Reserved", saveRecalculate: "Confirm and recalculate", warehouseModalTitle: "Warehouse weighing", warehouseModalDescription: "Parcel weight and dimensions including packaging. The tariff is recorded on the order.", dimensions: ["Actual weight, kg", "Length, cm", "Width, cm", "Height, cm"], volumeWeight: "Dimensional weight", paidShipping: "Shipping paid", afterWeighing: "After weighing", requestExtra: "Request additional payment", returnBalance: "Record in Atlas internal balance", invalidValues: "Enter valid positive values.", confirmRecalculate: "Confirm recalculation", cancelTitle: "Cancel before purchase?", paymentTitle: "Record payment status in Atlas?", extraTitle: "Approve the additional amount?", cancelDescription: "The order will be cancelled and the Atlas internal balance entry recalculated. No money transfer is made.", paymentDescription: "This only updates the order status in Atlas. No payment provider is connected, so no money is charged and no bank confirmation is received.", extraDescription: "This records the amount for follow-up only. No payment provider is connected and no money is charged.", refund: "To internal Atlas balance", paymentStatusLabel: "Payment status in Atlas", toPay: "To pay", back: "Back", saveChanges: "Changes saved", saving: "Saving…", statusUpdated: "Order status updated", photoUpdated: "Order photo updated"
  }
} as const;
const customerOrderDisclosureCopy = {
  ru: {paymentWaiting:'Оплата ожидается',paymentPaid:'В Atlas записана отметка; платёж не подтверждён провайдером',paymentRefunded:'Возврат учтён во внутреннем балансе Atlas',providerPassed:'Платёжный провайдер не подключён',recordPayment:'Отметить оплату в Atlas',payFirst:'Выкуп станет доступен после подключения оплаты и её подтверждения провайдером.',balanceUsed:'Учтено по внутреннему балансу Atlas',returnBalance:'Вернуть на внутренний баланс',cancelDescription:'Заказ будет отменён, а внутренняя запись баланса пересчитана. Внешний перевод не выполняется.',paymentTitle:'Записать отметку об оплате?',paymentDescription:'Действие изменит только статус заказа в Atlas. Платёжный провайдер не подключён: деньги не списываются, подтверждения банка нет.',extraTitle:'Подтвердить сумму доплаты?',extraDescription:'Это подтверждает сумму для дальнейшего согласования. Оплата через провайдера ещё не подключена.',refund:'К зачислению на внутренний баланс',paymentStatusLabel:'Отметка оплаты в Atlas'},
  uz: {paymentWaiting:'To‘lov kutilmoqda',paymentPaid:'Atlasda qayd yozildi; to‘lov provayder tomonidan tasdiqlanmagan',paymentRefunded:'Qaytarish Atlas ichki balansida qayd etildi',providerPassed:'To‘lov provayderi ulanmagan',recordPayment:'To‘lovni Atlasda qayd etish',payFirst:'Xarid to‘lov provayderi ulanib, to‘lov tasdiqlangandan keyin mavjud bo‘ladi.',balanceUsed:'Atlas ichki balansida hisobga olindi',returnBalance:'Ichki balansga qaytarish',cancelDescription:'Buyurtma bekor qilinadi va ichki balans qayta hisoblanadi. Tashqi pul o‘tkazmasi bajarilmaydi.',paymentTitle:'To‘lov belgisini qayd etasizmi?',paymentDescription:'Bu amal faqat Atlasdagi buyurtma holatini o‘zgartiradi. To‘lov provayderi ulanmagan: pul yechilmaydi va bank tasdig‘i olinmaydi.',extraTitle:'Qo‘shimcha to‘lov summasini tasdiqlaysizmi?',extraDescription:'Bu summa keyingi kelishuv uchun tasdiqlanadi. Provayder orqali to‘lov hali ulanmagan.',refund:'Ichki balansga yoziladigan summa',paymentStatusLabel:'Atlasdagi to‘lov qaydi'},
  en: {paymentWaiting:'Payment pending',paymentPaid:'Recorded in Atlas; not confirmed by a payment provider',paymentRefunded:'Refund recorded in Atlas internal balance',providerPassed:'Payment provider is not connected',recordPayment:'Record payment status in Atlas',payFirst:'Purchase is available after a payment provider is connected and confirms payment.',balanceUsed:'Accounted for in Atlas internal balance',returnBalance:'Return to internal balance',cancelDescription:'The order will be cancelled and the internal balance entry recalculated. No external transfer is made.',paymentTitle:'Record a payment status?',paymentDescription:'This only updates the order status in Atlas. No payment provider is connected, so no money is charged and no bank confirmation is received.',extraTitle:'Approve the additional amount?',extraDescription:'This confirms the amount for follow-up. Provider-backed payment is not connected.',refund:'To internal balance',paymentStatusLabel:'Payment status in Atlas'},
} as const;
const customerOrderEmptyCopy = {
  ru: 'Оформите заказ из корзины, чтобы начать покупки через Atlas.',
  uz: 'Atlas orqali xaridni boshlash uchun savatdan buyurtma bering.',
  en: 'Place an order from your cart to start shopping with Atlas.',
} as const;
type OperationsAccount = {
  id: string;
  name: string;
  state: State;
  revision: number;
  updatedAt: number;
};
const operatorPhoneHref = (value: string | undefined) => {
  const phone = value?.trim().replace(/[^\d+]/g, "") ?? "";
  return /^\+?\d{8,15}$/.test(phone) ? `tel:${phone}` : undefined;
};
function OperatorOrderContacts({order,account,locale}:{order:Order;account:OperationsAccount|undefined;locale:Locale}) {
  if (!account) return null;
  const copy={
    ru:{title:"Контакты заказа",buyer:"Покупатель · аккаунт",email:"Email аккаунта",profilePhone:"Телефон в профиле",recipient:"Получатель по заказу",recipientPhone:"Телефон получателя",notVerified:"Указан в профиле · не подтверждён",missing:"Не указан",call:"Позвонить",write:"Написать"},
    uz:{title:"Buyurtma kontaktlari",buyer:"Xaridor · akkaunt",email:"Akkaunt emaili",profilePhone:"Profildagi telefon",recipient:"Buyurtma oluvchisi",recipientPhone:"Oluvchi telefoni",notVerified:"Profilda ko‘rsatilgan · tasdiqlanmagan",missing:"Ko‘rsatilmagan",call:"Qo‘ng‘iroq qilish",write:"Yozish"},
    en:{title:"Order contacts",buyer:"Purchaser · account",email:"Account email",profilePhone:"Profile phone",recipient:"Order recipient",recipientPhone:"Recipient phone",notVerified:"Listed in profile · not verified",missing:"Not provided",call:"Call",write:"Email"},
  }[locale];
  const email=account.id.replace(/^email:/i,"");
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:"";
  const profilePhone=account.state.communication.phone?.trim()||"";
  const recipientPhone=order.delivery?.phone?.trim()||"";
  const profileTel=operatorPhoneHref(profilePhone);
  const recipientTel=operatorPhoneHref(recipientPhone);
  const mailto=validEmail?`mailto:${validEmail}?subject=${encodeURIComponent(`Atlas — ${order.id}`)}`:undefined;
  return <section className="operator-contact-panel" aria-label={copy.title}>
    <span className="eyebrow">{copy.title}</span>
    <div className="operator-contact-grid">
      <div className="operator-contact-person">
        <b>{copy.buyer}</b>
        <strong>{account.name}</strong>
        <span className="operator-contact-detail">{copy.email}: {validEmail||copy.missing}</span>
        <span className="operator-contact-detail">{copy.profilePhone}: {profilePhone||copy.missing}{profilePhone&&<small>{copy.notVerified}</small>}</span>
        <div className="operator-contact-actions">
          {mailto&&<a className="btn secondary" href={mailto}><Mail size={16}/>{copy.write}</a>}
          {profileTel&&<a className="btn secondary" href={profileTel}><Phone size={16}/>{copy.call}</a>}
        </div>
      </div>
      <div className="operator-contact-person">
        <b>{copy.recipient}</b>
        <strong>{order.delivery?.recipient||copy.missing}</strong>
        <span className="operator-contact-detail">{copy.recipientPhone}: {recipientPhone||copy.missing}</span>
        <div className="operator-contact-actions">
          {recipientTel&&<a className="btn secondary" href={recipientTel}><Phone size={16}/>{copy.call}</a>}
        </div>
      </div>
    </div>
  </section>;
}
const atlasCreditForOrder = (account: OperationsAccount | undefined, orderId: string) =>
  account?.state.entries.reduce(
    (total, entry) => entry.orderId === orderId && entry.credit === "customer-credit"
      ? total + entry.amount
      : total,
    0,
  ) ?? 0;

const orderIssueWords = {
  ru: {
    title: "Проблема / возврат", intro: "Зафиксируйте причину и следующий шаг. Предлагаемая сумма — только для разбора: платёж и баланс не меняются.",
    category: "Причина", categories: { stalled: "Заказ задержан", merchant: "Проблема магазина", payment: "Платёж или сумма", warehouse: "Склад или товар", delivery: "Доставка", other: "Другое" },
    status: "Статус случая", statuses: { open: "Открыт", investigating: "Проверяем", "waiting-customer": "Ждём покупателя", "waiting-merchant": "Ждём магазин / перевозчика", "refund-review": "Проверяем возврат", resolved: "Решён" },
    refund: "Предложенная сумма возврата, сум", refundHint: "Не является возвратом средств и не меняет статус платежа.", save: "Сохранить разбор", saving: "Сохраняем…", saved: "Разбор случая сохранён", invalid: "Введите целую сумму от 0 до 100 000 000 сум или оставьте поле пустым.", history: "История случая", noHistory: "Изменений пока нет.", noAmount: "Сумма не предлагалась", messages: "Уведомления по заказу в кабинете покупателя",
  },
  uz: {
    title: "Muammo / qaytarish ishi", intro: "Sabab va keyingi qadamni qayd eting. Taklif qilingan summa faqat ko‘rib chiqish uchun: to‘lov va balans o‘zgarmaydi.",
    category: "Sabab", categories: { stalled: "Buyurtma kechikdi", merchant: "Do‘kon muammosi", payment: "To‘lov yoki summa", warehouse: "Ombor yoki tovar", delivery: "Yetkazib berish", other: "Boshqa" },
    status: "Ish holati", statuses: { open: "Ochiq", investigating: "Tekshirilmoqda", "waiting-customer": "Xaridor kutilmoqda", "waiting-merchant": "Do‘kon / tashuvchi kutilmoqda", "refund-review": "Qaytarish tekshirilmoqda", resolved: "Hal qilindi" },
    refund: "Taklif qilingan qaytarish summasi, so‘m", refundHint: "Bu mablag‘ni qaytarish emas va to‘lov holatini o‘zgartirmaydi.", save: "Ko‘rib chiqishni saqlash", saving: "Saqlanmoqda…", saved: "Ish qaydi saqlandi", invalid: "0–100 000 000 so‘m oralig‘ida butun summa kiriting yoki maydonni bo‘sh qoldiring.", history: "Ish tarixi", noHistory: "Hali o‘zgarishlar yo‘q.", noAmount: "Summa taklif qilinmagan", messages: "Xaridor kabinetidagi buyurtma bildirishnomalari",
  },
  en: {
    title: "Problem / refund case", intro: "Record the cause and next step. Any amount is a proposal for review only; payment and balance remain unchanged.",
    category: "Issue type", categories: { stalled: "Order delayed", merchant: "Store issue", payment: "Payment or amount", warehouse: "Warehouse or item", delivery: "Delivery", other: "Other" },
    status: "Case status", statuses: { open: "Open", investigating: "Investigating", "waiting-customer": "Waiting for customer", "waiting-merchant": "Waiting for store / carrier", "refund-review": "Refund under review", resolved: "Resolved" },
    refund: "Proposed refund amount, UZS", refundHint: "This does not issue a refund or change the payment status.", save: "Save case update", saving: "Saving…", saved: "Case update saved", invalid: "Enter a whole amount from 0 to 100,000,000 UZS, or leave the field empty.", history: "Case history", noHistory: "No changes recorded yet.", noAmount: "No amount proposed", messages: "Order notifications in the customer account",
  },
} as const;

function OrderIssueCasePanel({ order, notifications, run, locale }: {
  order: Order; notifications: Notification[]; run: (action: Action) => Promise<boolean>; locale: Locale;
}) {
  const [category, setCategory] = useState<OrderIssueCategory>(order.issueCase?.category ?? "stalled");
  const [status, setStatus] = useState<OrderIssueStatus>(order.issueCase?.status ?? "open");
  const [proposedRefund, setProposedRefund] = useState(order.issueCase?.proposedRefund === undefined ? "" : String(order.issueCase.proposedRefund));
  const [busy, setBusy] = useState(false);
  const words = orderIssueWords[locale];
  const categoryLabels: Record<OrderIssueCategory, string> = words.categories;
  const statusLabels: Record<OrderIssueStatus, string> = words.statuses;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const amount = proposedRefund.trim() === "" ? undefined : Number(proposedRefund);
    if (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000)) { toast.error(words.invalid); return; }
    setBusy(true);
    try { if (await run({ type: "order-issue-update", id: order.id, category, status, proposedRefund: amount })) toast.success(words.saved); }
    finally { setBusy(false); }
  }
  return <section className="warehouse-service-ops order-issue-case">
    <h3>{words.title}</h3><p className="micro">{words.intro}</p>
    <form onSubmit={(event) => void save(event)}>
      <div className="two-fields">
        <div className="field"><label htmlFor={`issue-category-${order.id}`}>{words.category}</label><select id={`issue-category-${order.id}`} value={category} onChange={(event) => setCategory(event.target.value as OrderIssueCategory)}>{(Object.keys(categoryLabels) as OrderIssueCategory[]).map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}</select></div>
        <div className="field"><label htmlFor={`issue-status-${order.id}`}>{words.status}</label><select id={`issue-status-${order.id}`} value={status} onChange={(event) => setStatus(event.target.value as OrderIssueStatus)}>{(Object.keys(statusLabels) as OrderIssueStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor={`issue-refund-${order.id}`}>{words.refund}</label><input id={`issue-refund-${order.id}`} type="number" min="0" max="100000000" step="1" inputMode="numeric" value={proposedRefund} onChange={(event) => setProposedRefund(event.target.value)} /><small>{words.refundHint}</small></div>
      <button className="btn secondary" disabled={busy}>{busy ? words.saving : words.save}</button>
    </form>
    {order.issueCase?.history.length ? <div className="staff-notes"><h4>{words.history}</h4><ol className="history-list">{[...order.issueCase.history].reverse().slice(0, 5).map((entry) => <li key={entry.id}><time>{new Date(entry.at).toLocaleString(localeTag(locale))}</time><span>{categoryLabels[entry.category]} · {statusLabels[entry.status]}</span><span>{entry.proposedRefund === undefined ? words.noAmount : `${words.refund}: ${money(entry.proposedRefund)}`}</span></li>)}</ol></div> : <p className="micro">{words.noHistory}</p>}
    {!!notifications.length && <details className="order-issue-notification-history"><summary>{words.messages} · {notifications.length}</summary><ol className="history-list">{notifications.slice(0, 5).map((item) => <li key={item.id}><time>{new Date(item.at).toLocaleString(localeTag(locale))}</time><span><b>{item.title}</b></span><span>{item.message}</span></li>)}</ol></details>}
  </section>;
}

function OperatorOrderTools({
  order,
  notifications,
  run,
  locale,
}: {
  order: Order;
  notifications: Notification[];
  run: (action: Action) => Promise<boolean>;
  locale: Locale;
}) {
  const [team, setTeam] = useState<"Закупки" | "Склад" | "Поддержка" | "Финансы">(order.assignment?.team ?? "Закупки");
  const [priority, setPriority] = useState<"Обычный" | "Высокий" | "Срочный">(order.assignment?.priority ?? "Обычный");
  const [carrier, setCarrier] = useState(order.parcel?.carrier ?? "Atlas Cargo");
  const [tracking, setTracking] = useState(order.parcel?.trackingNumber ?? "");
  const [warehouseCode, setWarehouseCode] = useState(order.parcel?.warehouseCode ?? "WH-TAS-01");
  const [condition, setCondition] = useState<"ok" | "damaged" | "mismatch">(order.warehouseInspection?.condition ?? "ok");
  const [received, setReceived] = useState(String(order.warehouseInspection?.quantityReceived ?? order.quantity));
  const [warehouseNotes, setWarehouseNotes] = useState(order.warehouseInspection?.notes ?? "");
  const [packageGroup, setPackageGroup] = useState(order.warehouseInspection?.packageGroup ?? "");
  const [services, setServices] = useState<Array<"photo" | "repack" | "consolidate" | "split" | "fragile">>(order.warehouseInspection?.services ?? []);
  const [changeKind, setChangeKind] = useState<"price" | "variant" | "substitution" | "source-shipping" | "warehouse-service" | "customs">("variant");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [serviceQuoteAmounts, setServiceQuoteAmounts] = useState<Record<string, string>>({});
  const [serviceQuoteReasons, setServiceQuoteReasons] = useState<Record<string, string>>({});
  const [serviceDeclineReasons, setServiceDeclineReasons] = useState<Record<string, string>>({});
  const [previousValue, setPreviousValue] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [amountDelta, setAmountDelta] = useState("0");
  const [resolvesWarehouseIssue, setResolvesWarehouseIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (action: Action, message: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const ok = await run(action);
      if (ok) toast.success(message);
      return ok;
    } finally {
      setBusy(false);
    }
  };
  if (order.cancelled) return <details className="ops-tools order-refund-tools">
    <summary><MessageSquareText size={17} /> Комментарий и разбор возврата</summary>
    <OrderIssueCasePanel order={order} notifications={notifications} run={run} locale={locale} />
  </details>;
  return (
    <details className="ops-tools">
      <summary><UserCheck size={17} /> Команда, трекинг и заметки</summary>
      <OrderIssueCasePanel order={order} notifications={notifications} run={run} locale={locale} />
      {(order.warehouseServiceRequests ?? []).some((request) => ["requested", "approved"].includes(request.status)) && <section className="warehouse-service-ops">
        <h3>Услуги склада</h3>
        <p className="micro">Тарифы и пожелания — настройки Atlas. Перед подтверждением оператор проверяет возможности склада, точную стоимость и условия выполнения; эта запись не означает списание или выполненную операцию.</p>
        {pendingChange(order) && <p className="notice warning">{locale === "ru" ? "Сейчас ждём решения покупателя. Новую цену или услугу можно предложить после его ответа." : locale === "uz" ? "Hozir xaridor javobi kutilmoqda. Javobdan keyin yangi narx yoki xizmat taklif qilishingiz mumkin." : "Waiting for the customer’s decision. Offer another price or service after they respond."}</p>}
        {(order.warehouseServiceRequests ?? []).filter((request) => ["requested", "approved"].includes(request.status)).map((request) => {
          const expectedAmount = (request.feeUzs ?? 0) * request.units;
          const amountValue = serviceQuoteAmounts[request.id] ?? String(expectedAmount);
          const reasonValue = serviceQuoteReasons[request.id] ?? "Проверена возможность услуги и согласована её стоимость.";
          const declineReason = serviceDeclineReasons[request.id] ?? "Эта услуга недоступна на нашем складе.";
          return <article className="warehouse-service-admin-row" key={request.id}>
            <div><b>{serviceTitle(request, locale)}</b><p>{serviceDescription(request, locale)}</p><p>{request.units} × {request.unit === "item" ? "шт." : request.unit === "photo" ? "фото" : request.unit === "day" ? "дн." : request.unit === "half-hour" ? "30 мин." : "посылка"}</p>{request.customerNote && <p className="warehouse-customer-note"><b>Пожелание клиента</b><span>{request.customerNote}</span></p>}{request.pricingMode === "fixed" && <p className="micro">Тариф из настроек: {money(request.feeUzs ?? 0)} за единицу · предложение за {request.units} ед.: {money(expectedAmount)}.</p>}</div>
            {request.status === "requested" && order.status === 2 && order.warehouseInspection ? <form className="warehouse-service-quote" onSubmit={(event) => {
              event.preventDefault();
              const amount = Math.round(Number(amountValue));
              void save({ type: "change-request-create", id: order.id, kind: "warehouse-service", title: request.title.ru, reason: reasonValue, warehouseServiceRequestId: request.id, amountDelta: amount }, "Стоимость услуги отправлена покупателю");
            }}>
              <div className="field"><label htmlFor={`warehouse-service-amount-${request.id}`}>Стоимость, сум{request.pricingMode === "fixed" ? " · тариф из настроек" : ""}</label><input id={`warehouse-service-amount-${request.id}`} type="number" min="0" max="100000000" step="1" required value={amountValue} disabled={request.pricingMode === "fixed"} onChange={(event) => setServiceQuoteAmounts((current) => ({ ...current, [request.id]: event.target.value }))} /></div>
              <div className="field"><label htmlFor={`warehouse-service-reason-${request.id}`}>Комментарий покупателю</label><input id={`warehouse-service-reason-${request.id}`} minLength={2} maxLength={500} required value={reasonValue} onChange={(event) => setServiceQuoteReasons((current) => ({ ...current, [request.id]: event.target.value }))} /></div>
              <button className="btn secondary" disabled={busy || pendingChange(order)}>Отправить стоимость на согласование</button>
              <div className="field warehouse-service-decline-reason"><label htmlFor={`warehouse-service-decline-${request.id}`}>Причина отказа</label><input id={`warehouse-service-decline-${request.id}`} minLength={2} maxLength={500} required value={declineReason} onChange={(event) => setServiceDeclineReasons((current) => ({ ...current, [request.id]: event.target.value }))} /></div>
              <button type="button" className="text-button warehouse-service-decline" disabled={busy || pendingChange(order)} onClick={() => void save({ type: "warehouse-service-decline", id: order.id, requestId: request.id, reason: declineReason }, "Запрос отмечен недоступным")}>Отметить услугу недоступной</button>
            </form> : request.status === "requested" ? <p className="micro">Согласование станет доступно после приёмки товара на склад.</p> : <div className="warehouse-service-completion"><strong>{money(request.quotedAmount ?? expectedAmount)}</strong><button className="btn secondary" disabled={busy} onClick={() => void save({ type: "warehouse-service-complete", id: order.id, requestId: request.id }, "Статус услуги обновлён")}>Отметить выполненной</button></div>}
          </article>;
        })}
      </section>}
      <div className="ops-tools-grid">
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "assign-order", id: order.id, team, priority }, "Ответственный и приоритет сохранены"); }}>
          <h3>Ответственный</h3>
          <div className="two-fields">
            <div className="field"><label htmlFor={`team-${order.id}`}>Команда</label><select id={`team-${order.id}`} value={team} onChange={(event) => setTeam(event.target.value as typeof team)}>{["Закупки", "Склад", "Поддержка", "Финансы"].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="field"><label htmlFor={`priority-${order.id}`}>Приоритет</label><select id={`priority-${order.id}`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{["Обычный", "Высокий", "Срочный"].map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          <button className="btn secondary" disabled={busy}>Сохранить назначение</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "parcel-set", id: order.id, carrier, trackingNumber: tracking, warehouseCode }, "Трек-номер сохранён"); }}>
          <h3>Посылка</h3>
          <div className="field"><label htmlFor={`carrier-${order.id}`}>Перевозчик</label><input id={`carrier-${order.id}`} required minLength={2} maxLength={80} value={carrier} onChange={(event) => setCarrier(event.target.value)} /></div>
          <div className="two-fields">
            <div className="field"><label htmlFor={`tracking-${order.id}`}>Трек-номер</label><input id={`tracking-${order.id}`} required minLength={3} maxLength={100} placeholder="ATLAS-TRK-001" value={tracking} onChange={(event) => setTracking(event.target.value)} /></div>
            <div className="field"><label htmlFor={`warehouse-${order.id}`}>Код склада</label><input id={`warehouse-${order.id}`} maxLength={80} value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)} /></div>
          </div>
          <button className="btn secondary" disabled={busy || order.status < 1}>Сохранить трекинг</button>
          {order.status < 1 && <p className="micro">Станет доступно после подтверждения выкупа.</p>}
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "warehouse-inspect", id: order.id, condition, quantityReceived: Number(received), notes: warehouseNotes, services, packageGroup }, "Приёмка на складе сохранена"); }}>
          <h3>Приёмка на складе</h3>
          <div className="two-fields"><div className="field"><label htmlFor={`condition-${order.id}`}>Состояние</label><select id={`condition-${order.id}`} value={condition} onChange={(event)=>setCondition(event.target.value as typeof condition)}><option value="ok">В порядке</option><option value="damaged">Повреждение</option><option value="mismatch">Не совпадает с заказом</option></select></div><div className="field"><label htmlFor={`received-${order.id}`}>Получено, шт.</label><input id={`received-${order.id}`} type="number" min="0" max="100" required value={received} onChange={(event)=>setReceived(event.target.value)}/></div></div>
          <div className="field"><label htmlFor={`group-${order.id}`}>Группа посылки</label><input id={`group-${order.id}`} maxLength={80} placeholder="Например, BOX-24" value={packageGroup} onChange={(event)=>setPackageGroup(event.target.value)}/></div>
          <fieldset className="service-options"><legend>{locale === "ru" ? "Отметки приёмки" : locale === "uz" ? "Qabul belgilari" : "Intake tags"}</legend><p className="micro">{locale === "ru" ? "Внутренняя фиксация при осмотре — это не выбранная клиентом услуга и не основание для оплаты." : locale === "uz" ? "Ko‘rik paytidagi ichki qayd — mijoz tanlagan xizmat ham, to‘lov uchun asos ham emas." : "Internal inspection notes only — not a customer-requested service or a charge."}</p>{[["photo","Фото"],["repack","Переупаковка"],["consolidate","Объединение"],["split","Разделение"],["fragile","Хрупкий груз"]].map(([value,label])=><label key={value}><input type="checkbox" checked={services.includes(value as typeof services[number])} onChange={(event)=>setServices(event.target.checked?[...new Set([...services,value as typeof services[number]])]:services.filter(item=>item!==value))}/>{label}</label>)}</fieldset>
          <div className="field"><label htmlFor={`warehouse-note-${order.id}`}>Комментарий приёмки</label><textarea id={`warehouse-note-${order.id}`} rows={3} maxLength={500} value={warehouseNotes} onChange={(event)=>setWarehouseNotes(event.target.value)}/></div>
          <button className="btn secondary" disabled={busy || order.status !== 2}>Сохранить приёмку</button>
          {order.status !== 2 && <p className="micro">Доступно, когда заказ прибыл на зарубежный склад.</p>}
        </form>
        <form onSubmit={(event) => { event.preventDefault(); void save({ type: "change-request-create", id: order.id, kind: changeKind, title: changeTitle, reason: changeReason, previousValue: previousValue || undefined, proposedValue: proposedValue || undefined, resolvesWarehouseIssue: resolvesWarehouseIssue || undefined, amountDelta: Math.round(Number(amountDelta)) }, "Запрос отправлен покупателю").then((ok)=>{if(ok){setChangeTitle("");setChangeReason("");setPreviousValue("");setProposedValue("");setAmountDelta("0");setResolvesWarehouseIssue(false)}}); }}>
          <h3>Согласовать изменение</h3>
          <div className="field"><label htmlFor={`change-kind-${order.id}`}>Тип</label><select id={`change-kind-${order.id}`} value={changeKind} onChange={(event)=>{setChangeKind(event.target.value as typeof changeKind);if(event.target.value!=="substitution")setResolvesWarehouseIssue(false)}}><option value="price">Цена</option><option value="variant">Вариант</option><option value="substitution">Замена товара</option><option value="source-shipping">Доставка магазина</option><option value="warehouse-service">Услуга склада</option><option value="customs">Таможенные данные</option></select></div>
          <div className="field"><label htmlFor={`change-title-${order.id}`}>Что изменилось</label><input id={`change-title-${order.id}`} required minLength={2} maxLength={120} value={changeTitle} onChange={(event)=>setChangeTitle(event.target.value)}/></div>
          <div className="two-fields"><div className="field"><label htmlFor={`previous-${order.id}`}>Было</label><input id={`previous-${order.id}`} maxLength={240} value={previousValue} onChange={(event)=>setPreviousValue(event.target.value)}/></div><div className="field"><label htmlFor={`proposed-${order.id}`}>Стало</label><input id={`proposed-${order.id}`} maxLength={240} value={proposedValue} onChange={(event)=>setProposedValue(event.target.value)}/></div></div>
          {order.warehouseInspection && order.warehouseInspection.condition !== "ok" && <label className="warehouse-issue-resolution"><input type="checkbox" checked={resolvesWarehouseIssue} disabled={changeKind !== "substitution"} onChange={(event)=>setResolvesWarehouseIssue(event.target.checked)}/><span>{locale === "ru" ? "Это замена решает проблему, зафиксированную складом" : locale === "uz" ? "Bu almashtirish ombor qayd etgan muammoni hal qiladi" : "This substitution resolves the issue flagged by the warehouse"}<small>{locale === "ru" ? "Взвешивание разблокируется только после явного согласия покупателя и заполнения поля «Стало»." : locale === "uz" ? "Tortish faqat xaridor aniq rozilik bildirgach va «Yangi qiymat» maydoni to‘ldirilgach ochiladi." : "Weighing unlocks only after the customer explicitly approves and a replacement is specified."}</small></span></label>}
          <div className="field"><label htmlFor={`change-amount-${order.id}`}>Изменение суммы, сум</label><input id={`change-amount-${order.id}`} type="number" min="-100000000" max="100000000" step="1" value={amountDelta} onChange={(event)=>setAmountDelta(event.target.value)}/></div>
          <div className="field"><label htmlFor={`change-reason-${order.id}`}>Причина</label><textarea id={`change-reason-${order.id}`} required minLength={2} maxLength={500} rows={3} value={changeReason} onChange={(event)=>setChangeReason(event.target.value)}/></div>
          <button className="btn secondary" disabled={busy || !changeTitle.trim() || !changeReason.trim() || pendingChange(order)}>Отправить на согласование</button>
          {pendingChange(order) && <p className="micro">Покупатель ещё не ответил на предыдущий запрос.</p>}
        </form>
      </div>
    </details>
  );
}

function OperatorOrderCommunication({
  order,
  customerName,
  customerEmail,
  recipientAvailable,
  run,
  locale,
}: {
  order: Order;
  customerName: string;
  customerEmail: string;
  recipientAvailable: boolean;
  run: (action: Action) => Promise<boolean>;
  locale: Locale;
}) {
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const words = {
    ru: {
      panel: "Заметки и сообщение покупателю",
      internalTitle: "Внутренняя заметка",
      internalHint: "Видна только оператору Atlas",
      addNote: "Добавить заметку",
      notes: "Последние заметки",
      customerTitle: "Уведомление покупателю",
      recipient: "Получатель по этому заказу",
      titleLabel: "Заголовок уведомления",
      messageLabel: "Текст уведомления",
      send: "Отправить уведомление в Atlas",
      channelHint: "Сообщение появится в уведомлениях выбранного аккаунта Atlas. Email и SMS не отправляются.",
      noRecipient: "Не удалось определить аккаунт этого заказа. Обновите очередь перед отправкой.",
      noteSaved: "Внутренняя заметка сохранена",
      notificationSaved: "Уведомление сохранено в Atlas",
      saving: "Сохраняем…",
      titlePlaceholder: "Например, Нужны реквизиты для возврата",
      messagePlaceholder: "Напишите, что нужно сообщить покупателю",
    },
    uz: {
      panel: "Izohlar va xaridorga xabar",
      internalTitle: "Ichki izoh",
      internalHint: "Faqat Atlas operatoriga ko‘rinadi",
      addNote: "Izoh qo‘shish",
      notes: "So‘nggi izohlar",
      customerTitle: "Xaridorga bildirishnoma",
      recipient: "Ushbu buyurtma bo‘yicha oluvchi",
      titleLabel: "Bildirishnoma sarlavhasi",
      messageLabel: "Bildirishnoma matni",
      send: "Atlasda bildirishnoma yuborish",
      channelHint: "Xabar tanlangan Atlas akkauntining bildirishnomalarida ko‘rinadi. Email va SMS yuborilmaydi.",
      noRecipient: "Bu buyurtma akkauntini aniqlab bo‘lmadi. Yuborishdan oldin navbatni yangilang.",
      noteSaved: "Ichki izoh saqlandi",
      notificationSaved: "Bildirishnoma Atlasda saqlandi",
      saving: "Saqlanmoqda…",
      titlePlaceholder: "Masalan, Qaytarish uchun ma’lumot kerak",
      messagePlaceholder: "Xaridorga aytilishi kerak bo‘lgan ma’lumotni yozing",
    },
    en: {
      panel: "Notes and customer message",
      internalTitle: "Internal note",
      internalHint: "Visible to Atlas operators only",
      addNote: "Add note",
      notes: "Recent notes",
      customerTitle: "Customer notification",
      recipient: "Recipient for this order",
      titleLabel: "Notification title",
      messageLabel: "Notification message",
      send: "Save in-app notification",
      channelHint: "The message appears in this Atlas account’s notifications. No email or SMS is sent.",
      noRecipient: "Could not identify this order’s account. Refresh the queue before sending.",
      noteSaved: "Internal note saved",
      notificationSaved: "Notification saved in Atlas",
      saving: "Saving…",
      titlePlaceholder: "For example, Details needed for your refund",
      messagePlaceholder: "Write what the customer needs to know",
    },
  }[locale];
  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !note.trim()) return;
    setBusy(true);
    try {
      if (await run({ type: "staff-note", id: order.id, text: note.trim() })) {
        setNote("");
        toast.success(words.noteSaved);
      }
    } finally {
      setBusy(false);
    }
  };
  const sendNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !recipientAvailable || !title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      // Account selection is intentionally absent: runOrderAction resolves the
      // owner from this order ID before posting the action to the operator API.
      const action: Action = {
        type: "customer-notification",
        id: order.id,
        title: title.trim(),
        message: message.trim(),
      };
      if (await run(action)) {
        setTitle("");
        setMessage("");
        toast.success(words.notificationSaved);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="ops-tools operator-order-communication">
      <summary><MessageSquareText size={17} /> {words.panel}</summary>
      <div className="ops-tools-grid">
        <form onSubmit={(event) => void saveNote(event)}>
          <h3>{words.internalTitle}</h3>
          <div className="field">
            <label htmlFor={`internal-note-${order.id}`}>{words.internalHint}</label>
            <textarea id={`internal-note-${order.id}`} required minLength={1} maxLength={500} rows={3} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
          </div>
          <button className="btn secondary" disabled={busy || !recipientAvailable || !note.trim()}>{busy ? words.saving : words.addNote}</button>
          {!!order.staffNotes?.length && <section className="staff-notes">
            <h3>{words.notes}</h3>
            {[...order.staffNotes].reverse().slice(0, 3).map((item) => (
              <p key={item.id}><time>{new Date(item.at).toLocaleString(localeTag(locale))}</time>{item.text}</p>
            ))}
          </section>}
        </form>
        <form onSubmit={(event) => void sendNotification(event)}>
          <h3>{words.customerTitle}</h3>
          <p className="micro"><b>{words.recipient}:</b> {recipientAvailable ? customerName : words.noRecipient}{recipientAvailable && customerEmail ? <small> · {customerEmail}</small> : null}</p>
          <div className="field">
            <label htmlFor={`notification-title-${order.id}`}>{words.titleLabel}</label>
            <input id={`notification-title-${order.id}`} required minLength={2} maxLength={120} value={title} disabled={busy || !recipientAvailable} placeholder={words.titlePlaceholder} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`notification-message-${order.id}`}>{words.messageLabel}</label>
            <textarea id={`notification-message-${order.id}`} required minLength={1} maxLength={300} rows={3} value={message} disabled={busy || !recipientAvailable} placeholder={words.messagePlaceholder} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <p className="micro">{words.channelHint}</p>
          <button className="btn secondary" disabled={busy || !recipientAvailable || !title.trim() || !message.trim()}>{busy ? words.saving : words.send}</button>
        </form>
      </div>
    </details>
  );
}

function CustomerWarehouseServices({
  order,
  pricing,
  locale,
  busy,
  run,
}: {
  order: Order;
  pricing: Pricing;
  locale: Locale;
  busy: boolean;
  run: (action: Action) => Promise<boolean>;
}) {
  const [serviceId, setServiceId] = useState("");
  const [units, setUnits] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [sending, setSending] = useState(false);
  const words = {
    ru: { title: "Услуги склада", intro: "Выберите нужное после приёмки и до взвешивания. Тариф показан заранее, но сначала оператор подтвердит возможность, затем вы отдельно согласуете точную сумму. Без согласия услугу не выполнят.", empty: "Дополнительных услуг не запрошено", add: "Услуга", quote: "Цена будет предложена оператором", fixed: "Тариф по настройкам", package: "посылка", item: "шт.", day: "дней", photo: "фото", halfHour: "интервалов по 30 мин.", requested: "Проверяется складом", quoted: "Ожидает вашего решения", approved: "Вы одобрили · ожидает выполнения", declined: "Вы отклонили", completed: "Отмечено оператором", checkout: "Отмечено в корзине", amount: "Количество", request: "Отправить запрос", note: "Опишите, что нужно сделать", noteHint: "До 500 символов", fixedPending: "Тариф зафиксирован; сумма будет добавлена только после подтверждения услуги и вашего согласия.", send: "Запрос передан оператору" },
    uz: { title: "Ombor xizmatlari", intro: "Kerakli xizmatni qabuldan keyin va tortishdan oldin tanlang. Tarif oldindan ko‘rsatiladi, lekin avval operator imkoniyatni, so‘ng siz aniq summani tasdiqlaysiz. Roziligingizsiz xizmat bajarilmaydi.", empty: "Qo‘shimcha xizmat so‘ralmagan", add: "Xizmat", quote: "Narxni operator taklif qiladi", fixed: "Sozlamalardagi tarif", package: "posilka", item: "dona", day: "kun", photo: "foto", halfHour: "30 daqiqalik interval", requested: "Ombor tekshirmoqda", quoted: "Qaroringiz kutilmoqda", approved: "Tasdiqlandi · bajarilishi kutilmoqda", declined: "Rad etildi", completed: "Operator bajardi deb belgiladi", checkout: "Savatda belgilangan", amount: "Miqdor", request: "So‘rov yuborish", note: "Nima qilish kerakligini yozing", noteHint: "500 belgigacha", fixedPending: "Tarif qayd etilgan; xizmat imkoniyati tasdiqlanib, rozilik berganingizdan keyingina summa qo‘shiladi.", send: "So‘rov operatorga yuborildi" },
    en: { title: "Warehouse services", intro: "Choose a service after intake and before weighing. The rate is shown up front; the operator first checks feasibility, then you approve the exact amount. Nothing is done without approval.", empty: "No optional service requested", add: "Service", quote: "Operator will provide a quote", fixed: "Configured rate", package: "package", item: "items", day: "days", photo: "photos", halfHour: "30-minute units", requested: "Warehouse is checking", quoted: "Awaiting your decision", approved: "Approved by you · awaiting fulfilment", declined: "Declined by you", completed: "Marked by operator", checkout: "Selected in cart", amount: "Quantity", request: "Send request", note: "Describe what you need", noteHint: "Up to 500 characters", fixedPending: "The rate is set; the amount is added only after the service is confirmed and you approve it.", send: "Request sent to operator" },
  }[locale];
  const requests = order.warehouseServiceRequests ?? [];
  const activeIds = new Set(requests.filter((request) => ["requested", "quoted", "approved"].includes(request.status)).map((request) => request.serviceId));
  const available = order.status === 2 && order.warehouseInspection
    ? pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "warehouse" && !activeIds.has(service.id))
    : [];
  const selected = available.find((service) => service.id === serviceId) ?? available[0];
  if (!requests.length && !available.length) return null;
  const unitLabel = (unit: WarehouseServiceRequest["unit"]) => unit === "package" ? words.package : unit === "item" ? words.item : unit === "day" ? words.day : unit === "photo" ? words.photo : words.halfHour;
  const statusLabel = (status: WarehouseServiceRequest["status"]) => status === "requested" ? words.requested : status === "quoted" ? words.quoted : status === "approved" ? words.approved : status === "declined" ? words.declined : words.completed;
  const requestedUnits = selected?.unit === "package" ? 1 : selected?.unit === "item" ? order.quantity : Math.max(1, Math.min(100, Number(units) || 1));
  const configuredAmount = selected?.pricingMode === "fixed" ? serviceFeeForCountry(selected, order.product.country) * requestedUnits : undefined;
  return <details className="customer-warehouse-services">
    <summary>{words.title}<span>{requests.length || available.length}</span></summary>
    <div className="customer-warehouse-services-body">
      <p className="micro">{words.intro}</p>
      {requests.length > 0 && <div className="warehouse-service-request-list">{requests.map((request) => <article className={`warehouse-service-request ${request.status}`} key={request.id}>
        <div><strong>{serviceTitle(request, locale)}</strong><small>{request.origin === "checkout" ? words.checkout : `${request.units} × ${unitLabel(request.unit)}`}</small>{request.customerNote && <small>{request.customerNote}</small>}</div>
        <div><b>{statusLabel(request.status)}</b>{request.quotedAmount !== undefined && <small>{money(request.quotedAmount)}</small>}</div>
      </article>)}</div>}
      {available.length > 0 && selected && <div className="warehouse-service-request-form">
        <div className="field"><label htmlFor={`warehouse-service-select-${order.id}`}>{words.add}</label><select id={`warehouse-service-select-${order.id}`} value={selected.id} onChange={(event) => {setServiceId(event.target.value);setUnits("1");setCustomerNote("")}}>{available.map((service) => <option value={service.id} key={service.id}>{serviceTitle(service, locale)}</option>)}</select></div>
        <p className="micro">{serviceDescription(selected, locale)}</p>
        {!["package", "item"].includes(selected.unit) && <div className="field"><label htmlFor={`warehouse-service-units-${order.id}`}>{words.amount} · {unitLabel(selected.unit)}</label><input id={`warehouse-service-units-${order.id}`} type="number" min="1" max="100" step="1" value={units} onChange={(event) => setUnits(event.target.value)} /></div>}
        {selected.id === "special-request" && <div className="field"><label htmlFor={`warehouse-service-note-${order.id}`}>{words.note}</label><textarea id={`warehouse-service-note-${order.id}`} rows={3} maxLength={500} required value={customerNote} placeholder={words.noteHint} onChange={(event) => setCustomerNote(event.target.value)} /></div>}
        <p className="micro">{configuredAmount !== undefined ? `${words.fixed}: ${money(serviceFeeForCountry(selected, order.product.country))} × ${requestedUnits} = ${money(configuredAmount)}. ${words.fixedPending}` : words.quote}</p>
        <button className="btn secondary" disabled={busy || sending || (selected.id === "special-request" && !customerNote.trim())} onClick={async () => { setSending(true); try { const ok = await run({ type: "warehouse-service-request", id: order.id, serviceId: selected.id, units: requestedUnits, customerNote: customerNote.trim() || undefined }); if (ok) { setCustomerNote(""); setUnits("1"); toast.success(words.send); } } finally { setSending(false); } }} aria-busy={sending || undefined}>{sending ? <><Loader2 size={16} className="spin" aria-hidden="true" />{locale === "ru" ? "Отправляем запрос…" : locale === "uz" ? "So‘rov yuborilmoqda…" : "Sending the request…"}</> : words.request}</button>
        {sending && <p className="micro" role="status">{locale === "ru" ? "Это запрос: оператор сначала проверит возможность и цену, услуга не считается выполненной." : locale === "uz" ? "Bu so‘rov: operator avval imkoniyat va narxni tekshiradi, xizmat bajarilgan hisoblanmaydi." : "This is a request: an operator checks feasibility and price first; the service is not done yet."}</p>}
      </div>}
      {!requests.length && !available.length && <p className="micro">{words.empty}</p>}
    </div>
  </details>;
}

type OrderDocument={id:string;order_id:string;kind:string;filename:string;content_type:string;size:number;created_at:number};
function OrderDocuments({orderId,accountId,operatorMode,locale}:{orderId:string;accountId?:string;operatorMode:boolean;locale:"ru"|"uz"|"en"}){
 const [documents,setDocuments]=useState<OrderDocument[]>([]),[busy,setBusy]=useState(false);
 const words={ru:{title:'Документы заказа',empty:'Документов пока нет',invoice:'Счёт',proof:'Подтверждение покупки',photo:'Фото со склада',report:'Акт склада',upload:'Добавить документ',open:'Скачать'},uz:{title:'Buyurtma hujjatlari',empty:'Hujjatlar hali yo‘q',invoice:'Hisob',proof:'Xarid tasdig‘i',photo:'Ombor fotosi',report:'Ombor dalolatnomasi',upload:'Hujjat qo‘shish',open:'Yuklab olish'},en:{title:'Order documents',empty:'No documents yet',invoice:'Invoice',proof:'Purchase proof',photo:'Warehouse photo',report:'Warehouse report',upload:'Add document',open:'Download'}}[locale];
 const load=useCallback(async()=>{const response=await fetch(`/api/order-documents${operatorMode&&accountId?`?accountId=${encodeURIComponent(accountId)}`:''}`,{cache:'no-store'});const data=await response.json() as {documents?:OrderDocument[]};if(response.ok)setDocuments((data.documents??[]).filter(item=>item.order_id===orderId))},[accountId,operatorMode,orderId]);
 useEffect(()=>{queueMicrotask(()=>void load())},[load]);
 async function upload(form:HTMLFormElement){const body=new FormData(form);body.set('orderId',orderId);body.set('customerId',accountId??'');setBusy(true);try{const response=await fetch('/api/order-documents',{method:'POST',body});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error??'Upload failed');form.reset();await load();toast.success(words.upload)}catch(error){toast.error((error as Error).message)}finally{setBusy(false)}}
 const labels:Record<string,string>={invoice:words.invoice,'purchase-proof':words.proof,'warehouse-photo':words.photo,'warehouse-report':words.report};
 return <details className="order-documents"><summary>{words.title}<span>{documents.length}</span></summary><div className="document-list">{documents.length?documents.map(item=><a key={item.id} href={`/api/order-documents?id=${encodeURIComponent(item.id)}`}><span><b>{labels[item.kind]??item.kind}</b><small>{item.filename}</small></span><strong>{words.open}</strong></a>):<p className="micro">{words.empty}</p>}</div>{operatorMode&&accountId&&<form className="document-upload" onSubmit={event=>{event.preventDefault();void upload(event.currentTarget)}}><select name="kind" aria-label="Тип документа"><option value="invoice">{words.invoice}</option><option value="purchase-proof">{words.proof}</option><option value="warehouse-photo">{words.photo}</option><option value="warehouse-report">{words.report}</option></select><input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required/><button className="btn secondary" disabled={busy}>{busy?'…':words.upload}</button></form>}</details>
}
type OrderConfirmation = { id: string; cancel: boolean; amount: number; storeShipping?: boolean; payment?: boolean };
const refundMarkerCopy = { ru: "Отметка возврата в Atlas", uz: "Atlasdagi qaytarish belgisi", en: "Refund marker in Atlas" } as const;
const intakeTagCopy = {
  photo: { ru: "Фото", uz: "Foto", en: "Photo requested at intake" },
  repack: { ru: "Переупаковка", uz: "Qayta qadoqlash", en: "Repacking noted" },
  consolidate: { ru: "Объединение", uz: "Birlashtirish", en: "Consolidation noted" },
  split: { ru: "Разделение", uz: "Bo‘lish", en: "Split shipment noted" },
  fragile: { ru: "Хрупкий груз", uz: "Mo‘rt yuk", en: "Fragile handling noted" },
} as const;

/** Customer order, mobile-first: what needs you first, then progress, details, settlements and history. */
function CustomerOrderCard({ order: o, locale, pricing, busy, expanded, onToggle, run, confirm, loadPhoto, allowanceUsd }: {
  order: Order;
  allowanceUsd?: number;
  locale: Locale;
  pricing: Pricing;
  busy: boolean;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  run: (action: Action) => Promise<boolean>;
  confirm: (value: OrderConfirmation) => void;
  loadPhoto: (order: Order) => void;
}) {
  const ow = { ...customerOrderCopy[locale], ...customerOrderDisclosureCopy[locale] };
  const c = ordersCopy[locale];
  const statuses = localizedStatuses(locale);
  const payable = orderPayable(o);
  const extra = isExtra(o), changePending = pendingChange(o), paymentPending = !o.cancelled && o.payment?.status === "pending";
  const needsAction = !o.cancelled && (extra || changePending || paymentPending);
  const status = o.cancelled ? ow.cancelled : o.payment?.status === "refunded" ? refundMarkerCopy[locale] : extra || changePending ? ow.needDecision : paymentPending ? ow.awaitingPayment : statuses[o.status];
  const tone = needsAction ? "warn" : o.cancelled ? "muted" : o.status === 5 ? "ok" : "info";
  const pendingRequests = (o.changeRequests ?? []).filter(request => request.status === "pending");
  const resolvedRequests = (o.changeRequests ?? []).filter(request => request.status !== "pending").reverse();
  const kg = locale === "ru" ? "кг" : "kg";
  const country = countryLabel(o.product.country ?? "США", locale);
  const lastParcelEvent = o.parcel?.events.at(-1)?.status;
  return <details className="order-x" id={o.id} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary className="order-x-summary">
      <span className="order-x-photo"><ProductImage product={o.product} decorative locale={locale} /></span>
      <span className="order-x-main">
        <b className="order-x-name">{o.product.name}</b>
        <small>{o.id} · {c.placed(formatShortDate(o.createdAt, locale))}</small>
        <span className={"order-x-status " + tone}>{status}</span>
      </span>
      <strong className="order-x-total">{formatSum(payable, locale)}</strong>
      {!o.cancelled && <span className="order-x-bar" aria-hidden="true"><span style={{ width: `${(o.status + 1) / statuses.length * 100}%` }} /></span>}
      <ChevronDown className="order-x-chevron" size={20} aria-hidden="true" />
    </summary>
    {expanded && <div className="order-x-body">
      {needsAction && <section className="order-x-action" aria-label={c.actionNeeded}>
        <p className="order-x-eyebrow">{c.actionNeeded}</p>
        {paymentPending && <div className="order-x-action-item">
          <CreditCard size={20} aria-hidden="true" />
          <div><h3>{ow.paymentWaiting}</h3><p>{ow.paymentLine} {o.payment!.id} · {formatSum(o.payment!.amount, locale)}. {ow.noCharge}.</p></div>
          <button type="button" className="btn primary" onClick={() => confirm({ id: o.id, cancel: false, amount: o.payment!.amount, payment: true })}>{ow.recordPayment}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>}
        {pendingRequests.map(request => <div className="order-x-action-item" key={request.id}>
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h3>{request.title}</h3><p>{request.reason}</p>
            {request.warehouseServiceRequestId && <p className="micro">{locale === "ru" ? "Подтверждение относится только к этой услуге. Платёжный провайдер не подключён, а выполнение ещё не подтверждено." : locale === "uz" ? "Tasdiq faqat shu xizmatga tegishli. To‘lov provayderi ulanmagan, xizmat bajarilgani hali tasdiqlanmagan." : "Approval applies only to this service. No payment provider is connected, and fulfilment has not been confirmed."}</p>}
            {(request.previousValue || request.proposedValue) && <p className="change-values"><span>{request.previousValue || "—"}</span><ArrowRight size={15} aria-hidden="true" /><b>{request.proposedValue || "—"}</b></p>}
            {request.amountDelta !== 0 && <strong className="order-x-delta">{request.amountDelta > 0 ? "+" : "−"}{formatSum(Math.abs(request.amountDelta), locale)}</strong>}
          </div>
          <div className="order-x-buttons">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void run({ type: "change-request-respond", id: o.id, requestId: request.id, decision: "declined", expectedAmountDelta: request.amountDelta })}>{ow.reject}</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run({ type: "change-request-respond", id: o.id, requestId: request.id, decision: "approved", expectedAmountDelta: request.amountDelta })}>{ow.confirm}</button>
          </div>
        </div>)}
        {extra && !changePending && <div className="order-x-action-item">
          <Scale size={20} aria-hidden="true" />
          <div><h3>{storeShippingExtra(o) ? ow.shippingOver : ow.extra}</h3><p>{ow.needApprove} {formatSum(storeShippingExtra(o) || warehouseExtra(o), locale)}</p></div>
          <button type="button" className="btn primary" onClick={() => confirm({ id: o.id, cancel: false, amount: storeShippingExtra(o) || warehouseExtra(o), storeShipping: Boolean(storeShippingExtra(o)) })}>{ow.checkExtra}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>}
      </section>}

      {o.cancelled ? <p className="order-x-note muted">{ow.cancelled}</p> : <section aria-label={c.progress}>
        <p className="order-x-eyebrow">{c.progress} · {c.stage(o.status + 1, statuses.length)}</p>
        <ol className="order-x-steps">{statuses.map((name, index) => <li key={name} data-state={index < o.status ? "done" : index === o.status ? "current" : "next"} aria-current={index === o.status ? "step" : undefined}><span aria-hidden="true">{index < o.status ? <Check size={12} /> : index + 1}</span>{name}</li>)}</ol>
      </section>}

      {!o.cancelled && o.status === 0 && o.product.sourceShippingEstimated && !o.storeShippingSettlement && <div className="order-x-note info">
        <Clock3 size={18} aria-hidden="true" /><div><b>{ow.managerChecking}</b><p>{o.quote.storeShippingHold !== undefined
          // Since 4 October 2026 the hold is apart from the order sum; older orders included it.
          ? o.quote.storeShippingHold > 0 ? <>{calcCopy[locale].hold}: {formatSum(o.quote.storeShippingHold, locale)} — {calcCopy[locale].holdNote.toLocaleLowerCase(locale === "en" ? "en-US" : "ru-RU")}. {ow.beforeBuyout}</> : calcCopy[locale].lines.free
          : o.quote.sourceShipping ? <>{ow.reserveIncluded} {formatSum(o.quote.sourceShipping, locale)}. {ow.beforeBuyout}</> : ow.reserveWaived}</p></div>
      </div>}
      {o.note && <div className="order-x-note muted"><MessageSquareText size={18} aria-hidden="true" /><div><b>{calcCopy[locale].blocks.comment}</b><p>{o.note}</p></div></div>}
      {o.customs && o.customs.dutiableUsd > 0 && <div className="order-x-note info"><Scale size={18} aria-hidden="true" /><div><b>{calcCopy[locale].customs.title}</b><p>{calcCopy[locale].customs.dutiable}: ${o.customs.dutiableUsd} · {calcCopy[locale].customs.estimate} ≈ ${o.customs.estimateUsd}{o.customs.helpRequested ? ` · ${calcCopy[locale].customs.help}` : ""}. {calcCopy[locale].customs.separate}</p></div></div>}

      <dl className="order-x-details">
        <div><dt>{c.orderNumber}</dt><dd><span className="order-x-id">{o.id}</span><CopyText text={o.id} locale={locale} /></dd></div>
        <div><dt>{c.total}</dt><dd><b>{formatSum(payable, locale)}</b>{payable !== o.quote.total && <small>{c.atCheckout(formatSum(o.quote.total, locale))}</small>}</dd></div>
        <div><dt>{c.item}</dt><dd>{[o.variant, c.quantity(o.quantity), country].filter(Boolean).join(" · ")}
          {o.product.sourceUrl && <a className="order-x-link" href={o.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.openStore}<ArrowUpRight size={14} aria-hidden="true" /></a>}
          {o.product.sourceUrl && !o.product.image && <button type="button" className="text-button" disabled={busy} onClick={() => loadPhoto(o)}>{busy ? ow.loadingPhoto : ow.loadPhoto}</button>}
        </dd></div>
        {o.payment && <div><dt>{c.payment}</dt><dd>{o.payment.status === "pending" ? ow.paymentWaiting : o.payment.status === "paid" ? ow.paymentPaid : ow.paymentRefunded}<small>{o.payment.id} · {ow.providerPassed}</small></dd></div>}
        {o.delivery && <div><dt>{c.delivery}</dt><dd>{o.delivery.recipient}<small>{o.delivery.region}, {o.delivery.city}, {o.delivery.address}</small><a className="order-x-link" href={`tel:${o.delivery.phone.replace(/[^\d+]/g, "")}`}>{o.delivery.phone}</a></dd></div>}
        {allowanceUsd !== undefined && <div><dt>{c.allowance}</dt><dd className={allowanceUsd > courierAllowanceUsd ? "order-x-over" : undefined}>{c.allowanceValue(allowanceUsd, courierAllowanceUsd)}</dd></div>}
        {o.parcel && <div><dt>{c.tracking}</dt><dd>{o.parcel.carrier}<span className="order-x-track"><span className="order-x-id">{o.parcel.trackingNumber}</span><CopyText text={o.parcel.trackingNumber} locale={locale} /></span><small>{lastParcelEvent ?? ow.parcelRegistered}{o.parcel.warehouseCode ? ` · ${locale === "ru" ? "склад" : locale === "uz" ? "ombor" : "warehouse"} ${o.parcel.warehouseCode}` : ""}</small></dd></div>}
      </dl>

      {o.warehouseInspection && <div className={"order-x-note " + (o.warehouseInspection.condition === "ok" ? "ok" : "warn")}>
        <Package size={18} aria-hidden="true" />
        <div>
          <b>{o.warehouseInspection.condition === "ok" ? ow.warehouseDone : ow.warehouseProblem}</b>
          <p>{ow.received}: {o.warehouseInspection.quantityReceived} {locale === "ru" ? "шт." : locale === "uz" ? "dona" : "pcs"}{o.warehouseInspection.packageGroup ? ` · ${locale === "ru" ? "группа" : locale === "uz" ? "guruh" : "group"} ${o.warehouseInspection.packageGroup}` : ""}</p>
          {o.warehouseInspection.services.length > 0 && <p>{locale === "ru" ? "Отметки приёмки" : locale === "uz" ? "Qabul belgilari" : "Intake tags"}: {o.warehouseInspection.services.map(tag => intakeTagCopy[tag][locale]).join(", ")}. <small>{locale === "ru" ? "Это отметки осмотра, не подтверждение выполненной или платной услуги." : locale === "uz" ? "Bu ko‘rik belgilari, bajarilgan yoki pullik xizmat tasdig‘i emas." : "These are inspection notes, not proof of a completed or paid service."}</small></p>}
          {o.warehouseInspection.notes && <p>{o.warehouseInspection.notes}</p>}
        </div>
      </div>}

      {o.storeShippingSettlement && <div className={"order-x-note " + (storeShippingExtra(o) ? "warn" : "info")}>
        <Package size={18} aria-hidden="true" />
        <div>
          <b>{ow.managerConfirmed}</b>
          <p>{ow.actual}: {usd(o.storeShippingSettlement.actualUsd)} · {formatSum(o.storeShippingSettlement.actual, locale)}. {ow.reservedAtCheckout}: {formatSum(o.storeShippingSettlement.estimated, locale)}.</p>
          <p><strong>{o.storeShippingSettlement.refund ? `${ow.refundToBalance} ${formatSum(o.storeShippingSettlement.refund, locale)}` : o.storeShippingExtraApproved ? `${ow.extraApproved}: ${formatSum(o.storeShippingSettlement.extra, locale)}` : o.storeShippingSettlement.extra ? `${ow.needApprove} ${formatSum(o.storeShippingSettlement.extra, locale)}` : o.storeShippingSettlement.held && o.storeShippingSettlement.released ? `${locale === "ru" ? "В пределах резерва. Освобождается" : locale === "uz" ? "Zaxira doirasida. Bo‘shatiladi" : "Within the reserve. Released"}: ${formatSum(o.storeShippingSettlement.released, locale)}` : ow.reserveMatch}</strong></p>
          {o.storeShippingSettlement.refund > 0 && <Link className="order-x-link" href="/balance">{ow.balance}<ArrowRight size={14} aria-hidden="true" /></Link>}
        </div>
      </div>}

      {o.settlement && <div className={"order-x-note " + (extra ? "warn" : "info")}>
        <Scale size={18} aria-hidden="true" />
        <div>
          <b>{extra ? ow.shippingOver : o.settlement.refund ? ow.shippingCheaper : ow.shippingRecalculated}</b>
          <p>{ow.payableWeight}: {o.settlement.chargeableWeight.toFixed(2)} {kg}. {ow.cost}: {formatSum(o.settlement.shipping, locale)}.</p>
          <p><strong>{o.settlement.refund ? `${ow.refundToBalance} ${formatSum(o.settlement.refund, locale)}` : o.extraApproved ? `${ow.extraApproved}: ${formatSum(o.settlement.extra, locale)}` : o.settlement.extra ? `${ow.needApprove} ${formatSum(o.settlement.extra, locale)}` : ow.noExtra}</strong></p>
          {o.settlement.refund > 0 && <Link className="order-x-link" href="/balance">{ow.balance}<ArrowRight size={14} aria-hidden="true" /></Link>}
        </div>
      </div>}

      {resolvedRequests.length > 0 && <section className="order-x-agreements" aria-label={ow.agreements}>
        <p className="order-x-eyebrow">{ow.agreements}</p>
        <ul>{resolvedRequests.map(request => <li key={request.id}><span className={"order-x-status " + (request.status === "approved" ? "ok" : "muted")}>{request.status === "approved" ? ow.approved : ow.declined}</span><b>{request.title}</b>{request.amountDelta !== 0 && <small>{request.amountDelta > 0 ? "+" : "−"}{formatSum(Math.abs(request.amountDelta), locale)}</small>}</li>)}</ul>
      </section>}

      <CustomerWarehouseServices order={o} pricing={pricing} locale={locale} busy={busy} run={run} />
      <OrderDocuments orderId={o.id} operatorMode={false} locale={locale} />

      <details className="order-x-more">
        <summary>{ow.calculationHistory}</summary>
        <div className="order-x-more-body">
          <CostLines q={o.quote} storeReserveWaived={o.product.sourceShippingEstimated === true} locale={locale} />
          {o.customsConsent && <p className="micro">{ow.customsAccepted}: {formatDateTime(o.customsConsent.acceptedAt, locale)}.</p>}
          {o.balanceUsed > 0 && <p className="micro">{ow.balanceUsed}: {formatSum(o.balanceUsed, locale)}</p>}
          {o.settlement && <p className="micro">{ow.actualWeight}: {o.settlement.actualWeight.toFixed(2)} {kg} · {ow.dimensional}: {o.settlement.dimensionalWeight.toFixed(2)} {kg}</p>}
          <ol className="order-x-history">{[...o.history].reverse().map((entry, index) => <li key={index}><time>{formatDateTime(entry.at, locale)}</time><p>{localizeLegacyStoredCopy(entry.text, locale)}</p></li>)}</ol>
        </div>
      </details>

      <div className="order-x-actions">
        {o.product.sourceUrl && <Link className="cabinet-text-btn" href={`/order-by-link?url=${encodeURIComponent(o.product.sourceUrl)}`}><RotateCcw size={15} aria-hidden="true" />{c.repeat}</Link>}
        <Link className="cabinet-text-btn" href={`/account?order=${encodeURIComponent(o.id)}#support`}><MessageCircle size={15} aria-hidden="true" />{c.ask}</Link>
        {o.status === 0 && !o.cancelled && <button type="button" className="order-x-cancel" onClick={() => confirm({ id: o.id, cancel: true, amount: o.quote.total })}>{ow.cancelOrder}</button>}
      </div>
    </div>}
  </details>;
}

export function OrdersView({ operations }: { operations: boolean }) {
  const { state, pricing, ready, error, act, user } = useMarket();
  const [expanded,setExpanded]=useState<string[]>([]);
  const [recipientFilter,setRecipientFilter]=useState("all");
  const [tab, setTab] = useState("active"),
    [query, setQuery] = useState(""),
    [warehouse, setWarehouse] = useState<string | null>(null),
    [storeShippingOrder, setStoreShippingOrder] = useState<string | null>(null),
    [actualStoreShipping, setActualStoreShipping] = useState("10"),
    [dims, setDims] = useState(["1.8", "30", "20", "15"]),
    [confirmation, setConfirmation] = useState<{
      id: string;
      cancel: boolean;
      amount: number;
      storeShipping?: boolean;
      payment?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [opsAccounts, setOpsAccounts] = useState<OperationsAccount[]>([]),
    [opsReady, setOpsReady] = useState(false),
    [opsRefreshing, setOpsRefreshing] = useState(false),
    [opsError, setOpsError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const reveal = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const row = document.getElementById(id);
      if (row instanceof HTMLDetailsElement) { row.open = true; row.scrollIntoView({block:'start'}); }
      else { const order=(operations?opsAccounts.flatMap(profile=>profile.state.orders):state.orders).find(item=>item.id===id);if(order)queueMicrotask(()=>{setQuery('');const hasCredit=operations&&opsAccounts.some(profile=>profile.state.entries.some(entry=>entry.orderId===order.id&&entry.credit==='customer-credit'&&entry.amount>0));setTab(operations&&(order.cancelled||order.payment?.status==='refunded'||hasCredit)?'refunds':order.cancelled||order.status===5?'done':'active')}); }
    };
    reveal(); window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [ready, tab, query, opsReady, state.orders, operations, opsAccounts]);
  const refreshOperations = useCallback(async () => {
    if (!operations || !user?.operator) return;
    setOpsRefreshing(true);
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const data = (await response.json()) as {
        accounts?: OperationsAccount[];
        error?: string;
      };
      if (!response.ok || !data.accounts)
        throw Error(data.error ?? "Не удалось загрузить очередь.");
      setOpsAccounts(data.accounts);
      setOpsError(null);
      setOpsReady(true);
    } catch (nextError) {
      setOpsError((nextError as Error).message);
      setOpsReady(false);
    } finally {
      setOpsRefreshing(false);
    }
  }, [operations, user?.operator]);
  useEffect(() => {
    queueMicrotask(() => void refreshOperations());
  }, [refreshOperations]);
  const orders = operations
    ? opsAccounts.flatMap((profile) => profile.state.orders)
    : state.orders;
  const orderAccount = new Map(
    opsAccounts.flatMap((profile) =>
      profile.state.orders.map((order) => [order.id, profile] as const),
    ),
  );
  const viewReady = operations ? opsReady : ready;
  const viewError = operations ? opsError : error;
  const locale = state.communication.language as Locale;
  const ow = {...customerOrderCopy[locale],...customerOrderDisclosureCopy[locale],emptyDescription:customerOrderEmptyCopy[locale]};
  const displayStatuses = localizedStatuses(locale);
  const wc={ru:{customerOver:"ВАШИ ПОКУПКИ В ПУТИ",customerTitle:"От магазина до вашей двери.",customerIntro:"Статусы, расчёты и история каждого заказа.",operatorOver:"РАБОЧЕЕ МЕСТО ОПЕРАТОРА",operatorTitle:"Всё готово к следующему шагу.",operatorIntro:"Выкупайте, принимайте на склад и согласовывайте исключения.",customerView:"Вид покупателя",operatorView:"Открыть обработку",active:"В работе",attention:"Нужно решение",done:"Завершённые",searchCustomer:"Номер или товар",searchOperator:"Номер, товар или покупатель"},uz:{customerOver:"BUYURTMALARINGIZ YO‘LDA",customerTitle:"Do‘kondan eshigingizgacha.",customerIntro:"Har bir buyurtmaning holati, hisobi va tarixi.",operatorOver:"OPERATOR ISH JOYI",operatorTitle:"Keyingi qadam uchun hammasi tayyor.",operatorIntro:"Xaridni, ombor qabulini va istisnolarni boshqaring.",customerView:"Mijoz ko‘rinishi",operatorView:"Qayta ishlashni ochish",active:"Jarayonda",attention:"Qaror kerak",done:"Yakunlangan",searchCustomer:"Raqam yoki tovar",searchOperator:"Raqam, tovar yoki mijoz"},en:{customerOver:"YOUR PURCHASES IN TRANSIT",customerTitle:"From the store to your door.",customerIntro:"Status, calculation and history for every order.",operatorOver:"OPERATOR WORKSPACE",operatorTitle:"Everything is ready for the next step.",operatorIntro:"Manage purchase, warehouse intake and exceptions.",customerView:"Customer view",operatorView:"Open processing",active:"In progress",attention:"Decision needed",done:"Completed",searchCustomer:"Order number or item",searchOperator:"Order number, item or customer"}}[state.communication.language];
  const refundTabLabel={ru:"Возвраты и отмены",uz:"Qaytarishlar va bekor qilinganlar",en:"Refunds and cancellations"}[locale];
  const refundStatusLabel={ru:"Отметка возврата в Atlas",uz:"Atlasdagi qaytarish belgisi",en:"Refund marker in Atlas"}[locale];
  const refundQueueCopy={ru:"Здесь отменённые заказы и заказы с отметкой о возврате. Сумма ниже — проводки Atlas, зачисленные во внутренний баланс покупателя по этому заказу; перевод на карту, в банк или кошелёк не выполняется.",uz:"Bu yerda bekor qilingan buyurtmalar va qaytarish belgisi bor buyurtmalar ko‘rsatiladi. Quyidagi summa — shu buyurtma bo‘yicha xaridorning Atlas ichki balansiga yozilgan hisob; karta, bank yoki hamyonga pul o‘tkazilmaydi.",en:"This queue includes cancelled orders and orders marked refunded. The amount shown is Atlas ledger entries credited to the customer’s internal balance for this order; no card, bank, or wallet transfer is made."}[locale];
  const receiving = orders.find((o) => o.id === warehouse);
  const confirmingStoreShipping = orders.find(
    (o) => o.id === storeShippingOrder,
  );
  const active = orders.filter((o) => !o.cancelled && o.status < 5),
    need = orders.filter((order) => orderNeedsOperatorAttention(order) || (!operations && !order.cancelled && order.payment?.status === "pending")),
    done = orders.filter((o) => (o.cancelled || o.status === 5) && (!o.issueCase || o.issueCase.status === "resolved")),
    refunds = operations ? orders.filter((o) => o.cancelled || o.payment?.status === "refunded" || atlasCreditForOrder(orderAccount.get(o.id), o.id) > 0) : [];
  // Customers who order for several people can narrow the list to one recipient.
  const recipientOf = (order: Order) => recipientKey(orderRecipientName(state, order));
  const recipientOptions = operations ? [] : [...new Map(orders.map(order => [recipientOf(order), orderRecipientName(state, order).trim()] as const)).entries()].filter(([key]) => key !== "unknown");
  // The allowance an order counts against: bought, paid orders of that person in the month of import.
  const currentMonth = monthOf(new Date().getTime());
  const allowanceFor = (order: Order) => !order.cancelled && countsTowardAllowance(order) && allowanceMonth(order) === currentMonth ? monthlyUsedFor(state, orderPerson(state, order), pricing.fx) : undefined;
  // Recipients of placed orders whose passport is not linked yet: the declaration needs it.
  const identityList = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const passportMissing = operations ? [] : [...new Map(orders
    .filter(order => !order.cancelled && order.status < 5 && !order.identity && order.deliveryProfileId && !identityList.some(profile => profile.recipientProfileId === order.deliveryProfileId))
    .map(order => [order.deliveryProfileId!, state.deliveryProfiles.find(profile => profile.id === order.deliveryProfileId)] as const)).entries()]
    .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => Boolean(entry[1]));
  const filtered = (
    tab === "active" ? active : tab === "attention" ? need : tab === "refunds" && operations ? refunds : done
  ).filter((o) => operations || recipientFilter === "all" || recipientOptions.length < 2 || recipientOf(o) === recipientFilter).filter((o) => {
    const profile=orderAccount.get(o.id);
    const profilePhone=profile?.state.communication.phone??"";
    const recipientPhone=o.delivery?.phone??"";
    const searchable=[o.id,o.product.name,o.product.brand,o.variant,profile?.name,profile?.id,profilePhone,o.delivery?.recipient,recipientPhone,o.delivery?.city];
    const needle=query.trim().toLocaleLowerCase();
    const normalizedPhoneNeedle=query.replace(/\D/g,"");
    const phoneNumbers=`${profilePhone} ${recipientPhone}`.replace(/\D/g,"");
    return searchable.filter(Boolean).join(" ").toLocaleLowerCase().includes(needle)
      || normalizedPhoneNeedle.length>=4&&phoneNumbers.includes(normalizedPhoneNeedle);
  });
  let calc: ReturnType<typeof settle> | null = null;
  try {
    if (receiving)
      calc = settle(
        receiving.quote,
        ...(dims.map(Number) as [number, number, number, number]),
      );
  } catch {}
  async function runOrderAction(action: Action) {
    if (!operations) return act(action);
    const orderId = "id" in action ? action.id ?? "" : "";
    const profile = orderAccount.get(orderId);
    if (!profile) {
      toast.error(locale === "ru" ? "Профиль покупателя не найден. Обновите очередь." : locale === "uz" ? "Mijoz profili topilmadi. Navbatni yangilang." : "Customer profile not found. Refresh the queue.");
      return false;
    }
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "action",
          accountId: profile.id,
          revision: profile.revision,
          action,
        }),
      });
      const data = (await response.json()) as {
        account?: OperationsAccount;
        error?: string;
      };
      if (data.account)
        setOpsAccounts((current) =>
          current.map((item) =>
            item.id === data.account!.id ? data.account! : item,
          ),
        );
      if (!response.ok) {
         toast.error(data.error ?? (locale === "ru" ? "Не удалось сохранить действие." : locale === "uz" ? "Amalni saqlab bo‘lmadi." : "Could not save the action."));
        if (!data.account) await refreshOperations();
        return false;
      }
      return true;
    } catch {
      toast.error(locale === "ru" ? "Нет связи с сервером. Обновите очередь перед повтором." : locale === "uz" ? "Server bilan aloqa yo‘q. Qayta urinishdan oldin navbatni yangilang." : "The server is unreachable. Refresh the queue before retrying.");
      await refreshOperations();
      return false;
    }
  }
  async function loadPhoto(o: Order) {
    if (!o.product.sourceUrl) return;
    setBusy(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: o.product.sourceUrl }),
      });
      const data = (await response.json()) as {
        image?: string;
        error?: string;
      };
      if (!response.ok || !data.image)
         throw Error(data.error ?? (locale === "ru" ? "На странице не найдено фото." : locale === "uz" ? "Sahifada rasm topilmadi." : "No photo found on the page."));
      if (
        await runOrderAction({ type: "order-image", id: o.id, image: data.image })
      )
         toast.success(ow.photoUpdated);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finishReceiving() {
    if (!receiving || busy) return;
    setBusy(true);
    const ok = await runOrderAction({
      type: "receive",
      id: receiving.id,
      dimensions: dims.map(Number) as [number, number, number, number],
    });
    setBusy(false);
    if (ok) {
      setWarehouse(null);
       toast.success(locale === "ru" ? "Взвешивание и перерасчёт сохранены" : locale === "uz" ? "Tortish va qayta hisoblash saqlandi" : "Weighing and recalculation saved");
    }
  }
  async function finishStoreShipping() {
    if (!confirmingStoreShipping || busy) return;
    setBusy(true);
    const ok = await runOrderAction({
      type: "confirm-store-shipping",
      id: confirmingStoreShipping.id,
      actualUsd: Number(actualStoreShipping),
    });
    setBusy(false);
    if (ok) {
      setStoreShippingOrder(null);
       toast.success(locale === "ru" ? "Доставка магазина подтверждена и пересчитана" : locale === "uz" ? "Do‘kon yetkazib berishi tasdiqlandi va qayta hisoblandi" : "Store shipping confirmed and recalculated");
    }
  }
  if (operations && ready && !user?.operator)
    return (
      <Empty
        title={locale === "ru" ? "Доступ только оператору" : locale === "uz" ? "Faqat operatorlar uchun" : "Operator access only"}
        description={locale === "ru" ? "В личном кабинете доступны ваши покупки и баланс." : locale === "uz" ? "Xaridlar va balansingiz shaxsiy kabinetda mavjud." : "Your purchases and balance are available in your account."}
        href="/orders"
        label={locale === "ru" ? "Мои заказы" : locale === "uz" ? "Buyurtmalarim" : "My orders"}
      />
    );
  const oc = ordersCopy[locale];
  return (
    <>
      {!operations ? <header className="orders-head">
        <div><h1>{oc.title}</h1>{orders.length > 0 && <p>{orderCount(orders.length, locale)}{active.length ? ` · ${oc.active(active.length)}` : ""}</p>}</div>
        {user?.operator && <Link className="btn secondary" href="/operations">{wc.operatorView}<ArrowUpRight size={16} aria-hidden="true" /></Link>}
      </header> : <PageHeading
        overline={
          operations ? wc.operatorOver : wc.customerOver
        }
        title={
          operations
            ? wc.operatorTitle
            : wc.customerTitle
        }
        description={
          operations
            ? wc.operatorIntro
            : wc.customerIntro
        }
      >
        {(operations || user?.operator) && (
          <Link
            className="btn secondary"
            href={operations ? "/orders" : "/operations"}
          >
            {operations ? wc.customerView : wc.operatorView}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </PageHeading>}
      {!operations && viewReady && passportMissing.map(([profileId, profile]) => <div className="orders-passport" key={profileId} role="note">
        <IdCard size={20} aria-hidden="true" />
        <div><b>{passportCopy[locale].title(profile.recipient)}</b><small>{passportCopy[locale].text}</small></div>
        <Link className="btn secondary" href={`/identity?recipient=${encodeURIComponent(profileId)}`}>{passportCopy[locale].action}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>)}
      {!operations && viewReady && need.length > 0 && tab !== "attention" && <button type="button" className="orders-attention" onClick={() => setTab("attention")}>
        <AlertCircle size={20} aria-hidden="true" /><span>{oc.attention(need.length)}</span><span className="orders-attention-go">{oc.showAttention}<ArrowRight size={16} aria-hidden="true" /></span>
      </button>}
      {operations && (
        <div className="ops-stats">
          <div>
              <span>{wc.active}</span>
            <strong>{active.length}</strong>
            <Package />
          </div>
          <div>
              <span>{wc.attention}</span>
            <strong>{need.length}</strong>
            <Clock3 />
          </div>
          <div>
              <span>{locale === "ru" ? "Ожидают взвешивания" : locale === "uz" ? "Tortish kutilmoqda" : "Awaiting weighing"}</span>
            <strong>{active.filter((o) => o.status === 2).length}</strong>
            <Scale />
          </div>
        </div>
      )}
      {orders.length > 0 && (
        <div className="order-controls">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className={`order-tabs${operations ? " has-refund-tab" : ""}`}>
              <TabsTrigger value="active">
                {wc.active} <b>{active.length}</b>
              </TabsTrigger>
              <TabsTrigger value="attention">
                {wc.attention} <b>{need.length}</b>
              </TabsTrigger>
              <TabsTrigger value="done">
                {wc.done} <b>{done.length}</b>
              </TabsTrigger>
              {operations && <TabsTrigger value="refunds">
                {refundTabLabel} <b>{refunds.length}</b>
              </TabsTrigger>}
            </TabsList>
              <TabsContent value={tab} className="sr-only">
               {locale === "ru" ? "Фильтр заказов: " : locale === "uz" ? "Buyurtma filtri: " : "Order filter: "}
               {tab === "active" ? wc.active : tab === "attention" ? wc.attention : tab === "refunds" && operations ? refundTabLabel : wc.done}
            </TabsContent>
          </Tabs>
          {/* Customers with a handful of orders scan the list; search appears once it gets long. */}
          {(operations || orders.length > 5 || query) && <label className="search-field">
            <Search size={18} />
            <input
              aria-label={ow.search}
              placeholder={operations ? (locale === "ru" ? "Номер, товар, имя, телефон или email" : locale === "uz" ? "Raqam, tovar, ism, telefon yoki email" : "Order, item, name, phone or email") : oc.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>}
          {operations&&<button type="button" className="btn secondary order-refresh" disabled={opsRefreshing} onClick={()=>void refreshOperations()}><RefreshCw size={16} className={opsRefreshing?"spin":""}/>{locale==='ru'?(opsRefreshing?'Обновляем…':'Обновить очередь'):locale==='uz'?(opsRefreshing?'Yangilanmoqda…':'Navbatni yangilash'):(opsRefreshing?'Refreshing…':'Refresh queue')}</button>}
        </div>
      )}
      {!operations && recipientOptions.length > 1 && <div className="notice-filters orders-recipients" role="group" aria-label={oc.recipients}>{[["all", oc.allRecipients] as const, ...recipientOptions].map(([key, name]) => <button type="button" key={key} aria-pressed={recipientFilter === key} className={recipientFilter === key ? "active" : ""} onClick={() => setRecipientFilter(key)}>{name}</button>)}</div>}
      {operations && tab === "refunds" && <p className="notice">{refundQueueCopy}</p>}
      {!viewReady ? (
        viewError ? (
          <Empty
            title={operations ? (locale === "ru" ? "Очередь пока недоступна" : locale === "uz" ? "Navbat hozircha mavjud emas" : "Queue is unavailable") : ow.loginTitle}
            description={operations ? viewError ?? (locale === "ru" ? "Повторите загрузку очереди." : locale === "uz" ? "Navbatni qayta yuklang." : "Reload the queue and try again.") : ow.loginDescription}
            href={operations ? "/operations" : "/account"}
            label={operations ? (locale === "ru" ? "Повторить" : locale === "uz" ? "Qayta urinish" : "Try again") : ow.loginLabel}
          />
        ) : (
          <div className="loading-state">{ow.loading}</div>
        )
      ) : !orders.length && !operations ? (
        <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><Package size={28} /></span><h2>{ow.emptyTitle}</h2><p>{ow.emptyDescription}</p>
          <div className="basket-empty-actions"><Link className="btn primary" href="/order-by-link">{ordersCopy[locale].newOrder}<ArrowRight size={18} aria-hidden="true" /></Link><Link className="btn secondary" href="/cart">{ordersCopy[locale].cart}</Link></div>
        </section>
      ) : !orders.length ? (
        <Empty
          title={operations ? (locale === "ru" ? "Очередь заказов пуста" : locale === "uz" ? "Buyurtmalar navbati bo‘sh" : "The order queue is empty") : ow.emptyTitle}
          description={operations ? (locale === "ru" ? "Новых клиентских заказов пока нет." : locale === "uz" ? "Yangi mijoz buyurtmalari yo‘q." : "There are no new customer orders yet.") : ow.emptyDescription}
          href="/"
          label={ow.choose}
        />
      ) : !filtered.length ? (
        <Empty
          title={ow.filteredTitle}
          description={ow.filteredDescription}
        />
      ) : (
        filtered.map((o) => !operations ? <CustomerOrderCard key={o.id} order={o} locale={locale} pricing={pricing} busy={busy} expanded={expanded.includes(o.id)} onToggle={open => setExpanded(ids => open ? [...new Set([...ids, o.id])] : ids.filter(id => id !== o.id))} run={runOrderAction} confirm={setConfirmation} loadPhoto={order => void loadPhoto(order)} allowanceUsd={allowanceFor(o)} /> : (
          <details className="surface order-card compact-order" key={o.id} id={o.id} onToggle={event=>{const open=event.currentTarget.open;setExpanded(ids=>open?[...new Set([...ids,o.id])]:ids.filter(id=>id!==o.id))}}>
            <summary className="compact-order-summary">
              <ProductImage product={o.product} decorative locale={state.communication.language} />
               <span className="compact-order-name"><small>{o.id}{operations ? ` · ${orderAccount.get(o.id)?.name ?? ''}` : ''}</small><b>{o.product.name}</b><span>{o.variant} · {o.quantity}</span>{operations && tab === "refunds" && <small>{atlasCreditForOrder(orderAccount.get(o.id), o.id) > 0 ? `${locale === "ru" ? "Зачислено во внутренний баланс Atlas" : locale === "uz" ? "Atlas ichki balansiga yozildi" : "Credited to Atlas internal balance"}: ${money(atlasCreditForOrder(orderAccount.get(o.id), o.id))}` : locale === "ru" ? "Зачислений во внутренний баланс Atlas по заказу нет" : locale === "uz" ? "Buyurtma bo‘yicha Atlas ichki balansiga yozuv yo‘q" : "No Atlas internal-balance credit recorded for this order"}</small>}</span>
               <span className={'status-badge '+(isExtra(o)||pendingChange(o)||(!operations&&o.payment?.status==='pending')?'needs-action':'')}>{o.cancelled ? ow.cancelled : o.payment?.status==='refunded' ? refundStatusLabel : isExtra(o)||pendingChange(o) ? ow.needDecision : o.payment?.status==='pending' ? ow.awaitingPayment : displayStatuses[o.status]}</span>
              <strong>{money(orderPayable(o))}</strong><ArrowRight size={18}/>
            </summary>
            {expanded.includes(o.id)&&<div className="compact-order-body">
            <div className="order-card-head">
              <div>
                <span className="order-id-copy"><b>{o.id}</b><CopyText text={o.id} locale={locale} /></span>
                 <span>{new Date(o.createdAt).toLocaleDateString(localeTag(locale))}</span>
                {operations && orderAccount.get(o.id) && (
                  <span className="customer-badge">
                     {ow.buyer}: {orderAccount.get(o.id)!.name}
                  </span>
                )}
              </div>
              <span
                className={
                  "status-badge " +
                  (isExtra(o) || pendingChange(o) ? "needs-action" : o.cancelled ? "cancelled" : "")
                }
              >
                {o.cancelled
                   ? ow.cancelled
                  : pendingChange(o)
                     ? ow.needDecision
                  : isExtra(o)
                     ? ow.extra
                    : displayStatuses[o.status]}
              </span>
            </div>
            {operations&&<OperatorOrderContacts order={o} account={orderAccount.get(o.id)} locale={locale}/>}
            <div className="order-product">
              <div className="order-photo">
              <ProductImage product={o.product} decorative locale={state.communication.language} />
              </div>
              <div>
                <h2>{o.product.name}</h2>
                <p>
                  {o.variant} · {o.quantity} {locale === "ru" ? "шт." : locale === "uz" ? "dona" : "pcs"} · {o.product.country ?? (locale === "ru" ? "США" : locale === "uz" ? "AQSh" : "USA")}
                </p>
                {o.product.sourceUrl && (
                  <a
                    className="text-link"
                    href={o.product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ow.source}
                    <ArrowUpRight size={14} />
                  </a>
                )}
                <span className="muted">{o.product.brand}</span>
                {o.product.sourceUrl && !o.product.image && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => loadPhoto(o)}
                  >
                     {busy ? ow.loadingPhoto : ow.loadPhoto}
                  </button>
                )}
              </div>
              <div className="order-amount">
                <strong>{money(orderPayable(o))}</strong>
                  <span>{orderPayable(o) === o.quote.total ? ow.checkoutTotal : `${ow.checkoutAt} ${money(o.quote.total)}`}</span>
              </div>
            </div>
            {!o.cancelled && (
              <ol className="order-timeline">
                {displayStatuses.map((name, i) => (
                  <li
                    key={name}
                    className={
                      i < o.status
                        ? "complete"
                        : i === o.status
                          ? "current"
                          : ""
                    }
                  >
                    <b>{i < o.status ? <Check size={14} /> : i + 1}</b>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>
            )}
            {o.payment && (
              <div className={"settlement-box payment-box " + (o.payment.status === "pending" ? "attention" : "")}>
                <CreditCard size={22} />
                <div>
                   <h3>{o.payment.status === "pending" ? ow.paymentWaiting : o.payment.status === "paid" ? ow.paymentPaid : ow.paymentRefunded}</h3>
                   <p>{ow.paymentLine} {o.payment.id} · {money(o.payment.amount)}.</p>
                   <strong>{o.payment.status === "pending" ? ow.noCharge : ow.providerPassed}</strong>
                   {!operations&&!o.cancelled&&o.status===0&&o.product.sourceShippingEstimated&&!o.storeShippingSettlement&&<div className="payment-reserve-hint"><Clock3 size={16}/><div><b>{ow.managerChecking}</b><p>{ow.reserveIncluded} {money(o.quote.sourceShipping??0)}. {ow.beforeBuyout}</p><small>{locale==='ru'?'Резерв — часть предварительного расчёта, это не отметка об оплате.':locale==='uz'?'Zaxira dastlabki hisobning bir qismi, bu to‘lov qaydi emas.':'This reserve is part of the preliminary total, not a payment status.'}</small></div></div>}
                </div>
                {!operations && o.payment.status === "pending" && (
                  <button className="btn primary" onClick={() => setConfirmation({ id: o.id, cancel: false, amount: o.payment!.amount, payment: true })}>
                     {ow.recordPayment} <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}
            {o.delivery && (
              <div className="settlement-box delivery-box">
                <Package size={22} />
                 <div><h3>{ow.recipient}: {o.delivery.recipient}</h3><p>{o.delivery.region}, {o.delivery.city}, {o.delivery.address}</p><p>{locale==='ru'?'Телефон получателя':locale==='uz'?'Qabul qiluvchi telefoni':'Recipient phone'}: <a href={`tel:${o.delivery.phone.replace(/[^\d+]/g,'')}`}>{o.delivery.phone}</a></p></div>
              </div>
            )}
            {/* The customer's comment and the customs estimate they saw: for Atlas only, never sent to the store. */}
            {o.note && <div className="settlement-box"><MessageSquareText size={22} /><div><h3>{calcCopy[locale].blocks.comment}</h3><p>{o.note}</p></div></div>}
            {o.customs && <div className="settlement-box"><Scale size={22} /><div><h3>{calcCopy[locale].customs.title} · {o.customs.month}</h3><p>{calcCopy[locale].customs.limitShort}: ${o.customs.allowanceUsd} · {calcCopy[locale].customs.atlasShort}: ${o.customs.atlasUsedUsd}{o.customs.outsideUnknown ? ` · ${calcCopy[locale].customs.outsideUnknown}` : o.customs.outsideUsedUsd !== undefined ? ` · ${calcCopy[locale].customs.outsideShort}: $${o.customs.outsideUsedUsd}` : ""}</p><p>{calcCopy[locale].customs.dutiable}: <b>${o.customs.dutiableUsd}</b> · {calcCopy[locale].customs.estimate} ≈ ${o.customs.estimateUsd}{o.customs.helpRequested ? ` · ${calcCopy[locale].customs.help}: $${o.customs.helpFeeUsd ?? 0}` : ""}</p></div></div>}
            {o.quote.storeShippingHold !== undefined && o.quote.storeShippingHold > 0 && !o.storeShippingSettlement && <div className="settlement-box"><Wallet size={22} /><div><h3>{calcCopy[locale].hold}</h3><p>{money(o.quote.storeShippingHold)} — {calcCopy[locale].holdNote}</p></div></div>}
            {o.parcel && (
              <div className="settlement-box parcel-box">
                <Truck size={22} />
                 <div><h3>{o.parcel.carrier}</h3><p>{ow.tracking}: {o.parcel.trackingNumber}{o.parcel.warehouseCode ? ` · ${locale === "ru" ? "склад" : locale === "uz" ? "ombor" : "warehouse"} ${o.parcel.warehouseCode}` : ""}</p><strong>{o.parcel.events.at(-1)?.status ?? ow.parcelRegistered}</strong></div>
              </div>
            )}
            {o.warehouseInspection && (
              <div className={"settlement-box warehouse-box " + (o.warehouseInspection.condition === "ok" ? "" : "attention")}>
                 <Package size={22}/><div><h3>{o.warehouseInspection.condition === "ok" ? ow.warehouseDone : ow.warehouseProblem}</h3><p>{ow.received}: {o.warehouseInspection.quantityReceived} {locale === "ru" ? "шт." : locale === "uz" ? "dona" : "pcs"}{o.warehouseInspection.packageGroup ? ` · ${locale === "ru" ? "группа" : locale === "uz" ? "guruh" : "group"} ${o.warehouseInspection.packageGroup}` : ""}</p><strong>{o.warehouseInspection.services.length ? `${locale === "ru" ? "Отметки приёмки" : locale === "uz" ? "Qabul belgilari" : "Intake tags"}: ${o.warehouseInspection.services.map((tag) => ({ photo: locale === "ru" ? "Фото" : locale === "uz" ? "Foto" : "Photo requested at intake", repack: locale === "ru" ? "Переупаковка" : locale === "uz" ? "Qayta qadoqlash" : "Repacking noted", consolidate: locale === "ru" ? "Объединение" : locale === "uz" ? "Birlashtirish" : "Consolidation noted", split: locale === "ru" ? "Разделение" : locale === "uz" ? "Bo‘lish" : "Split shipment noted", fragile: locale === "ru" ? "Хрупкий груз" : locale === "uz" ? "Mo‘rt yuk" : "Fragile handling noted" }[tag])).join(", ")}` : ow.noOperations}</strong>{o.warehouseInspection.services.length > 0 && <small className="micro">{locale === "ru" ? "Это отметки осмотра, не подтверждение выполненной или платной услуги." : locale === "uz" ? "Bu ko‘rik belgilari, bajarilgan yoki pullik xizmat tasdig‘i emas." : "These are inspection notes, not proof of a completed or paid service."}</small>}{o.warehouseInspection.notes && <p>{o.warehouseInspection.notes}</p>}</div>
              </div>
            )}
            {!operations && <CustomerWarehouseServices order={o} pricing={pricing} locale={locale} busy={busy} run={runOrderAction} />}
             {!!o.changeRequests?.length && <section className="change-request-list" aria-label={ow.agreements}>{[...o.changeRequests].reverse().map(request=><article className={`change-request ${request.status}`} key={request.id}><div><span className="eyebrow">{request.status === "pending" ? ow.pending : request.status === "approved" ? ow.approved : ow.declined}</span><h3>{request.title}</h3><p>{request.reason}</p>{request.warehouseServiceRequestId&&<p className="micro">{locale==='ru'?'Подтверждение относится только к этой услуге. Платёжный провайдер не подключён, а выполнение ещё не подтверждено.':locale==='uz'?'Tasdiq faqat shu xizmatga tegishli. To‘lov provayderi ulanmagan, xizmat bajarilgani hali tasdiqlanmagan.':'Approval applies only to this service. No payment provider is connected, and fulfilment has not been confirmed.'}</p>}{(request.previousValue||request.proposedValue)&&<p className="change-values"><span>{request.previousValue||"—"}</span><ArrowRight size={15}/><b>{request.proposedValue||"—"}</b></p>}</div><div className="change-amount">{request.amountDelta !== 0 && <strong>{request.amountDelta > 0 ? "+" : ""}{money(request.amountDelta)}</strong>}{!operations && request.status === "pending" && <div className="change-actions"><button className="btn secondary" disabled={busy} onClick={()=>void runOrderAction({type:"change-request-respond",id:o.id,requestId:request.id,decision:"declined",expectedAmountDelta:request.amountDelta})}>{ow.reject}</button><button className="btn primary" disabled={busy} onClick={()=>void runOrderAction({type:"change-request-respond",id:o.id,requestId:request.id,decision:"approved",expectedAmountDelta:request.amountDelta})}>{ow.confirm}</button></div>}</div></article>)}</section>}
            {o.storeShippingSettlement && (
              <div
                className={
                  "settlement-box " +
                  (storeShippingExtra(o) ? "attention" : "")
                }
              >
                <Package size={22} />
                <div>
                   <h3>{ow.managerConfirmed}</h3>
                  <p>
                     {ow.actual}:{" "}
                    {usd(o.storeShippingSettlement.actualUsd)} ·{" "}
                    {money(o.storeShippingSettlement.actual)}.
                  </p>
                  <p>
                     {ow.reservedAtCheckout}:{" "}
                    {money(o.storeShippingSettlement.estimated)}.
                  </p>
                  <strong>
                    {o.storeShippingSettlement.refund
                       ? ow.refundToBalance + " " +
                        money(o.storeShippingSettlement.refund) +
                         ""
                      : o.storeShippingExtraApproved
                         ? ow.extraApproved + ": " +
                          money(o.storeShippingSettlement.extra)
                        : o.storeShippingSettlement.extra
                           ? ow.needApprove + " " +
                            money(o.storeShippingSettlement.extra)
                           : ow.reserveMatch}
                  </strong>
                </div>
                {o.storeShippingSettlement.refund > 0 && (
                  <Link href="/balance" className="text-link">
                     {ow.balance}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            )}
            {o.settlement && (
              <div
                className={"settlement-box " + (isExtra(o) ? "attention" : "")}
              >
                <Scale size={22} />
                <div>
                  <h3>
                    {isExtra(o)
                       ? ow.shippingOver
                      : o.settlement.refund
                         ? ow.shippingCheaper
                         : ow.shippingRecalculated}
                  </h3>
                  <p>
                    {ow.payableWeight}: {o.settlement.chargeableWeight.toFixed(2)} {locale === "ru" ? "кг." : "kg."} {ow.cost}: {money(o.settlement.shipping)}.
                  </p>
                  <strong>
                    {o.settlement.refund
                       ? ow.refundToBalance + " " +
                        money(o.settlement.refund) +
                         ""
                      : o.extraApproved
                         ? ow.extraApproved + ": " + money(o.settlement.extra)
                        : o.settlement.extra
                           ? ow.needApprove + " " + money(o.settlement.extra)
                           : ow.noExtra}
                  </strong>
                </div>
                {o.settlement.refund > 0 && (
                  <Link href="/balance" className="text-link">
                     {ow.balance}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            )}
            {isExtra(o) && !operations && !pendingChange(o) && (
              <button
                className="btn primary"
                onClick={() =>
                  setConfirmation({
                    id: o.id,
                    cancel: false,
                    amount: storeShippingExtra(o) || warehouseExtra(o),
                    storeShipping: Boolean(storeShippingExtra(o)),
                  })
                }
              >
                {ow.checkExtra}
                <ArrowRight size={16} />
              </button>
            )}
            {operations &&
              !o.cancelled &&
              o.status === 0 &&
              o.product.sourceShippingEstimated &&
              !o.storeShippingSettlement && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setActualStoreShipping(
                      String(o.product.sourceShippingUsd ?? 10),
                    );
                    setStoreShippingOrder(o.id);
                  }}
                >
                  {ow.confirmStore}
                  <ArrowRight size={16} />
                </button>
              )}
            {operations &&
              !o.cancelled &&
              o.status < 5 &&
              !(
                o.status === 0 &&
                o.product.sourceShippingEstimated &&
                !o.storeShippingSettlement
              ) && (
              <button
                className="btn primary"
                disabled={isExtra(o) || pendingChange(o) || (o.status === 2 && !o.warehouseInspection) || (o.status === 0 && o.payment?.status === "pending") || (o.status === 3 && !o.parcel)}
                onClick={async () => {
                  if (o.status === 2) {
                    setWarehouse(o.id);
                    setDims([
                      String(
                        Math.max(
                          0.1,
                          Math.round(o.quote.weight * 0.85 * 100) / 100,
                        ),
                      ),
                      "30",
                      "20",
                      "15",
                    ]);
                    return;
                  }
                  if (
                    await runOrderAction({
                      type: "advance",
                      id: o.id,
                      expected: o.status,
                    })
                  )
                     toast.success(ow.statusUpdated);
                }}
              >
                {o.status === 0
                   ? ow.confirmBuyout
                  : o.status === 1
                     ? ow.receiveWarehouse
                    : o.status === 2
                       ? ow.weigh
                      : o.status === 3
                         ? ow.sendUzbekistan
                         : ow.confirmDelivery}
                <ArrowRight size={16} />
              </button>
            )}
            {operations && (isExtra(o) || pendingChange(o)) && (
              <p className="micro">
                 {ow.sendAfterApproval}
              </p>
            )}
            {operations && o.status === 2 && !o.warehouseInspection && <p className="micro">{ow.saveReceivingFirst}</p>}
            {operations && o.status === 0 && o.payment?.status === "pending" && (
              <p className="micro">{ow.payFirst}</p>
            )}
            {operations && o.status === 3 && !o.parcel && (
              <p className="micro">{ow.trackingFirst}</p>
            )}
            {operations && <OperatorOrderTools order={o} notifications={orderAccount.get(o.id)?.state.notifications.filter((item) => item.orderId === o.id) ?? []} run={runOrderAction} locale={locale} />}
            {operations && <OperatorOrderCommunication order={o} customerName={orderAccount.get(o.id)?.name ?? ""} customerEmail={orderAccount.get(o.id)?.id.replace(/^email:/, "") ?? ""} recipientAvailable={Boolean(orderAccount.get(o.id))} run={runOrderAction} locale={locale} />}
            <OrderDocuments orderId={o.id} accountId={orderAccount.get(o.id)?.id} operatorMode={operations} locale={state.communication.language}/>
            <div className="order-bottom">
              <details>
                <summary>{ow.calculationHistory}</summary>
                <div className="order-detail-grid">
                  <div>
                    <CostLines q={o.quote} storeReserveWaived={o.product.sourceShippingEstimated === true} locale={state.communication.language}/>
                    {o.customsConsent && (
                      <p className="micro">
                        {ow.customsAccepted}:{" "}
                        {new Date(o.customsConsent.acceptedAt).toLocaleString(
                          localeTag(locale),
                        )}
                        .
                      </p>
                    )}
                    {o.balanceUsed > 0 && (
                      <p className="micro">
                        {ow.balanceUsed}: {money(o.balanceUsed)}
                      </p>
                    )}
                    {o.settlement && (
                      <p className="micro">
                        {ow.actualWeight}: {o.settlement.actualWeight.toFixed(2)} {locale === "ru" ? "кг" : "kg"} · {ow.dimensional}: {o.settlement.dimensionalWeight.toFixed(2)} {locale === "ru" ? "кг" : "kg"}
                      </p>
                    )}
                  </div>
                  <ol className="history-list">
                    {[...o.history].reverse().map((h, i) => (
                      <li key={i}>
                        <time>{new Date(h.at).toLocaleString("ru-RU")}</time>
                        <p>{localizeLegacyStoredCopy(h.text, locale)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
              {!operations && o.status === 0 && !o.cancelled && (
                <button
                  className="text-button"
                  onClick={() =>
                    setConfirmation({
                      id: o.id,
                      cancel: true,
                      amount: o.quote.total,
                    })
                  }
                >
                  {ow.cancelOrder}
                </button>
              )}
            </div>
            </div>}
          </details>
        ))
      )}
      <Modal
        open={!!confirmingStoreShipping}
        onClose={() => {
          if (!busy) setStoreShippingOrder(null);
        }}
        title={ow.storeModalTitle}
        description={ow.storeModalDescription}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finishStoreShipping();
          }}
        >
          <div className="field">
            <label htmlFor="actual-store-shipping">
               {ow.actualStoreShipping}
            </label>
            <input
              id="actual-store-shipping"
              type="number"
              inputMode="decimal"
              required
              min="0"
              max="10000"
              step=".01"
              value={actualStoreShipping}
              onChange={(e) => setActualStoreShipping(e.target.value)}
            />
          </div>
          {confirmingStoreShipping && (
            <div className="confirm-price">
               <span>{ow.reserved}</span>
              <strong>
                {money(confirmingStoreShipping.quote.sourceShipping ?? 0)}
              </strong>
            </div>
          )}
          <button className="btn primary full" disabled={busy}>
             {busy ? ow.saving : ow.saveRecalculate}
            <Check size={18} />
          </button>
        </form>
      </Modal>
      <Modal
        open={!!receiving}
        onClose={() => {
          if (!busy) setWarehouse(null);
        }}
        title={ow.warehouseModalTitle}
        description={ow.warehouseModalDescription}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finishReceiving();
          }}
        >
          <div className="two-fields">
            {[
              ...ow.dimensions,
            ].map((l, i) => (
              <div className="field" key={l}>
                <label htmlFor={"dim-" + i}>{l}</label>
                <input
                  id={"dim-" + i}
                  type="number"
                  inputMode="decimal"
                  required
                  min=".01"
                  max={i ? 300 : 500}
                  step=".01"
                  value={dims[i]}
                  onChange={(e) =>
                    setDims(dims.map((n, j) => (j === i ? e.target.value : n)))
                  }
                />
              </div>
            ))}
          </div>
          {calc && receiving ? (
            <div className="receiving-preview">
              <dl className="cost-lines">
                <div>
                   <dt>{ow.volumeWeight}</dt>
                   <dd>{calc.dimensionalWeight.toFixed(2)} {locale === "ru" ? "кг" : "kg"}</dd>
                </div>
                <div>
                   <dt>{ow.payableWeight}</dt>
                   <dd>{calc.chargeableWeight.toFixed(2)} {locale === "ru" ? "кг" : "kg"}</dd>
                </div>
                <div>
                   <dt>{ow.paidShipping}</dt>
                  <dd>
                    {money(receiving.quote.shipping + receiving.quote.reserve)}
                  </dd>
                </div>
                <div>
                   <dt>{ow.afterWeighing}</dt>
                  <dd>{money(calc.shipping)}</dd>
                </div>
              </dl>
              <div
                className={"result-line " + (calc.extra ? "warning-text" : "")}
              >
                <span>
                   {calc.extra ? ow.requestExtra : ow.returnBalance}
                </span>
                <strong>{money(calc.extra || calc.refund)}</strong>
              </div>
            </div>
          ) : (
            <p role="alert" className="warning-text">
               {ow.invalidValues}
            </p>
          )}
          <button className="btn primary full" disabled={!calc || busy}>
             {busy ? ow.saving : ow.confirmRecalculate}
            <Check size={18} />
          </button>
        </form>
      </Modal>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(v) => {
          if (!v && !busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmation?.cancel
               ? ow.cancelTitle
              : confirmation?.payment
                 ? ow.paymentTitle
                 : ow.extraTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.cancel
               ? ow.cancelDescription
              : confirmation?.payment
                 ? ow.paymentDescription
                 : ow.extraDescription}
          </AlertDialogDescription>
          <div className="confirm-price">
            <span>{confirmation?.cancel ? ow.refund : confirmation?.payment ? ow.paymentStatusLabel : ow.toPay}</span>
            <strong>{formatSum(confirmation?.amount ?? 0, locale)}</strong>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{ow.back}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmation || busy) return;
                setBusy(true);
                const ok = await act(
                  confirmation.cancel
                    ? { type: "cancel", id: confirmation.id }
                    : confirmation.payment
                      ? { type: "payment-demo", id: confirmation.id }
                    : confirmation.storeShipping
                      ? {
                          type: "approve-store-shipping-extra",
                          id: confirmation.id,
                          amount: confirmation.amount,
                        }
                      : {
                        type: "approve-extra",
                        id: confirmation.id,
                        amount: confirmation.amount,
                        },
                );
                setBusy(false);
                if (ok) {
                  setConfirmation(null);
                   toast.success(ow.saveChanges);
                }
              }}
            >
              {busy
                 ? ow.saving
                : confirmation?.cancel
                   ? ow.cancelOrder
                   : ow.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
export function PricingManager({
  value,
  locale,
  onSaved,
  onDirtyChange,
}: {
  value: Pricing;
  locale: Locale;
  onSaved: (next: Pricing) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const isDirty=JSON.stringify(draft)!==JSON.stringify(value);
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  const serviceWords = {
    ru: { title: "Услуги и тарифы склада", intro: "Настройте цену за единицу и при необходимости отдельные тарифы по стране отправки. Фиксированная цена показывается клиенту, но не входит в заказ к оплате: оператор сначала подтверждает возможность, клиент отдельно одобряет точную сумму. Снимок условий сохраняется в заказе; списаний и реального выполнения пока нет.", add: "Добавить услугу", enabled: "Доступна клиентам", required: "Обязательна при оформлении", stage: "Когда показывать", checkout: "В корзине", warehouse: "После приёмки", unit: "Единица тарифа", pricing: "Ценообразование", fixed: "Фиксированный тариф", quote: "Цена после проверки оператором", baseFee: "Базовый тариф за единицу, сум", countryFee: "Тариф за единицу для страны, сум", titleLabel: "Название", description: "Описание", remove: "Отключить", insurance: "Страхование заблокировано до подтверждения страховщика, покрытия и порядка претензий." },
    uz: { title: "Ombor xizmatlari va tariflari", intro: "Birlik narxini va kerak bo‘lsa jo‘natish mamlakati bo‘yicha alohida tarifni belgilang. Belgilangan tarif buyurtma summasiga kiritilmaydi: operator imkoniyatni tasdiqlaydi, mijoz esa aniq summaga alohida rozilik beradi. Shartlar buyurtmada saqlanadi; haqiqiy yechib olish va bajarish hali yo‘q.", add: "Xizmat qo‘shish", enabled: "Mijozlarga ochiq", required: "Rasmiylashtirishda majburiy", stage: "Qachon ko‘rsatish", checkout: "Savatda", warehouse: "Qabuldan keyin", unit: "Tarif birligi", pricing: "Narxlash", fixed: "Belgilangan tarif", quote: "Operator tekshirgach narx", baseFee: "Birlik uchun asosiy tarif, so‘m", countryFee: "Mamlakat uchun birlik tarifi, so‘m", titleLabel: "Nomi", description: "Tavsif", remove: "O‘chirish", insurance: "Sug‘urtalovchi, qoplama va da’vo tartibi tasdiqlanmaguncha sug‘urta bloklangan." },
    en: { title: "Warehouse services and rates", intro: "Set a per-unit rate and optional dispatch-country overrides. A fixed rate is shown to customers but excluded from the checkout amount: an operator confirms feasibility, then the customer separately approves the exact amount. Terms are snapshotted on the order; no real charge or fulfilment is connected yet.", add: "Add service", enabled: "Available to customers", required: "Required at checkout", stage: "When to offer", checkout: "In cart", warehouse: "After intake", unit: "Pricing unit", pricing: "Pricing mode", fixed: "Fixed tariff", quote: "Operator quote after review", baseFee: "Base rate per unit, UZS", countryFee: "Rate per unit for country, UZS", titleLabel: "Title", description: "Description", remove: "Deactivate", insurance: "Insurance is locked until the insurer, coverage and claims process are confirmed." },
  }[locale];
  const pricingWords = {
    ru: {
      title: "Единые тарифы Atlas",
      updated: "Обновлено",
      default: "по умолчанию",
      estimateNotice: "Настройки расчёта Atlas не являются предложением перевозчика, склада или платёжного провайдера. Новые значения применяются к новым и обновляемым расчётам; уже оформленные заказы сохраняют исходные условия.",
      fx: "Сум за 1 USD",
      perKg: "Международная доставка за кг, USD",
      perKgNote: (usd: string, soum: string) => `В сумах доставка за кг считается по курсу: ${usd} = ${soum}.`,
      service: "Сервисный сбор Atlas",
      buyout: "Комиссия за выкуп",
      conversion: "Комиссия за конвертацию",
      deliveryMargin: "Маржа доставки",
      lineFee: "Общий сбор за позицию, сум",
      reserve: "Резерв международной доставки",
      divisor: "Делитель объёмного веса",
      storeFreeFrom: "Без резерва доставки магазина от, USD",
      lineFeeNote: "Общий сбор применяется к каждой товарной позиции. Он не заменяет тариф отдельно запрошенной услуги склада.",
      countryTitle: "Тарифы по фактической стране отправки",
      countryNote: "Выберите страну, откуда магазин фактически отправляет товар. Пустое поле наследует общий тариф. Смена настроек не пересчитывает оформленные заказы.",
      countryLabel: "Страна отправки",
      baseRate: "общий тариф",
      currencies: "Курсы валют к USD",
      currencyNote: "Курсы задаются вручную и не подключены к онлайн-источнику. Значение USD фиксировано.",
      perKgCountry: "Доставка за кг",
      lineFeeCountry: "Общий сбор за позицию",
      newQuotes: "Новые значения используются при создании или обновлении расчёта. Снимки оформленных заказов остаются неизменными.",
      save: "Сохранить тарифы",
      saving: "Сохраняем…",
      saved: "Единые тарифы обновлены. Новые расчёты будут использовать их.",
    },
    uz: {
      title: "Atlas yagona tariflari",
      updated: "Yangilangan",
      default: "standart",
      estimateNotice: "Atlas hisob sozlamalari tashuvchi, ombor yoki to‘lov provayderining taklifi yoki amaldagi tarifi emas. Yangi qiymatlar yangi va yangilanadigan hisob-kitoblarga qo‘llanadi; rasmiylashtirilgan buyurtmalar o‘zgarmaydi.",
      fx: "1 USD uchun so‘m",
      perKg: "Xalqaro yetkazib berish, kg uchun USD",
      perKgNote: (usd: string, soum: string) => `Kg uchun yetkazib berish so‘mda kurs bo‘yicha hisoblanadi: ${usd} = ${soum}.`,
      service: "Atlas xizmat haqi",
      buyout: "Xarid komissiyasi",
      conversion: "Konvertatsiya komissiyasi",
      deliveryMargin: "Yetkazib berish marjasi",
      lineFee: "Har bir tovar qatori uchun umumiy yig‘im, so‘m",
      reserve: "Xalqaro yetkazib berish zaxirasi",
      divisor: "Hajmiy vazn bo‘luvchisi",
      storeFreeFrom: "Do‘kon yetkazishi zaxirasiz, USD dan",
      lineFeeNote: "Umumiy yig‘im har bir tovar qatoriga qo‘llanadi. U alohida so‘ralgan ombor xizmati tarifini almashtirmaydi.",
      countryTitle: "Haqiqiy jo‘natish mamlakati bo‘yicha tariflar",
      countryNote: "Do‘kon mahsulotni haqiqatda qaysi mamlakatdan yuborishini tanlang. Bo‘sh maydon umumiy tarifdan foydalanadi. Rasmiylashtirilgan buyurtmalar qayta hisoblanmaydi.",
      countryLabel: "Jo‘natish mamlakati",
      baseRate: "umumiy tarif",
      currencies: "USD ga nisbatan valyuta kurslari",
      currencyNote: "Kurslar qo‘lda kiritiladi va onlayn manbaga ulanmagan. USD qiymati o‘zgarmaydi.",
      perKgCountry: "Yetkazib berish, kg uchun",
      lineFeeCountry: "Har bir tovar qatori uchun umumiy yig‘im",
      newQuotes: "Yangi qiymatlar yangi yoki yangilanadigan hisob-kitobda ishlatiladi. Rasmiylashtirilgan buyurtma nusxalari o‘zgarmaydi.",
      save: "Tariflarni saqlash",
      saving: "Saqlanmoqda…",
      saved: "Yagona tariflar yangilandi. Yangi hisob-kitoblarda ular qo‘llanadi.",
    },
    en: {
      title: "Atlas central tariffs",
      updated: "Updated",
      default: "default",
      estimateNotice: "Atlas calculation settings are not a carrier, warehouse or payment-provider quote or tariff. New values apply to new or refreshed estimates; existing orders keep their original terms.",
      fx: "UZS per 1 USD",
      perKg: "International delivery per kg, USD",
      perKgNote: (usd: string, soum: string) => `Delivery per kg in soum follows the rate: ${usd} = ${soum}.`,
      service: "Atlas service fee",
      buyout: "Buyout commission",
      conversion: "Conversion commission",
      deliveryMargin: "Delivery margin",
      lineFee: "General fee per item line, UZS",
      reserve: "International delivery reserve",
      divisor: "Dimensional-weight divisor",
      storeFreeFrom: "No store-delivery reserve from, USD",
      lineFeeNote: "This general fee applies to each product line. It is separate from a requested warehouse service rate.",
      countryTitle: "Rates by actual dispatch country",
      countryNote: "Choose the country the merchant actually dispatches the item from. Blank fields inherit the global rate. Saved orders are not recalculated when settings change.",
      countryLabel: "Dispatch country",
      baseRate: "global rate",
      currencies: "Currency rates to USD",
      currencyNote: "Rates are entered manually and are not connected to a live market feed. USD is fixed.",
      perKgCountry: "Delivery per kg",
      lineFeeCountry: "General fee per item line",
      newQuotes: "New values are used when a quote is created or refreshed. Existing order snapshots remain unchanged.",
      save: "Save tariffs",
      saving: "Saving…",
      saved: "Central tariffs updated. New calculations will use them.",
    },
  }[locale];
  const countryLabels: Record<string, Record<Locale, string>> = {
    "США": { ru: "США", uz: "AQSh", en: "United States" },
    "Испания": { ru: "Испания", uz: "Ispaniya", en: "Spain" },
    "Германия": { ru: "Германия", uz: "Germaniya", en: "Germany" },
    "Великобритания": { ru: "Великобритания", uz: "Buyuk Britaniya", en: "United Kingdom" },
    "Франция": { ru: "Франция", uz: "Fransiya", en: "France" },
    "Италия": { ru: "Италия", uz: "Italiya", en: "Italy" },
    "Румыния": { ru: "Румыния", uz: "Ruminiya", en: "Romania" },
    "Китай": { ru: "Китай", uz: "Xitoy", en: "China" },
    "Турция": { ru: "Турция", uz: "Turkiya", en: "Turkey" },
    "Япония": { ru: "Япония", uz: "Yaponiya", en: "Japan" },
    "Южная Корея": { ru: "Южная Корея", uz: "Janubiy Koreya", en: "South Korea" },
    "ОАЭ": { ru: "ОАЭ", uz: "BAA", en: "UAE" },
    "Канада": { ru: "Канада", uz: "Kanada", en: "Canada" },
    "Австралия": { ru: "Австралия", uz: "Avstraliya", en: "Australia" },
  };
  const updateService = (index: number, patch: Partial<ServiceOffering>) => setDraft((current) => ({ ...current, serviceCatalog: current.serviceCatalog.map((service, serviceIndex) => serviceIndex === index ? { ...service, ...patch } : service) }));
  const addService = () => setDraft((current) => ({ ...current, serviceCatalog: [...current.serviceCatalog, { id: `custom-service-${crypto.randomUUID().slice(0, 8)}`, title: { ru: "Новая услуга", uz: "Yangi xizmat", en: "New service" }, description: { ru: "", uz: "", en: "" }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: false, required: false }] }));
  const setNumber = (key: "fx" | "perKgUsd" | "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "optionalServices" | "reserve" | "divisor" | "storeShippingFreeFromUsd", raw: string) =>
    setDraft((current) => ({ ...current, [key]: Number(raw) }));
  const [fxBusy, setFxBusy] = useState(false);
  const fxWords = {
    ru: { title: "Курс USD → сум", source: "Источник курса", cbu: "Курс ЦБ Узбекистана × наценка", manual: "Установленный курс (вручную)", markup: "Наценка к курсу ЦБ", none: "Курс ЦБ ещё не получен: действует установленный курс.", last: (rate: string, date: string, at: string) => `ЦБ: ${rate} сум на ${date}; проверено ${at}. Сервер обновляет курс раз в 6 часов.`, refresh: "Обновить курс ЦБ сейчас", failed: "Не удалось получить курс ЦБ.", updated: (fx: string) => `Курс обновлён: ${fx} сум за $1.`, customsTitle: "Таможня (ориентир для клиента)", allowance: "Лимит в месяц на получателя, $", rate: "Ставка, %", perKg: "Минимум за кг, $", helpFee: "Комиссия «Atlas поможет оплатить», %", customsNote: "Пустое поле — правило, проверенное на lex.uz 04.10.2026 (ПКМ №244, ПП-4508, УП-174). Таможня в сумму заказа не входит." },
    uz: { title: "USD → so‘m kursi", source: "Kurs manbai", cbu: "O‘zbekiston MB kursi × ustama", manual: "Belgilangan kurs (qo‘lda)", markup: "MB kursiga ustama", none: "MB kursi hali olinmagan: belgilangan kurs amal qiladi.", last: (rate: string, date: string, at: string) => `MB: ${date} uchun ${rate} so‘m; ${at} da tekshirildi. Server kursni har 6 soatda yangilaydi.`, refresh: "MB kursini hozir yangilash", failed: "MB kursini olib bo‘lmadi.", updated: (fx: string) => `Kurs yangilandi: $1 uchun ${fx} so‘m.`, customsTitle: "Bojxona (mijoz uchun taxmin)", allowance: "Qabul qiluvchiga oylik limit, $", rate: "Stavka, %", perKg: "Kg uchun minimum, $", helpFee: "«Atlas to‘lashga yordam beradi» komissiyasi, %", customsNote: "Bo‘sh maydon — lex.uz da 04.10.2026 tekshirilgan qoida (VMQ №244, PP-4508, PF-174). Bojxona buyurtma summasiga kirmaydi." },
    en: { title: "USD → UZS rate", source: "Rate source", cbu: "Central Bank of Uzbekistan rate × markup", manual: "Set rate (manual)", markup: "Markup on the CBU rate", none: "No CBU rate yet: the set rate applies.", last: (rate: string, date: string, at: string) => `CBU: ${rate} UZS for ${date}; checked ${at}. The server refreshes it every 6 hours.`, refresh: "Refresh the CBU rate now", failed: "Could not get the CBU rate.", updated: (fx: string) => `Rate updated: ${fx} UZS per $1.`, customsTitle: "Customs (estimate shown to customers)", allowance: "Monthly allowance per recipient, $", rate: "Rate, %", perKg: "Minimum per kg, $", helpFee: "“Atlas helps pay” fee, %", customsNote: "Empty = the rule checked on lex.uz on 04.10.2026 (CM No. 244, PP-4508, UP-174). Customs is not part of the order sum." },
  }[locale];
  // A tariff saved before delivery was priced in USD shows its soum rate converted at the current rate.
  const usdOf = (soum: number) => Math.round((soum / draft.fx) * 100) / 100;
  const perKgUsd = draft.perKgUsd ?? usdOf(draft.perKg);
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pricing",
          value: {
            fx: draft.fx,
            perKg: Math.max(1, Math.round(perKgUsd * draft.fx)),
            perKgUsd,
            margin: draft.margin,
            buyoutFee: draft.buyoutFee,
            conversionFee: draft.conversionFee,
            deliveryMargin: draft.deliveryMargin,
            optionalServices: draft.optionalServices,
            reserve: draft.reserve,
            divisor: draft.divisor,
            storeShippingFreeFromUsd: draft.storeShippingFreeFromUsd,
            fxSource: draft.fxSource ?? "manual",
            fxMarkup: draft.fxMarkup ?? 1.012,
            customsAllowanceUsd: draft.customsAllowanceUsd,
            customsRate: draft.customsRate,
            customsMinimumPerKg: draft.customsMinimumPerKg,
            customsHelpFee: draft.customsHelpFee ?? 0.03,
            rates: draft.rates,
            countryOverrides: draft.countryOverrides,
            serviceCatalog: draft.serviceCatalog,
          },
        }),
      });
      const data = (await response.json()) as { pricing?: Pricing; error?: string };
      if (!response.ok || !data.pricing)
        throw Error(data.error ?? "Не удалось сохранить тарифы.");
      setDraft(data.pricing);
      onSaved(data.pricing);
      toast.success(pricingWords.saved);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className="surface pricing-manager" open>
      <summary>
        <span>
          <b>{pricingWords.title}</b>
          <small>
            {money(value.fx)} / USD · {value.updatedAt
              ? `${pricingWords.updated} ${new Date(value.updatedAt).toLocaleString(localeTag(locale))}`
              : pricingWords.default}
          </small>
        </span>
         <span className="status-badge">{isDirty?(locale==="ru"?"Не сохранено":locale==="uz"?"Saqlanmagan":"Unsaved"):value.version}</span>
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="notice warning" role="note">{pricingWords.estimateNotice}</p>
        {/* Where the soum rate comes from: the Central Bank's USD rate × markup (read by the server), or a set rate. */}
        <fieldset className="pricing-fx">
          <legend>{fxWords.title}</legend>
          <div className="pricing-grid">
            <div className="field"><label htmlFor="pricing-fx-source">{fxWords.source}</label>
              <select id="pricing-fx-source" value={draft.fxSource ?? "manual"} onChange={(event) => setDraft((current) => ({ ...current, fxSource: event.target.value as "cbu" | "manual" }))}>
                <option value="cbu">{fxWords.cbu}</option><option value="manual">{fxWords.manual}</option>
              </select></div>
            <div className="field"><label htmlFor="pricing-fx-markup">{fxWords.markup}</label><input id="pricing-fx-markup" type="number" min="1" max="1.2" step="0.001" value={draft.fxMarkup ?? 1.012} disabled={(draft.fxSource ?? "manual") !== "cbu"} onChange={(event) => setDraft((current) => ({ ...current, fxMarkup: Number(event.target.value) }))} /></div>
          </div>
          <p className="micro">{draft.fxCbuRate ? fxWords.last(String(draft.fxCbuRate), draft.fxCbuDate ?? "", draft.fxUpdatedAt ? new Date(draft.fxUpdatedAt).toLocaleString(localeTag(locale)) : "—") : fxWords.none}</p>
          <button type="button" className="btn secondary" disabled={fxBusy} onClick={async () => {
            setFxBusy(true);
            try {
              const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "fx-refresh" }) });
              const data = (await response.json()) as { pricing?: Pricing; error?: string };
              if (!response.ok || !data.pricing) throw Error(data.error ?? fxWords.failed);
              setDraft(data.pricing); onSaved(data.pricing); toast.success(fxWords.updated(String(data.pricing.fx)));
            } catch (error) { toast.error((error as Error).message); } finally { setFxBusy(false); }
          }}>{fxBusy ? "…" : fxWords.refresh}</button>
        </fieldset>
        <div className="pricing-grid">
          {[
            ["fx", pricingWords.fx, 1],
            ["perKgUsd", pricingWords.perKg, 0.01],
            ["margin", pricingWords.service, 0.01],
            ["buyoutFee", pricingWords.buyout, 0.01],
            ["conversionFee", pricingWords.conversion, 0.01],
            ["deliveryMargin", pricingWords.deliveryMargin, 0.01],
            ["optionalServices", pricingWords.lineFee, 1],
            ["reserve", pricingWords.reserve, 0.01],
            ["divisor", pricingWords.divisor, 1],
            ["storeShippingFreeFromUsd", pricingWords.storeFreeFrom, 1],
          ].map(([key, label, step]) => (
            <div className="field" key={String(key)}>
              <label htmlFor={`pricing-${key}`}>{label}{["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? ", %" : ""}</label>
              <input
                id={`pricing-${key}`}
                type="number"
                required
                min={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve", "optionalServices", "storeShippingFreeFromUsd"].includes(String(key)) ? 0 : Number(step)}
                max={["margin", "buyoutFee", "conversionFee", "deliveryMargin"].includes(String(key)) ? 100 : key === "reserve" ? 200 : undefined}
                step={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? 0.1 : Number(step)}
                value={["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? draft[key as "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "reserve"] * 100 : key === "perKgUsd" ? perKgUsd : draft[key as "fx" | "optionalServices" | "divisor" | "storeShippingFreeFromUsd"]}
                onChange={(event) =>
                  setNumber(
                    key as "fx" | "perKgUsd" | "margin" | "buyoutFee" | "conversionFee" | "deliveryMargin" | "optionalServices" | "reserve" | "divisor" | "storeShippingFreeFromUsd",
                    ["margin", "buyoutFee", "conversionFee", "deliveryMargin", "reserve"].includes(String(key)) ? String(Number(event.target.value) / 100) : event.target.value,
                  )
                }
              />
            </div>
          ))}
        </div>
        <p className="micro">{pricingWords.perKgNote(`$${perKgUsd}`, money(Math.round(perKgUsd * draft.fx)))} {pricingWords.lineFeeNote}</p>
        {/* Customs estimate parameters: informational, never part of an order sum; empty = the rule checked on lex.uz. */}
        <fieldset className="pricing-fx">
          <legend>{fxWords.customsTitle}</legend>
          <div className="pricing-grid">
            {([["customsAllowanceUsd", fxWords.allowance, 1, 1], ["customsRate", fxWords.rate, 0.1, 100], ["customsMinimumPerKg", fxWords.perKg, 0.1, 1], ["customsHelpFee", fxWords.helpFee, 0.1, 100]] as const).map(([key, label, step, scale]) => <div className="field" key={key}>
              <label htmlFor={`pricing-${key}`}>{label}</label>
              <input id={`pricing-${key}`} type="number" min="0" step={step} value={draft[key] === undefined ? "" : Math.round(draft[key]! * scale * 1000) / 1000} placeholder={key === "customsAllowanceUsd" ? "200" : key === "customsRate" ? "20" : key === "customsMinimumPerKg" ? "2" : "3"}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value === "" ? (key === "customsHelpFee" ? 0.03 : undefined) : Number(event.target.value) / scale }))} />
            </div>)}
          </div>
          <p className="micro">{fxWords.customsNote}</p>
        </fieldset>
        <details className="country-pricing">
          <summary>{pricingWords.countryTitle}</summary>
          <p className="micro">{pricingWords.countryNote}</p>
          <div className="field">
            <label htmlFor="pricing-country">{pricingWords.countryLabel}</label>
            <select id="pricing-country" value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)}>
              {countries.filter((country) => country !== "Другая страна").map((country) => <option key={country} value={country}>{countryLabels[country]?.[locale] ?? country}</option>)}
            </select>
          </div>
          <div className="pricing-grid country-pricing-grid">
            {([
              ["margin", pricingWords.service, "%"],
              ["buyoutFee", pricingWords.buyout, "%"],
              ["conversionFee", pricingWords.conversion, "%"],
              ["deliveryMargin", pricingWords.deliveryMargin, "%"],
              ["perKgUsd", pricingWords.perKgCountry, "USD"],
              ["reserve", pricingWords.reserve, "%"],
              ["optionalServices", pricingWords.lineFeeCountry, locale === "en" ? "UZS" : locale === "uz" ? "so‘m" : "сум"],
            ] as const).map(([key, label, unit]) => {
              const values = draft.countryOverrides[selectedCountry];
              // An override saved in soum before USD rates shows converted and is replaced on edit.
              const override = key === "perKgUsd" ? values?.perKgUsd ?? (values?.perKg === undefined ? undefined : usdOf(values.perKg)) : values?.[key];
              const base = key === "perKgUsd" ? perKgUsd : draft[key];
              const isRate = unit === "%";
              return <div className="field" key={key}>
                <label htmlFor={`country-pricing-${key}`}>{label}, {unit}</label>
                <input
                  id={`country-pricing-${key}`}
                  type="number"
                  min="0"
                  step={isRate ? "0.1" : key === "perKgUsd" ? "0.01" : "1"}
                  max={isRate ? (key === "reserve" ? 200 : 100) : undefined}
                  value={override === undefined ? "" : isRate ? override * 100 : override}
                  placeholder={`${isRate ? base * 100 : base} (${pricingWords.baseRate})`}
                  onChange={(event) => setDraft((current) => {
                    const countryOverrides = { ...current.countryOverrides };
                    const countryValues = { ...(countryOverrides[selectedCountry] ?? {}) };
                    if (key === "perKgUsd") delete countryValues.perKg;
                    if (event.target.value === "") delete countryValues[key];
                    else countryValues[key] = Number(event.target.value) / (isRate ? 100 : 1);
                    if (Object.keys(countryValues).length) countryOverrides[selectedCountry] = countryValues;
                    else delete countryOverrides[selectedCountry];
                    return { ...current, countryOverrides };
                  })}
                />
              </div>;
            })}
          </div>
        </details>
        <section className="warehouse-service-catalog">
          <div className="warehouse-service-catalog-heading"><div><h3>{serviceWords.title}</h3><p className="micro">{serviceWords.intro}</p></div><button type="button" className="btn secondary" disabled={draft.serviceCatalog.length >= 40} onClick={addService}>{serviceWords.add}</button></div>
          {draft.serviceCatalog.some((service) => service.id === "shipping-insurance") && <p className="notice warning">{serviceWords.insurance}</p>}
          <div className="warehouse-service-catalog-list">{draft.serviceCatalog.map((service, index) => <details className="warehouse-service-config" key={service.id}>
            <summary><span><b>{serviceTitle(service, locale)}</b><small>{service.id} · {service.enabled ? serviceWords.enabled : serviceWords.remove}</small></span><span className="status-badge">{service.pricingMode === "fixed" ? `${serviceFeeForCountry(service, selectedCountry).toLocaleString("ru-RU")} сум / ${service.unit === "package" ? (locale === "ru" ? "посылка" : locale === "uz" ? "posilka" : "package") : service.unit === "item" ? (locale === "ru" ? "шт." : locale === "uz" ? "dona" : "item") : service.unit === "photo" ? (locale === "ru" ? "фото" : locale === "uz" ? "foto" : "photo") : service.unit === "day" ? (locale === "ru" ? "день" : locale === "uz" ? "kun" : "day") : (locale === "ru" ? "30 мин." : locale === "uz" ? "30 daq." : "30 min")}` : serviceWords.quote}</span></summary>
            <div className="warehouse-service-config-body">
              <label className="warehouse-service-toggle"><input type="checkbox" checked={service.enabled} disabled={service.id === "shipping-insurance"} onChange={(event) => updateService(index, { enabled: event.target.checked, required: event.target.checked ? service.required : false })} />{serviceWords.enabled}</label>
              <div className="pricing-grid">
                <div className="field"><label htmlFor={`service-stage-${service.id}`}>{serviceWords.stage}</label><select id={`service-stage-${service.id}`} value={service.requestStage} onChange={(event) => updateService(index, { requestStage: event.target.value as ServiceOffering["requestStage"], required: event.target.value === "checkout" ? service.required : false })}><option value="checkout">{serviceWords.checkout}</option><option value="warehouse">{serviceWords.warehouse}</option></select></div>
                <div className="field"><label htmlFor={`service-unit-${service.id}`}>{serviceWords.unit}</label><select id={`service-unit-${service.id}`} value={service.unit} onChange={(event) => updateService(index, { unit: event.target.value as ServiceOffering["unit"] })}><option value="package">{locale === "ru" ? "посылка" : locale === "uz" ? "posilka" : "package"}</option><option value="item">{locale === "ru" ? "товар" : locale === "uz" ? "tovar" : "item"}</option><option value="day">{locale === "ru" ? "день" : locale === "uz" ? "kun" : "day"}</option><option value="photo">{locale === "ru" ? "фото" : locale === "uz" ? "foto" : "photo"}</option><option value="half-hour">{locale === "ru" ? "30 минут" : locale === "uz" ? "30 daqiqa" : "30 minutes"}</option></select></div>
                <div className="field"><label htmlFor={`service-pricing-${service.id}`}>{serviceWords.pricing}</label><select id={`service-pricing-${service.id}`} value={service.pricingMode} onChange={(event) => updateService(index, { pricingMode: event.target.value as ServiceOffering["pricingMode"], required: event.target.value === "fixed" ? service.required : false })}><option value="operator-quote">{serviceWords.quote}</option><option value="fixed">{serviceWords.fixed}</option></select></div>
                <div className="field"><label htmlFor={`service-fee-${service.id}`}>{serviceWords.baseFee}</label><input id={`service-fee-${service.id}`} type="number" min="0" max="20000000" step="1" disabled={service.pricingMode !== "fixed"} value={service.feeUzs} onChange={(event) => updateService(index, { feeUzs: Number(event.target.value) })} /></div>
                <div className="field"><label htmlFor={`service-country-fee-${service.id}`}>{serviceWords.countryFee} · {selectedCountry}</label><input id={`service-country-fee-${service.id}`} type="number" min="0" max="20000000" step="1" disabled={service.pricingMode !== "fixed"} value={service.countryPrices[selectedCountry] ?? ""} placeholder={`${service.feeUzs} (${locale === "ru" ? "общий тариф" : locale === "uz" ? "asosiy tarif" : "base price"})`} onChange={(event) => {
                  const countryPrices = { ...service.countryPrices };
                  if (event.target.value === "") delete countryPrices[selectedCountry]; else countryPrices[selectedCountry] = Number(event.target.value);
                  updateService(index, { countryPrices });
                }} /></div>
              </div>
              <label className="warehouse-service-toggle"><input type="checkbox" checked={service.required} disabled={!service.enabled || service.requestStage !== "checkout" || service.pricingMode !== "fixed"} onChange={(event) => updateService(index, { required: event.target.checked })} />{serviceWords.required}</label>
              <div className="warehouse-service-locales">{(["ru", "uz", "en"] as const).map((language) => <fieldset key={language}><legend>{serviceWords.titleLabel} / {serviceWords.description} · {language.toUpperCase()}</legend><div className="field"><label htmlFor={`service-title-${service.id}-${language}`}>{serviceWords.titleLabel}</label><input id={`service-title-${service.id}-${language}`} required maxLength={120} value={service.title[language]} onChange={(event) => updateService(index, { title: { ...service.title, [language]: event.target.value } })} /></div><div className="field"><label htmlFor={`service-description-${service.id}-${language}`}>{serviceWords.description}</label><textarea id={`service-description-${service.id}-${language}`} maxLength={500} rows={3} value={service.description[language]} onChange={(event) => updateService(index, { description: { ...service.description, [language]: event.target.value } })} /></div></fieldset>)}</div>
              <p className="micro">{locale === "ru" ? "Чтобы скрыть существующую услугу, снимите флажок доступности. Удаление отключено, чтобы не ломать историю заказов." : locale === "uz" ? "Mavjud xizmatni yashirish uchun ochiqlik belgisini olib tashlang. Buyurtma tarixini saqlash uchun o‘chirish yo‘q." : "Deactivate an existing offer instead of deleting it so old orders keep their references."}</p>
            </div>
          </details>)}</div>
        </section>
        <details className="currency-rates">
          <summary>{pricingWords.currencies}</summary>
          <p className="micro">{pricingWords.currencyNote}</p>
          <div className="pricing-grid currency-grid">
            {Object.entries(draft.rates).map(([code, rate]) => (
              <div className="field" key={code}>
                <label htmlFor={`rate-${code}`}>{locale === "ru" ? `1 ${code} в USD` : `1 ${code} → USD`}</label>
                <input
                  id={`rate-${code}`}
                  type="number"
                  required
                  min="0.000001"
                  step="0.000001"
                  value={rate}
                  disabled={code === "USD"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rates: {
                        ...current.rates,
                        [code]: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </details>
        <p className="micro">{pricingWords.newQuotes}</p>
        <button className="btn primary" disabled={saving||!isDirty}>
          {saving ? pricingWords.saving : pricingWords.save}
          <Check size={17} />
        </button>
      </form>
    </details>
  );
}

function CommunicationPanel({
  value,
  email,
  phone,
  save,
}: {
  value: Communication;
  email: string;
  phone: string;
  save: (value: Communication) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Communication>({
    ...value,
    email: value.email || email,
    phone: value.phone || phone,
  });
  const [saving, setSaving] = useState(false);
  const communicationWords={ru:{eyebrow:'КАНАЛЫ СВЯЗИ',title:'Email и SMS',emailHint:'Статусы, оплата и возвраты',smsHint:'Только важные изменения',phone:'Телефон',language:'Язык интерфейса и уведомлений',save:'Сохранить настройки',saved:'Настройки email и SMS сохранены'},uz:{eyebrow:'ALOQA KANALLARI',title:'Email va SMS',emailHint:'Holatlar, to‘lov va qaytarishlar',smsHint:'Faqat muhim o‘zgarishlar',phone:'Telefon',language:'Interfeys va bildirishnomalar tili',save:'Sozlamalarni saqlash',saved:'Email va SMS sozlamalari saqlandi'},en:{eyebrow:'CONTACT CHANNELS',title:'Email and SMS',emailHint:'Status, payment and refunds',smsHint:'Important changes only',phone:'Phone',language:'Interface and notification language',save:'Save settings',saved:'Email and SMS settings saved'}}[value.language];
  const communicationCopy=value.language==='ru'?{description:'Настройки сохраняются в профиле. Отправка email и SMS пока не подключена.',status:'Отправка не подключена'}:value.language==='uz'?{description:'Sozlamalar profilda saqlanadi. Email va SMS yuborish hali ulanmagan.',status:'Yuborish ulanmagan'}:{description:'Preferences are saved to your account. Email and SMS delivery is not connected yet.',status:'Delivery not connected'};
  async function submit() {
    setSaving(true);
    const ok = await save(draft);
    setSaving(false);
    if (ok) toast.success(communicationWords.saved);
  }
  return (
    <section className="surface communication-panel">
      <div className="communication-heading">
         <div><span className="eyebrow">{communicationWords.eyebrow}</span><h2>{communicationWords.title}</h2><p>{communicationCopy.description}</p></div>
         <span className="status-badge">{communicationCopy.status}</span>
      </div>
      <div className="communication-grid">
         <label className="channel-card"><input type="checkbox" checked={draft.emailEnabled} onChange={(event) => setDraft({ ...draft, emailEnabled: event.target.checked })} /><Mail size={22} /><span><b>Email</b><small>{communicationWords.emailHint}</small></span></label>
         <label className="channel-card"><input type="checkbox" checked={draft.smsEnabled} onChange={(event) => setDraft({ ...draft, smsEnabled: event.target.checked })} /><MessageSquareText size={22} /><span><b>SMS</b><small>{communicationWords.smsHint}</small></span></label>
      </div>
      <div className="communication-fields">
        <div className="field"><label htmlFor="notice-email">Email</label><input id="notice-email" type="email" required={draft.emailEnabled} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div>
         <div className="field"><label htmlFor="notice-phone">{communicationWords.phone}</label><input id="notice-phone" type="tel" required={draft.smsEnabled} placeholder="+998 90 123 45 67" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div>
         <div className="field"><label htmlFor="notice-language">{communicationWords.language}</label><select id="notice-language" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as "ru" | "uz" | "en" })}><option value="ru">Русский</option><option value="uz">O‘zbekcha</option><option value="en">English</option></select></div>
      </div>
       <button className="btn secondary" disabled={saving || (draft.emailEnabled && !draft.email) || (draft.smsEnabled && !draft.phone)} onClick={() => void submit()}>{saving ? "…" : communicationWords.save}<Check size={17} /></button>
    </section>
  );
}

export function NotificationsView() {
  const { state, ready, error, act, user } = useMarket();
  const [noticeFilter, setNoticeFilter] = useState<"all" | "unread" | "orders">("all");
  const locale = state.communication.language;
  const c = noticesCopy[locale];
  const notices = state.notifications.filter(item => noticeFilter === "all" || (noticeFilter === "unread" && !item.read) || (noticeFilter === "orders" && item.orderId));
  // One card per order: the newest update on top, older ones behind "N more updates".
  const grouped = new Map<string, typeof notices>();
  for (const item of [...notices].sort((a, b) => b.at - a.at)) { const key = item.orderId ?? item.id; grouped.set(key, [...(grouped.get(key) ?? []), item]); }
  const groups = [...grouped.values()];
  const unread = state.notifications.filter(item => !item.read).length;
  const counts = { all: state.notifications.length, unread, orders: state.notifications.filter(item => item.orderId).length };
  return (
    <div className="notices-page">
      <header className="orders-head">
        <div><h1>{c.title}</h1>{ready && state.notifications.length > 0 && <p>{unread ? c.unread(unread) : c.allRead}</p>}</div>
        {ready && unread > 0 && <button type="button" className="btn secondary" onClick={() => void act({ type: "notifications-read" })}><CheckCheck size={17} aria-hidden="true" />{c.readAll}</button>}
      </header>
      {!ready ? (
        error
          ? <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><Bell size={28} /></span><h2>{c.signin.title}</h2><p>{c.signin.text}</p><div className="basket-empty-actions"><Link className="btn primary" href="/login?return_to=%2Fnotifications">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
          : <div className="basket-loading" role="status">{c.loading}</div>
      ) : !state.notifications.length ? (
        <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><Bell size={28} /></span><h2>{c.emptyTitle}</h2><p>{c.emptyText}</p><div className="basket-empty-actions"><Link className="btn secondary" href="/orders">{c.orders}</Link></div></section>
      ) : (
        <>
          <div className="notice-filters" role="group" aria-label={c.filtersLabel}>{(["all", "unread", "orders"] as const).map(value => <button type="button" key={value} className={noticeFilter === value ? "active" : ""} aria-pressed={noticeFilter === value} onClick={() => setNoticeFilter(value)}>{c.filters[value]}<b>{counts[value]}</b></button>)}</div>
          {!groups.length ? <p className="cabinet-empty">{c.emptyFilter}</p> : <ul className="notices-list">
            {groups.map(([item, ...history]) => <li key={item.id} className={"notice-x" + (!item.read ? " unread" : "")}>
              <span className="notice-x-icon" aria-hidden="true"><Bell size={18} /></span>
              <div className="notice-x-body">
                <div className="notice-x-head"><h2>{localizeLegacyStoredCopy(item.title, locale)}</h2>{!item.read && <span className="notice-x-new">{c.newBadge}</span>}</div>
                <p>{localizeLegacyStoredCopy(item.message, locale)}</p>
                <div className="notice-x-foot"><time dateTime={new Date(item.at).toISOString()}>{formatDateTime(item.at, locale)}</time>{item.orderId && <Link className="order-x-link" href={"/orders#" + item.orderId}>{c.openOrder} {item.orderId}<ArrowRight size={14} aria-hidden="true" /></Link>}</div>
                {history.length > 0 && <details className="notice-x-history"><summary>{c.more(history.length)}</summary><ol>{history.map(previous => <li key={previous.id}><b>{localizeLegacyStoredCopy(previous.title, locale)}</b><p>{localizeLegacyStoredCopy(previous.message, locale)}</p><time dateTime={new Date(previous.at).toISOString()}>{formatDateTime(previous.at, locale)}</time></li>)}</ol></details>}
              </div>
            </li>)}
          </ul>}
        </>
      )}
      {ready && <details className="notice-settings"><summary>{c.settings}</summary><CommunicationPanel key={`${state.communication.emailEnabled}-${state.communication.smsEnabled}-${state.communication.email}-${state.communication.phone}-${state.communication.language}`} value={state.communication} email={user?.email ?? ""} phone={state.deliveryProfile?.phone ?? ""} save={(value) => act({ type: "communication-save", value })} /></details>}
      {ready && user?.operator && (
        <section className="message-log-section">
          <div className="section-heading"><h2>Журнал внешних сообщений</h2><span>{state.messageDeliveries.length} подготовлено</span></div>
          {!state.messageDeliveries.length ? <div className="surface message-log-empty"><Mail size={23} /><div><h3>{locale==='ru'?'Сообщений пока нет':locale==='uz'?'Hozircha xabarlar yo‘q':'No messages yet'}</h3><p>{locale==='ru'?'Настройки email и SMS можно сохранить, но отправка пока не подключена.':locale==='uz'?'Email va SMS sozlamalarini saqlash mumkin, lekin yuborish hali ulanmagan.':'Email and SMS preferences can be saved, but delivery is not connected yet.'}</p></div></div> : <div className="surface message-log">{state.messageDeliveries.map((item) => <article key={item.id}><span className="message-channel">{item.channel === "email" ? <Mail size={17} /> : <MessageSquareText size={17} />}{item.channel.toUpperCase()}</span><div><b>{item.title}</b><p>{item.orderId ? `${item.orderId} · ` : ""}{item.destination}</p></div><span className="status-badge">{locale==='ru'?'Не отправлено':locale==='uz'?'Yuborilmadi':'Not sent'}</span><time>{formatDateTime(item.at, locale)}</time></article>)}</div>}
        </section>
      )}
    </div>
  );
}

export function BalanceView() {
  const { state, ready, error } = useMarket();
  const locale = state.communication.language as Locale;
  const c = balanceCopy[locale];
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const reserved = state.orders.filter((o) => !o.cancelled && !o.settlement).reduce((s, o) => s + o.quote.reserve, 0);
  const entries = [...state.entries].reverse();
  return (
    <div className="wallet-page">
      <header className="orders-head"><div><h1>{c.title}</h1></div></header>
      {!ready ? (
        error
          ? <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><Wallet size={28} /></span><h2>{c.signin.title}</h2><p>{c.signin.text}</p><div className="basket-empty-actions"><Link className="btn primary" href="/login?return_to=%2Fbalance">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
          : <div className="basket-loading" role="status">{c.loading}</div>
      ) : <>
        <div className="wallet-grid">
          <section className="wallet-card" aria-labelledby="wallet-label">
            <p id="wallet-label" className="order-x-eyebrow"><Wallet size={16} aria-hidden="true" />{c.label}</p>
            <strong className="wallet-amount">{formatSum(balanceOf(state), locale)}</strong>
            <p className="wallet-note">{c.note}</p>
            <div className="wallet-actions">
              <Link href="/order-by-link" className="btn primary">{c.spend}<ArrowRight size={18} aria-hidden="true" /></Link>
              <button type="button" className="btn secondary" onClick={() => setWithdrawOpen(true)}>{c.withdraw}</button>
            </div>
          </section>
          <section className="cabinet-card wallet-reserve" aria-labelledby="wallet-reserve-title">
            <h2 id="wallet-reserve-title"><ShieldCheck size={18} aria-hidden="true" />{c.reserve}</h2>
            <strong>{formatSum(reserved, locale)}</strong>
            <p>{c.reserveText}</p>
            <Link href="/orders" className="cabinet-link">{c.orders}<ArrowRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>
        <section className="cabinet-card wallet-history" aria-labelledby="wallet-history-title">
          <div className="cabinet-card-head"><h2 id="wallet-history-title">{c.history}</h2>{entries.length > 0 && <span className="cabinet-muted">{c.operations(entries.length)}</span>}</div>
          {!entries.length ? <div className="wallet-empty"><b>{c.emptyTitle}</b><p>{c.emptyText}</p></div> : <ul className="wallet-entries">{entries.map(entry => {
            const positive = entry.credit === "customer-credit";
            return <li key={entry.id}>
              <span className={"wallet-entry-icon" + (positive ? " credit" : "")} aria-hidden="true">{positive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
              <div><b>{localizeLegacyStoredCopy(entry.description, locale)}</b><small>{formatDateTime(entry.at, locale)}{entry.orderId && <> · <Link href={"/orders#" + entry.orderId}>{c.order} {entry.orderId}</Link></>}</small></div>
              <strong className={positive ? "credit" : ""}>{positive ? "+" : "−"}{formatSum(entry.amount, locale)}</strong>
            </li>;
          })}</ul>}
        </section>
        <p className="wallet-notice"><Info size={16} aria-hidden="true" />{c.notice}</p>
      </>}
      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title={c.withdrawTitle} description={c.withdrawText} locale={locale}>
        <button type="button" className="btn primary full" onClick={() => setWithdrawOpen(false)}>{c.close}</button>
      </Modal>
    </div>
  );
}
