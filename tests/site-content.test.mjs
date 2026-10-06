import test from 'node:test';
import assert from 'node:assert/strict';
import { siteContent, paymentLabels } from '../lib/market/site-content.ts';
import {
  siteContentDocumentSchema, mergeSiteContent, parseStoredSiteContent, emptySiteContentDocument,
  siteContentToDocument, siteContentIssues, isHttpsUrl, isPublicImagePath, normalizePhone, siteContentTextMax,
} from '../lib/market/site-content-schema.ts';

const filled = {
  revision: 3,
  contacts: { telegramSupport: 'atlas_support', telegramChannel: 'atlas_uz', phone: '+998 90 123-45-67', instagram: 'atlas.uz', supportEmail: 'support@atlasmarket.uz', pickupAddress: { ru: 'Ташкент, ул. Амира Темура, 1', uz: 'Toshkent, Amir Temur ko‘chasi, 1', en: 'Tashkent, Amir Temur St, 1' } },
  legal: { entityName: 'ООО «Atlas»', inn: '123456789', address: { ru: 'Ташкент', uz: 'Toshkent', en: 'Tashkent' } },
  paymentMethods: ['click', 'payme', 'click'],
  reviews: [{ name: 'Дильноза', city: 'Самарканд', text: { ru: 'Всё пришло', uz: 'Hammasi keldi', en: 'Everything arrived' }, consent: true }],
  parcelPhotos: [{ src: '/parcels/2026-10-01.jpg', alt: { ru: 'Посылка', uz: 'Posilka', en: 'Parcel' } }],
  completedOrders: 12,
  prohibitedListUrl: 'https://customs.uz/prohibited',
};

test('an empty or missing document parses to revision 0 and merges into the code defaults (blocks stay hidden)', () => {
  const empty = emptySiteContentDocument();
  assert.equal(empty.revision, 0);
  assert.deepEqual(empty.paymentMethods, []);
  assert.deepEqual(empty.reviews, []);
  assert.equal(empty.completedOrders, null);
  assert.deepEqual(parseStoredSiteContent(undefined), empty);
  assert.deepEqual(parseStoredSiteContent('not json'), empty);
  assert.deepEqual(parseStoredSiteContent('{"contacts":{"phone":"12"}}'), empty, 'an invalid stored document never breaks the first render');
  const view = mergeSiteContent(empty);
  assert.equal(view.revision, 0);
  assert.deepEqual({ ...view, revision: undefined }, { ...siteContent, revision: undefined }, 'the merged view equals the code defaults');
  assert.deepEqual(mergeSiteContent(null).contacts, siteContent.contacts);
  assert.deepEqual(mergeSiteContent(parseStoredSiteContent('{}')).deliveryDays, siteContent.deliveryDays, 'delivery tables always come from the code / tariff');
});

test('a filled document is normalized: phone without spaces, unique payment methods, consent kept', () => {
  const document = siteContentDocumentSchema.parse(filled);
  assert.equal(document.contacts.phone, '+998901234567');
  assert.deepEqual(document.paymentMethods, ['click', 'payme']);
  assert.equal(document.reviews[0].consent, true);
  assert.equal(document.revision, 3);
  const view = mergeSiteContent(document);
  assert.equal(view.contacts.telegramSupport, 'atlas_support');
  assert.equal(view.legal.inn, '123456789');
  assert.equal(view.completedOrders, 12);
  assert.equal(view.prohibitedListUrl, 'https://customs.uz/prohibited');
  assert.equal(view.reviews[0].city, 'Самарканд');
  for (const method of view.paymentMethods) assert.ok(paymentLabels[method]);
  // The view round-trips into a document the admin form can submit again.
  const back = siteContentToDocument(view);
  assert.deepEqual(back.contacts, document.contacts);
  assert.deepEqual(back.reviews, document.reviews);
  assert.equal(back.revision, 3);
});

