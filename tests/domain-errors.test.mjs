import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { domainErrorEntries, translateDomainError } from '../lib/market/domain-errors.ts';
import { serverError } from '../lib/market/i18n.ts';

const cyrillic = /[А-Яа-яЁё]/;

/**
 * Refusals in lib/market/domain.ts that only staff can meet: the service catalog editor, warehouse intake and
 * weighing, operator notes and notifications, change requests, extra-charge invoices, claim decisions and status
 * moves. The operator workspace is in Russian, so these stay untranslated. A new customer-facing `throw Error("…")`
 * must go into lib/market/domain-errors.ts instead of this list.
 */
const operatorOnly = new Set([
  // validateServiceCatalog (admin pricing).
  'Идентификаторы услуг должны быть уникальными.',
  'Обязательная услуга должна предлагаться при оформлении и иметь фиксированный тариф или процент.',
  'Процент от стоимости считается только для посылки при оформлении.',
  'Для услуги с процентом от стоимости задайте процент больше нуля.',
  'Для активной услуги с фиксированной ценой задайте положительный базовый тариф.',
  'У активной услуги все заданные тарифы по странам должны быть больше нуля.',
  // settle: weighing at the warehouse ("receive") and the client-side calculator, never a customer API refusal.
  'Введите вес до 500 кг и размеры до 300 см. Все значения должны быть больше нуля.',
  // completeWarehouseService / declineWarehouseService.
  'Услуги можно отметить только после приёмки и до взвешивания.',
  'Сначала получите согласие покупателя на услугу.',
  'Запрос можно отклонить после приёмки товара и до взвешивания.',
  'Сначала обработайте ожидающее согласование услуги.',
  'Укажите причину недоступности услуги.',
  // assignOrder, addStaffNote, sendCustomerNotification.
  'Отменённый заказ нельзя назначить.',
  'Введите заметку до 500 символов.',
  'Заголовок уведомления должен содержать от 2 до 120 символов.',
  'Текст уведомления должен содержать от 1 до 300 символов.',
  // createChangeRequest.
  'Изменения для этого заказа недоступны.',
  'Сначала дождитесь ответа на текущий запрос.',
  'Решение проблемы требует явной замены товара и указания нового варианта.',
  'Запрос на эту складскую услугу уже обработан или не найден.',
  'Стоимость складской услуги можно предложить после приёмки товара.',
  'Стоимость услуги не может быть отрицательной.',
  'Сумма не совпадает с зафиксированным тарифом услуги.',
  // inspectWarehouseOrder, setParcel, confirmStoreShipping, confirmCustomsDuty.
  'Приёмка доступна только для заказа на зарубежном складе.',
  'При полном соответствии количество должно совпадать с заказом.',
  'Сначала подтвердите выкуп заказа.',
  'Подтверждение доставки для этого заказа недоступно.',
  'Укажите фактическую доставку магазина в USD.',
  'Atlas не оплачивает таможню по этому заказу.',
  'Укажите начисленную пошлину в USD.',
  // requestExtraCharge, cancelExtraCharge.
  'Доплату можно выставить только по оплаченному активному заказу.',
  'По заказу уже ждёт доплата. Отмените её или дождитесь оплаты.',
  'По заказу слишком много счетов на доплату.',
  'Укажите сумму доплаты в USD.',
  'Укажите причину доплаты.',
  'Этот счёт уже оплачен.',
  // decideParcelClaim.
  'Претензия не найдена.',
  'Претензия уже рассмотрена.',
  'Укажите причину отказа для покупателя.',
  'Укажите сумму возмещения.',
  'Возмещение по условиям — не больше ${money(claim.limit)}.',
  // advanceOrder, assertReadyToWeigh, receiveOrder.
  'Статус уже изменился. Проверьте заказ.',
  'Этот переход пока недоступен.',
  'Сначала сохраните взвешивание.',
  'Заказ ещё не готов к взвешиванию.',
  'Сначала завершите приёмку и проверку товара на складе.',
  'Сначала завершите или отклоните выбранные складские услуги.',
  'Сначала согласуйте с покупателем решение по проблеме на складе.',
  'Без взвешивания можно оставить только заказ этой посылки, который ещё не пришёл на склад или ждёт решения.',
  'Заказ ${order.id}: ${(error as Error).message}',
]);

