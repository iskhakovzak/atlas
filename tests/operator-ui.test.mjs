import test from 'node:test';
import assert from 'node:assert/strict';
import {agoLocalized} from '../lib/market/relative-time.ts';
import {formatStorePrice} from '../lib/market/store-price.ts';

const minute = 60000, hour = 60 * minute, day = 24 * hour;

test('agoLocalized speaks the screen language: minutes, hours, then days', () => {
  const now = 10 * day;
  assert.equal(agoLocalized(now - 30 * 1000, 'ru', now), 'только что');
  assert.equal(agoLocalized(now + 5 * minute, 'en', now), 'just now');
  assert.equal(agoLocalized(now - 5 * minute, 'ru', now), '5 мин назад');
  assert.equal(agoLocalized(now - 5 * minute, 'uz', now), '5 daqiqa oldin');
  assert.equal(agoLocalized(now - 3 * hour, 'en', now), '3 h ago');
  assert.equal(agoLocalized(now - 3 * hour, 'uz', now), '3 soat oldin');
  assert.equal(agoLocalized(now - 4 * day, 'ru', now), '4 дн. назад');
  assert.equal(agoLocalized(now - 4 * day, 'en', now), '4 d ago');
  // Uzbek Cyrillic is the Latin copy transliterated; the number stays as is.
  assert.equal(agoLocalized(now - 4 * day, 'oz', now), '4 кун олдин');
});

test('formatStorePrice shows the store currency in the screen locale and never throws on an odd code', () => {
  assert.equal(formatStorePrice(49.9, 'USD', 'en'), '$49.90');
  assert.match(formatStorePrice(49.9, 'EUR', 'ru'), /^49,90\s€$/);
  assert.match(formatStorePrice(120, 'RON', 'uz'), /120/);
  assert.equal(formatStorePrice(12, 'not-a-code', 'ru'), '12 not-a-code');
});