test('whitespace-only values become null and a partly translated block is refused', () => {
  const document = siteContentDocumentSchema.parse({ contacts: { phone: '  ', telegramSupport: '', pickupAddress: { ru: ' ', uz: '', en: '' } }, legal: { entityName: '', inn: null } });
  assert.equal(document.contacts.phone, null);
  assert.equal(document.contacts.telegramSupport, null);
  assert.equal(document.contacts.pickupAddress, null);
  assert.equal(document.legal.entityName, null);
  const partial = siteContentDocumentSchema.safeParse({ contacts: { pickupAddress: { ru: 'Ташкент', uz: '', en: '' } } });
  assert.equal(partial.success, false);
  assert.match(siteContentIssues(partial.error).join('\n'), /contacts\.pickupAddress: .*трёх языках/);
});

test('validation: phone is +998 and 9 digits, URLs are https only, photos are paths under public/, texts up to 500 characters', () => {
  const refuse = (input, pattern) => { const result = siteContentDocumentSchema.safeParse(input); assert.equal(result.success, false, JSON.stringify(input)); assert.match(siteContentIssues(result.error).join('\n'), pattern); };
  refuse({ contacts: { phone: '+99890123456' } }, /\+998 и 9 цифр/);
  refuse({ contacts: { phone: '+7 900 123 45 67' } }, /\+998 и 9 цифр/);
  refuse({ contacts: { telegramSupport: '@atlas' } }, /без @/);
  refuse({ legal: { inn: '12345' } }, /ИНН: 9 цифр/);
  refuse({ prohibitedListUrl: 'http://customs.uz/list' }, /только https/);
  refuse({ prohibitedListUrl: 'javascript:alert(1)' }, /только https/);
  refuse({ parcelPhotos: [{ src: 'https://cdn.example.com/a.jpg', alt: { ru: 'а', uz: 'a', en: 'a' } }] }, /public\//);
  refuse({ parcelPhotos: [{ src: '/../secrets/a.jpg', alt: { ru: 'а', uz: 'a', en: 'a' } }] }, /public\//);
  refuse({ parcelPhotos: [{ src: '/parcels/a.svg', alt: { ru: 'а', uz: 'a', en: 'a' } }] }, /public\//);
  refuse({ paymentMethods: ['cash'] }, /способ оплаты/);
  refuse({ completedOrders: -1 }, /completedOrders/);
  refuse({ completedOrders: 1.5 }, /completedOrders/);
  refuse({ contacts: { pickupAddress: { ru: 'x'.repeat(siteContentTextMax + 1), uz: 'y', en: 'z' } } }, /pickupAddress\.ru/);
  assert.ok(siteContentDocumentSchema.safeParse({ contacts: { pickupAddress: { ru: 'x'.repeat(siteContentTextMax), uz: 'y', en: 'z' } } }).success);
  assert.ok(isHttpsUrl('https://customs.uz/x') && !isHttpsUrl('http://customs.uz') && !isHttpsUrl('customs.uz') && !isHttpsUrl('https://'));
  assert.ok(isPublicImagePath('/parcels/2026-10.webp') && !isPublicImagePath('parcels/a.jpg') && !isPublicImagePath('//evil/a.jpg') && !isPublicImagePath('/a.jpg?x=1'));
  assert.equal(normalizePhone('+998 (90) 123-45-67'), '+998901234567');
});

test('a review is saved only with the customer’s consent and a name', () => {
  const noConsent = siteContentDocumentSchema.safeParse({ reviews: [{ name: 'Али', text: { ru: 'ок', uz: 'ok', en: 'ok' }, consent: false }] });
  assert.equal(noConsent.success, false);
  assert.match(siteContentIssues(noConsent.error).join('\n'), /reviews\.0\.consent: .*согласия/);
  const missing = siteContentDocumentSchema.safeParse({ reviews: [{ name: 'Али', text: { ru: 'ок', uz: 'ok', en: 'ok' } }] });
  assert.equal(missing.success, false);
  const noName = siteContentDocumentSchema.safeParse({ reviews: [{ name: ' ', text: { ru: 'ок', uz: 'ok', en: 'ok' }, consent: true }] });
  assert.equal(noName.success, false);
  assert.match(siteContentIssues(noName.error).join('\n'), /имя клиента/);
});

test('unknown fields from a newer document are ignored and the rest still parses', () => {
  const document = siteContentDocumentSchema.parse({ ...filled, futureBlock: { x: 1 }, contacts: { ...filled.contacts, whatsapp: '+998' } });
  assert.equal(document.contacts.phone, '+998901234567');
  assert.ok(!('futureBlock' in document));
});