/** Every string literal with Cyrillic text inside `throw Error(…)` / `throw new Error(…)` in a source file. */
function thrownMessages(source) {
  const found = [];
  const start = /throw\s+(?:new\s+)?Error\(/g;
  for (let match = start.exec(source); match; match = start.exec(source)) {
    let depth = 1, i = start.lastIndex;
    const literals = [];
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
        literals.push(source.slice(i + 1, j));
        i = j + 1;
        continue;
      }
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      i++;
    }
    found.push(...literals.filter((text) => cyrillic.test(text)));
  }
  return found;
}

/** A template literal as the message it produces, with a sample value for each `${…}`. */
const sample = (literal) => literal.replace(/\$\{[^}]*\}/g, '7');

test('every entry has Uzbek and English text, without Russian left in it', () => {
  assert.ok(domainErrorEntries.length >= 60, `${domainErrorEntries.length} entries`);
  for (const entry of domainErrorEntries) {
    const name = String(entry.ru);
    for (const locale of ['uz', 'en']) {
      assert.equal(typeof entry[locale], 'string', `${locale}: ${name}`);
      assert.ok(entry[locale].trim().length > 10, `${locale}: ${name}`);
      assert.doesNotMatch(entry[locale], cyrillic, `${locale} has no Cyrillic: ${name}`);
      assert.match(entry[locale], /[.!?]$/, `${locale} is a sentence: ${name}`);
    }
    if (typeof entry.ru === 'string') {
      for (const locale of ['uz', 'oz', 'en']) {
        const text = translateDomainError(entry.ru, locale);
        assert.equal(typeof text, 'string', `${locale}: ${name}`);
        assert.doesNotMatch(text, /[]|\{\d\}/, `${locale} has no markers: ${name}`);
      }
      assert.match(translateDomainError(entry.ru, 'oz'), cyrillic, `oz is Cyrillic: ${name}`);
    }
  }
});

test('Russian and unknown messages are not translated', () => {
  assert.equal(translateDomainError('Корзина пуста.', 'ru'), undefined);
  assert.equal(translateDomainError('Совсем другая ошибка.', 'en'), undefined);
  assert.equal(translateDomainError('err_10', 'uz'), undefined);
});

test('pattern entries put the numbers and names from the message into the translation', () => {
  assert.equal(translateDomainError('В магазине осталось 3 шт. этого варианта.', 'en'), 'The store has only 3 of this option left. Lower the quantity.');
  assert.equal(translateDomainError('В магазине осталось 3 шт. этого варианта.', 'uz'), 'Do‘konda bu variantdan atigi 3 dona qoldi. Miqdorni kamaytiring.');
  const named = 'В магазине осталось 2 шт. «Nike Air Max 90». Уменьшите количество.';
  assert.equal(translateDomainError(named, 'en'), 'The store has only 2 of “Nike Air Max 90” left. Lower the quantity.');
  assert.match(translateDomainError(named, 'uz'), /«Nike Air Max 90» tovaridan atigi 2 dona/);
  // The product name stays as written in Uzbek Cyrillic; the sentence around it is transliterated.
  const oz = translateDomainError(named, 'oz');
  assert.ok(oz.includes('«Nike Air Max 90»'), oz);
  assert.match(oz, /Миқдорни камайтиринг/);
  assert.equal(translateDomainError('Цена изменилась: было 40 USD, сейчас 45.5 USD. Обновите товар.', 'en'), 'The price changed: it was 40 USD, now 45.5 USD. Update the item.');
  assert.equal(translateDomainError('Претензию принимаем в течение 14 дней после получения.', 'en'), 'Claims are accepted within 14 days of receiving the parcel. If that period has passed, contact support.');
  assert.equal(translateDomainError('Стоимость товаров в партии выше управляемого предела $2000.', 'en'), 'The goods in this batch are worth more than the $2000 limit. Leave some items for a later order.');
});

