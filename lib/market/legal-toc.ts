// Contents for the standalone /terms and /privacy pages (14.10.2026): one anchor per <section id> of the document in
// app/legal-documents.tsx, labelled exactly like its <h3>. The governing text is Russian, so the labels are too
// (rendered with lang="ru" in uz/en); tests/legal-toc.test.mjs checks every entry against the document.

export type LegalTocEntry = { id: string; title: string };

export const offerToc: readonly LegalTocEntry[] = [
  { id: "offer-parties", title: "1. Стороны и предмет" },
  { id: "offer-contract", title: "2. Заключение договора" },
  { id: "offer-services", title: "3. Что делает Atlas" },
  { id: "offer-fees", title: "4. Цена услуги и доход Atlas" },
  { id: "offer-sellers", title: "5. Продавцы, наличие и оригинальность" },
  { id: "offer-delivery", title: "6. Доставка и сроки" },
  { id: "offer-insurance", title: "6.1. Гарантия сохранности Atlas и возмещение" },
  { id: "offer-customs", title: "7. Таможня и обязанности клиента" },
  { id: "offer-limits", title: "8. Ограничения" },
  { id: "offer-cancel", title: "9. Отмена, возврат и претензии" },
  { id: "offer-liability", title: "10. Ограничение ответственности" },
  { id: "apps-terms", title: "11. Условия использования приложений Atlas" },
  { id: "offer-requisites", title: "12. Реквизиты оператора" },
];

/** The payment and refund policy, the second document on /terms (after the offer). */
export const refundsToc: readonly LegalTocEntry[] = [
  { id: "refunds-methods", title: "Способы оплаты" },
  { id: "refunds-return", title: "Возврат" },
];

export const privacyToc: readonly LegalTocEntry[] = [
  { id: "privacy-data", title: "Какие данные обрабатываются" },
  { id: "privacy-purpose", title: "Для чего они нужны" },
  { id: "privacy-recipients", title: "Кому данные могут передаваться" },
  { id: "privacy-impact", title: "Партнёрские ссылки Impact на сайте" },
  { id: "privacy-storage", title: "Хранение и права клиента" },
  { id: "privacy-security", title: "Безопасность" },
  { id: "privacy-apps", title: "Мобильные приложения Atlas для iOS и Android" },
  { id: "privacy-ai", title: "Автоматическое распознавание и искусственный интеллект" },
  { id: "privacy-signin", title: "Вход через Apple, Google и Telegram; уведомления в Telegram" },
  { id: "privacy-delete", title: "Удаление аккаунта" },
  { id: "privacy-consent", title: "Согласие и его отзыв" },
  { id: "privacy-age", title: "Возраст" },
];

/** Ids that appear more than once across the given contents (a duplicate would open the wrong section). */
export function duplicateTocIds(...lists: readonly (readonly LegalTocEntry[])[]): string[] {
  const seen = new Set<string>(), dup = new Set<string>();
  for (const list of lists) for (const { id } of list) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}
