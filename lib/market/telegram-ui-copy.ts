import type { Locale } from './i18n.ts';
import { withCyrillic } from './uz-cyrl.ts';

// The site's words for Telegram order notices (the bot's own words are in telegram-notices.ts).
// "No ads" is deliberately not promised (owner, 14.10.2026): only "only about your orders".

export type TelegramUiCopy = {
  title: string; lead: string; switchLabel: string; hint: string; quiet: string; checking: string;
  onTo: (name: string) => string; onToBot: (bot: string) => string; onSince: (date: string) => string;
  statusOn: string; statusOff: string; statusPending: string;
  toastOn: string; toastOff: string;
  pendingTitle: string; pendingText: (bot: string) => string; openTg: string; recheck: string; cancel: string;
  linkFailed: string; retry: string;
  notLinked: string; connect: string; connectTitle: string; connectHint: string;
  offBotStop: string; offBlocked: string; offUnlinked: string; changed: string;
  unlinkWarn: string;
  nudge: string; nudgeOn: string; nudgeLater: string;
  bellLink: string; rowOn: string; rowOff: string; setUp: string;
  operatorOn: string; operatorOff: string;
};

export const telegramUiCopy: Record<Locale, TelegramUiCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    title: 'Уведомления в Telegram',
    lead: 'Бот Atlas напишет, когда по заказу будут новости: статус, вес посылки, трек-номер — и когда нужна доплата или ваше решение. Только о ваших заказах и обращениях в поддержку. Всё остаётся и в уведомлениях на сайте.',
    switchLabel: 'Получать в Telegram',
    hint: 'После включения бот пришлёт сообщение «Уведомления Atlas включены». Выключить — здесь или командой /stop в боте.',
    quiet: 'Ночью (22:00–8:00 по Ташкенту) сообщения приходят без звука.',
    checking: 'Проверяем связь с ботом…',
    onTo: name => `Сообщения приходят в Telegram: ${name}`,
    onToBot: bot => `Сообщения приходят от бота @${bot}`,
    onSince: date => `Включено ${date}`,
    statusOn: 'Включено', statusOff: 'Выключено', statusPending: 'Ждём Start',
    toastOn: 'Уведомления в Telegram включены',
    toastOff: 'Уведомления в Telegram выключены',
    pendingTitle: 'Остался один шаг',
    pendingText: bot => `Telegram не разрешает ботам писать первыми. Откройте бота @${bot}, нажмите «Start» внизу чата — уведомления включатся сами.`,
    openTg: 'Открыть Telegram', recheck: 'Проверить снова', cancel: 'Отменить',
    linkFailed: 'Не удалось проверить Telegram в кабинете. Повторите попытку.', retry: 'Повторить',
    notLinked: 'Подключите Telegram, чтобы бот мог вам писать. Он также станет способом входа в этот кабинет.',
    connect: 'Подключить Telegram',
    connectTitle: 'Подключить Telegram',
    connectHint: 'Подтвердите в Telegram, что это вы. После этого уведомления включатся.',
    offBotStop: 'Выключено командой /stop в боте.',
    offBlocked: 'Выключено: сообщение не дошло — возможно, бот заблокирован в Telegram. Разблокируйте его и включите снова.',
    offUnlinked: 'Выключено: Telegram отвязан от кабинета.',
    changed: 'Telegram в кабинете сменился — включите уведомления заново.',
    unlinkWarn: 'Уведомления в Telegram тоже выключатся.',
    nudge: 'Сообщим в Telegram, когда по заказу будут новости или понадобится ваш ответ.',
    nudgeOn: 'Включить', nudgeLater: 'Не сейчас',
    bellLink: 'Получать в Telegram',
    rowOn: 'Telegram: включено', rowOff: 'Telegram: выключено', setUp: 'Настроить',
    operatorOn: 'Покупатель включил Telegram — текст может уйти и туда, как написан.',
    operatorOff: 'Только на сайте: Telegram у покупателя выключен, email и SMS не отправляются.',
  },
  uz: {
    title: 'Telegram orqali bildirishnomalar',
    lead: 'Buyurtmangiz bo‘yicha yangilik bo‘lsa, Atlas boti yozadi: holat, posilka vazni, kuzatuv raqami — qo‘shimcha to‘lov yoki qaroringiz kerak bo‘lganda ham. Faqat buyurtmalaringiz va yordamga murojaatlaringiz haqida. Hammasi saytdagi bildirishnomalarda ham qoladi.',
    switchLabel: 'Telegram orqali olish',
    hint: 'Yoqqaningizdan so‘ng bot «Atlas bildirishnomalari yoqildi» xabarini yuboradi. O‘chirish — shu yerda yoki botda /stop buyrug‘i bilan.',
    quiet: 'Kechasi (Toshkent vaqti bilan 22:00–8:00) xabarlar ovozsiz keladi.',
    checking: 'Bot bilan aloqani tekshiryapmiz…',
    onTo: name => `Xabarlar shu Telegramga keladi: ${name}`,
    onToBot: bot => `Xabarlar @${bot} botidan keladi`,
    onSince: date => `Yoqilgan sana: ${date}`,
    statusOn: 'Yoqilgan', statusOff: 'O‘chirilgan', statusPending: 'Start kutilmoqda',
    toastOn: 'Telegramdagi bildirishnomalar yoqildi',
    toastOff: 'Telegramdagi bildirishnomalar o‘chirildi',
    pendingTitle: 'Bitta qadam qoldi',
    pendingText: bot => `Telegram botlarga birinchi bo‘lib yozishga ruxsat bermaydi. Botni oching (@${bot}) va chat pastidagi «Start» tugmasini bosing — bildirishnomalar o‘zi yoqiladi.`,
    openTg: 'Telegramni ochish', recheck: 'Qayta tekshirish', cancel: 'Bekor qilish',
    linkFailed: 'Kabinetdagi Telegramni tekshirib bo‘lmadi. Qayta urinib ko‘ring.', retry: 'Qayta urinish',
    notLinked: 'Bot sizga yoza olishi uchun Telegramni bog‘lang. U shu kabinetga kirish usuli ham bo‘ladi.',
    connect: 'Telegramni bog‘lash',
    connectTitle: 'Telegramni bog‘lash',
    connectHint: 'Telegramda bu siz ekaningizni tasdiqlang. Shundan so‘ng bildirishnomalar yoqiladi.',
    offBotStop: 'Botdagi /stop buyrug‘i bilan o‘chirilgan.',
    offBlocked: 'O‘chirildi: xabar yetib bormadi — ehtimol, bot Telegramda bloklangan. Uni blokdan chiqaring va qayta yoqing.',
    offUnlinked: 'O‘chirildi: Telegram kabinetdan uzilgan.',
    changed: 'Kabinetdagi Telegram almashgan — bildirishnomalarni qayta yoqing.',
    unlinkWarn: 'Telegramdagi bildirishnomalar ham o‘chadi.',
    nudge: 'Buyurtma bo‘yicha yangilik bo‘lsa yoki javobingiz kerak bo‘lsa, Telegramda xabar beramiz.',
    nudgeOn: 'Yoqish', nudgeLater: 'Hozir emas',
    bellLink: 'Telegram orqali olish',
    rowOn: 'Telegram: yoqilgan', rowOff: 'Telegram: o‘chirilgan', setUp: 'Sozlash',
    operatorOn: 'Xaridor Telegramni yoqqan — matn u yerga ham yozilganidek borishi mumkin.',
    operatorOff: 'Faqat saytda: xaridorda Telegram o‘chirilgan, email va SMS yuborilmaydi.',
  },
  en: {
    title: 'Telegram notifications',
    lead: 'The Atlas bot messages you when there’s news on your order — status, parcel weight, tracking number — and when an extra payment or your decision is needed. Only about your orders and support requests. Everything stays in your notifications on the site too.',
    switchLabel: 'Get notifications in Telegram',
    hint: 'Once it’s on, the bot sends “Atlas notifications are on”. Turn it off here or with /stop in the bot.',
    quiet: 'At night (10 pm–8 am Tashkent time) messages arrive silently.',
    checking: 'Checking the connection with the bot…',
    onTo: name => `Messages go to Telegram: ${name}`,
    onToBot: bot => `Messages come from @${bot}`,
    onSince: date => `Turned on ${date}`,
    statusOn: 'On', statusOff: 'Off', statusPending: 'Waiting for Start',
    toastOn: 'Telegram notifications are on',
    toastOff: 'Telegram notifications turned off',
    pendingTitle: 'One step left',
    pendingText: bot => `Telegram doesn’t let bots write first. Open @${bot} and tap “Start” at the bottom of the chat — notifications turn on by themselves.`,
    openTg: 'Open Telegram', recheck: 'Check again', cancel: 'Cancel',
    linkFailed: 'Couldn’t check the Telegram on your account. Try again.', retry: 'Try again',
    notLinked: 'Connect Telegram so the bot can message you. It will also become a way to sign in to this account.',
    connect: 'Connect Telegram',
    connectTitle: 'Connect Telegram',
    connectHint: 'Confirm in Telegram that it’s you. Notifications turn on after that.',
    offBotStop: 'Turned off with /stop in the bot.',
    offBlocked: 'Turned off: a message didn’t get through — the bot may be blocked in Telegram. Unblock it and turn this on again.',
    offUnlinked: 'Turned off: Telegram was removed from your account.',
    changed: 'The Telegram on your account changed — turn notifications on again.',
    unlinkWarn: 'Telegram notifications will turn off too.',
    nudge: 'We’ll message you in Telegram when there’s news on your order or we need your answer.',
    nudgeOn: 'Turn on', nudgeLater: 'Not now',
    bellLink: 'Get notifications in Telegram',
    rowOn: 'Telegram: on', rowOff: 'Telegram: off', setUp: 'Set up',
    operatorOn: 'The customer turned Telegram on — the text may go there too, exactly as written.',
    operatorOff: 'Site only: the customer’s Telegram is off; email and SMS are not sent.',
  },
});
