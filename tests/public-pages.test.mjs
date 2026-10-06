import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { siteContent } from '../lib/market/site-content.ts';
import { routeTitle } from '../lib/market/i18n.ts';

// The pages the app stores require: privacy policy, terms, support, app landing and deletion instructions.
const pages = ['/privacy', '/terms', '/support', '/app', '/delete-account'];

test('sitemap lists every store-required page with its three ?lang versions and an x-default', async () => {
  const xml = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  for (const path of pages) {
    assert.match(xml, new RegExp(`<loc>https://atlasmarket.uz${path}</loc>`), path);
    for (const lang of ['uz', 'ru', 'en']) {
      assert.match(xml, new RegExp(`<loc>https://atlasmarket.uz${path}\\?lang=${lang}</loc>`), `${path} ${lang}`);
      assert.match(xml, new RegExp(`hreflang="${lang}" href="https://atlasmarket.uz${path}\\?lang=${lang}"`));
    }
    assert.match(xml, new RegExp(`hreflang="x-default" href="https://atlasmarket.uz${path}"`));
  }
});

test('robots allows the public pages for every agent and keeps /api/ and /auth/ blocked', async () => {
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  const agents = robots.split(/\n(?=User-agent:)/).filter((block) => block.startsWith('User-agent:'));
  assert.equal(agents.length, 3);
  for (const block of agents) {
    for (const path of pages) assert.match(block, new RegExp(`^Allow: ${path.replace('-', '\\-')}$`, 'm'), path);
    assert.match(block, /^Disallow: \/api\/$/m);
    assert.match(block, /^Disallow: \/auth\/$/m);
    assert.match(block, /^Disallow: \/account$/m);
  }
});

test('store links and the support mailbox stay null until the owner fills them', () => {
  assert.deepEqual(siteContent.apps, { appStoreUrl: null, playStoreUrl: null });
  assert.equal(siteContent.contacts.supportEmail, null);
});

test('route titles exist for the new public pages in all three locales without ASCII apostrophes', () => {
  for (const view of ['privacy', 'terms', 'support', 'app', 'delete-account']) {
    for (const locale of ['ru', 'uz', 'en']) {
      const title = routeTitle(locale, view);
      assert.notEqual(title, view, `${locale} ${view}`);
      if (locale === 'uz') assert.doesNotMatch(title, /o'|g'|O'|G'/);
    }
  }
});
