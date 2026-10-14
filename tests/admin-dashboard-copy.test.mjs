import test from 'node:test';
import assert from 'node:assert/strict';
import {attentionKindLabels} from '../lib/market/admin-dashboard.ts';
import {attentionDetail, attentionKindLabel, funnelStageLabel} from '../lib/market/admin-dashboard-copy.ts';

const day = 86_400_000;

test('attentionKindLabel keeps the server label in Russian and names every kind in Uzbek and English', () => {
  for (const kind of Object.keys(attentionKindLabels)) {
    assert.equal(attentionKindLabel(kind, 'ru'), attentionKindLabels[kind]);
    for (const locale of ['uz', 'en', 'oz']) {
      const label = attentionKindLabel(kind, locale);
      assert.ok(label && label !== attentionKindLabels[kind], `${kind} ${locale}`);
    }
  }
  assert.equal(attentionKindLabel('ticket-open', 'uz'), 'Ochiq murojaatlar');
  assert.equal(attentionKindLabel('ticket-open', 'oz'), 'Очиқ мурожаатлар');
  // The rate line never says "ЦБ" outside the Russian server text.
  assert.doesNotMatch(attentionKindLabel('fx-stale', 'uz') + attentionKindLabel('fx-stale', 'en'), /ЦБ|CBU|central bank/i);
});

test('funnelStageLabel translates by status and keeps the server label when the status is unknown', () => {
  assert.equal(funnelStageLabel({status: 0, label: 'Ожидает выкупа'}, 'uz'), 'Xarid kutilmoqda');
  assert.equal(funnelStageLabel({status: 5, label: 'Доставлен'}, 'en'), 'Delivered');
  assert.equal(funnelStageLabel({status: 5, label: 'Доставлен'}, 'ru'), 'Доставлен');
  assert.equal(funnelStageLabel({status: 'cancelled', label: 'Отменён'}, 'uz'), 'Bekor qilingan');
  assert.equal(funnelStageLabel({status: 'cancelled', label: 'Отменён'}, 'ru'), 'Отменён');
  assert.equal(funnelStageLabel({status: 9, label: 'Новый этап'}, 'en'), 'Новый этап');
});

test('attentionDetail rebuilds the day-count lines from kind and at, and keeps the rest as the server wrote them', () => {
  const now = 10 * day;
  const at = now - 3 * day - 5000;
  assert.equal(attentionDetail({kind: 'pending-payment', detail: 'Ожидает оплаты 3 дня', at}, 'ru', now), 'Ожидает оплаты 3 дня');
  assert.equal(attentionDetail({kind: 'pending-payment', detail: 'x', at}, 'uz', now), '3 kundan beri to‘lov kutilmoqda');
  assert.equal(attentionDetail({kind: 'pending-payment', detail: 'x', at}, 'en', now), 'Awaiting payment for 3 days');
  assert.equal(attentionDetail({kind: 'paid-not-bought', detail: 'x', at: now - day}, 'en', now), 'Marked paid 1 day ago, purchase not marked');
  assert.equal(attentionDetail({kind: 'ticket-open', detail: 'x', at}, 'uz', now), '3 kundan beri javobsiz');
  // Cyrillic Uzbek: the whole line, suffixes included.
  assert.equal(attentionDetail({kind: 'ticket-open', detail: 'x', at}, 'oz', now), '3 кундан бери жавобсиз');
  // The warehouse line needs the order's stage; without it the server text stays.
  assert.equal(attentionDetail({kind: 'warehouse-stale', detail: 'На зарубежном складе уже 3 дня', at}, 'en', now, 2), 'At overseas warehouse for 3 days');
  assert.equal(attentionDetail({kind: 'warehouse-stale', detail: 'На зарубежном складе уже 3 дня', at}, 'uz', now), 'На зарубежном складе уже 3 дня');
  // Lines carrying customer or store data are not rebuilt.
  assert.equal(attentionDetail({kind: 'cart-price-change', detail: '1 поз. в корзине: Nike 80 → 90 USD', at}, 'en', now), '1 поз. в корзине: Nike 80 → 90 USD');
  // A time slightly ahead of the browser clock never reads as negative days.
  assert.equal(attentionDetail({kind: 'ticket-open', detail: 'x', at: now + 60_000}, 'en', now), 'No reply for 0 days');
});
