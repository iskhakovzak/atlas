import test from 'node:test';
import assert from 'node:assert/strict';
import {securityContacts, securityTxt} from '../lib/seo/security-txt.ts';
import {routeHarness} from './support/route-harness.mjs';

const none = {supportEmail: null, telegramSupport: null, phone: null};
const now = Date.UTC(2026, 10, 3, 15, 30);

test('security.txt names the configured contacts in order and expires a year ahead', () => {
  const text = securityTxt({origin: 'https://atlasmarket.uz', contacts: {supportEmail: 'help@atlasmarket.uz', telegramSupport: '@atlas_help_bot', phone: '+998 90 123 45 67'}, now});
  assert.deepEqual(text.split('\n').filter((line) => line.startsWith('Contact:')), [
    'Contact: mailto:help@atlasmarket.uz', 'Contact: https://t.me/atlas_help_bot', 'Contact: tel:+998901234567',
  ]);
  assert.match(text, /^Expires: 2027-11-03T00:00:00Z$/m);
  assert.match(text, /^Preferred-Languages: ru, uz, en$/m);
  assert.match(text, /^Canonical: https:\/\/atlasmarket\.uz\/\.well-known\/security\.txt$/m);
  assert.doesNotMatch(text, /Placeholder/);
  const expires = Date.parse(/^Expires: (.+)$/m.exec(text)[1]);
  assert.ok(expires > now && expires - now < 366 * 24 * 60 * 60 * 1000);
});

test('without contacts the support page stands in, marked as a placeholder; junk values are skipped', () => {
  const text = securityTxt({origin: 'https://atlasmarket.uz', contacts: none, now});
  assert.match(text, /^# Placeholder: .*\nContact: https:\/\/atlasmarket\.uz\/support$/m);
  assert.deepEqual(securityContacts({supportEmail: 'not an email', telegramSupport: 'x y', phone: '12'}), []);
});

test('the route reads the contacts from the site content row', async () => {
  const h = routeHarness();
  const {GET} = await h.route('app/.well-known/security.txt/route.ts');
  let response = await h.call(GET, {url: '/.well-known/security.txt'});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain; charset=utf-8/);
  assert.match(await response.text(), /Contact: http:\/\/localhost\/support/);
  h.db.sqlite.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('site-content',?,?,?)")
    .run(JSON.stringify({contacts: {supportEmail: 'help@atlasmarket.uz'}}), Date.now(), 'owner@atlas.test');
  response = await h.call(GET, {url: '/.well-known/security.txt'});
  const text = await response.text();
  assert.match(text, /^Contact: mailto:help@atlasmarket\.uz$/m);
  assert.doesNotMatch(text, /Placeholder/);
});