test('a link refusal keeps https:// in Latin letters in Uzbek Cyrillic', () => {
  for (const message of ['Введите полную ссылку, начиная с https://.', 'Нужна HTTPS-ссылка на страницу магазина.', 'Нужна публичная HTTPS-ссылка на страницу товара.']) {
    assert.ok(translateDomainError(message, 'oz').includes('https://'), message);
    assert.ok(translateDomainError(message, 'uz').includes('https://'), message);
  }
});

test('every customer-facing throw in lib/market/domain.ts is translated or listed as operator-only', () => {
  const source = readFileSync(new URL('../lib/market/domain.ts', import.meta.url), 'utf8');
  const messages = [...new Set(thrownMessages(source))];
  assert.ok(messages.length > 80, `found ${messages.length} thrown messages`);
  const missing = messages.filter((literal) => !operatorOnly.has(literal) && translateDomainError(sample(literal), 'en') === undefined);
  assert.deepEqual(missing, [], 'add these to lib/market/domain-errors.ts (or, if only staff see them, to operatorOnly)');
  // The list stays honest: an operator-only message that is gone from domain.ts, or that has a translation, is removed.
  for (const literal of operatorOnly) {
    assert.ok(messages.includes(literal), `still thrown in domain.ts: ${literal}`);
    assert.equal(translateDomainError(sample(literal), 'en'), undefined, `operator-only and translated: ${literal}`);
  }
});

test('the importer, cart-limit and action refusals customers meet are translated', () => {
  const files = ['lib/importer/fetch.ts', 'lib/importer/verify.ts', 'lib/importer/manual-fallback.ts', 'lib/importer/shopify.ts', 'lib/market/policy.ts', 'lib/market/actions.ts', 'lib/market/world.ts'];
  // Messages that never reach a customer as an error text: manual-entry fallbacks are answered with
  // importManualEntryMessage, the operator gate and order images are staff-only.
  const notShown = new Set(['Доступно только оператору.', 'Запросить дополнительную услугу может владелец заказа.', 'У заказа нет ссылки на источник.', 'Изображение недоступно.']);
  for (const file of files) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    // `throw new ManualEntryFallbackError(…)` is not matched: it is answered with importManualEntryMessage.
    for (const literal of thrownMessages(source)) {
      if (notShown.has(literal)) continue;
      assert.notEqual(translateDomainError(sample(literal), 'en'), undefined, `${file}: ${literal}`);
    }
  }
  // productRestriction returns its text; assertCartPolicy and cart-add throw it.
  assert.ok(translateDomainError('Категория «Оружие» временно недоступна для оформления.', 'uz').includes('«Оружие»'));
  assert.ok(translateDomainError('Товар требует ручной проверки по ограничению «табак».', 'en').includes('“табак”'));
  // The removed-product refusal from lib/importer/fetch.ts.
  assert.equal(translateDomainError('Магазин убрал карточку товара. Укажите другую ссылку.', 'en'), 'The store removed this product page. Paste another link.');
});

test('the reworded error codes say what to do', () => {
  assert.match(serverError('ru', 'err_10'), /обновите страницу/);
  assert.match(serverError('en', 'err_10'), /refresh the page/);
  assert.match(serverError('uz', 'err_10'), /sahifani yangilab/);
  assert.match(serverError('en', 'err_17'), /Refresh the page/);
  assert.match(serverError('en', 'err_70'), /another color or size/);
  assert.match(serverError('uz', 'err_71'), /Boshqa rang yoki o‘lchamni tanlang/);
  assert.match(serverError('oz', 'err_71'), /Бошқа ранг/);
});
