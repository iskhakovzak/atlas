import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navCopy, routeTitle, locales } from '../lib/market/i18n.ts';
import { signInPath } from '../lib/market/access.ts';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the bottom bar and header name "order by link" in every language', () => {
  for (const locale of locales) {
    const short = navCopy[locale].byLink;
    assert.ok(short && short.length <= 12, `${locale}: short bottom-bar label`);
    assert.ok(routeTitle(locale, 'link') && routeTitle(locale, 'link') !== 'link', `${locale}: page title for the header and footer`);
  }
  assert.match(navCopy.oz.byLink, /^[Ѐ-ӿ\s‘’ʼ'-]+$/, 'oz is written in Cyrillic');
  assert.equal(navCopy.uz.byLink, 'Havola');
});

test('a guest signs in and comes back to the page they were on', () => {
  assert.equal(signInPath('/catalog'), '/login?return_to=%2Fcatalog');
  assert.equal(signInPath('/order-by-link'), '/login?return_to=%2Forder-by-link');
});

test('one bottom bar for guests and members; tablet header hides links by name, not by position', () => {
  const access = source('app/access.css');
  const mobile = source('app/mobile.css');
  assert.doesNotMatch(access, /\.mobile-nav\.guest\s*\{/);
  assert.doesNotMatch(mobile, /\.mobile-nav\.guest\s*\{/);
  assert.doesNotMatch(access, /\.desktop-nav a:nth-child/);
  assert.match(access, /\.desktop-nav a:is\(\[data-nav="how"\],\[data-nav="tariffs"\]\)\{display:none\}/);
  const shell = source('app/marketplace.tsx');
  assert.match(shell, /\['\/order-by-link','link',Link2,hc\.nav\.byLink\]/, 'guest bottom bar links to order by link');
  assert.match(shell, /data-nav=\{key\}/);
});

test('saved items (the heart) stay in the tablet header except where the member menu would scroll', () => {
  const access = source('app/access.css');
  assert.doesNotMatch(access, /min-width:601px\)\{[^}]*favorites/, 'not hidden across the whole 601-900px range');
  assert.match(access, /@media\(min-width:761px\) and \(max-width:884px\)\{\.header-actions>a\[href="\/favorites"\]\{display:none\}\}/);
});

test('an empty header cart is outlined, a cart with items keeps the filled button and the counter', () => {
  const shell = source('app/marketplace.tsx');
  assert.match(shell, /'cart-link'\+\(known&&shownCount===0\?' is-empty':''\)/);
  assert.match(shell, /\{known&&shownCount>0&&<b>\{shownCount\}<\/b>\}/);
  const css = source('app/header-panel.css');
  assert.match(css, /\.cart-link\.is-empty \{/);
});

test('a positive balance puts a still mint dot on the wallet; its name keeps the amount', () => {
  const shell = source('app/marketplace.tsx');
  assert.match(shell, /className=\{'wallet-link'\+\(known&&shownBalance>0\?' has-balance':''\)\} aria-label=\{walletLabel\}/);
  const css = source('app/header-panel.css');
  const dot = css.match(/\.site-header \.wallet-link\.has-balance::before \{([^}]*)\}/)?.[1];
  assert.ok(dot, 'the dot rule exists');
  assert.match(dot, /width: 8px; height: 8px; border: 2px solid var\(--day-surface/);
  assert.doesNotMatch(dot, /animation|transition/);
  assert.match(css, /html\[data-theme="dark"\] \.site-header \.wallet-link\.has-balance::before \{ border-color: var\(--night-canvas/);
  // ::after is the wallet's tap frame on touch screens.
  assert.match(source('app/mobile.css'), /\.site-header \.wallet-link::after \{ content: ""/);
  assert.doesNotMatch(css, /wallet-link\.has-balance::after/);
});

test('the signed-in header fits at 761–960px: the cart is its icon at 901–960px, as below 900px', () => {
  const css = source('app/header-panel.css');
  assert.match(css, /@media \(min-width: 901px\) and \(max-width: 960px\) \{\r?\n  \.site-header:has\(\.header-account\.member\) \.cart-link \.desktop-only \{ display: none; \}/);
  assert.match(source('app/access.css'), /@media\(max-width:900px\) and \(min-width:601px\)\{[^}]*\}[^@]*\.cart-link \.desktop-only\{display:none\}/);
  assert.match(source('app/marketplace.tsx'), /aria-label=\{modalWords\.cart\+\(known\?shownCount:''\)\}/, 'the cart keeps its name for screen readers');
});

test('the sign-in tab on /login keeps the page the guest came from', () => {
  assert.match(source('app/marketplace.tsx'), /\[signInPath\(signInReturn\(here\)\),'login',LogIn,hc\.nav\.signin\]/);
});

test('the notification sheet titles are not in capitals; the UI audit expects the guest bottom bar', () => {
  const rule = source('app/notice-panel.css').match(/\.notice-panel h3 \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /text-transform: none/);
  assert.doesNotMatch(rule, /uppercase/);
  const audit = source('scripts/audit-ui.mjs');
  assert.doesNotMatch(audit, /!document\.querySelector\('\.mobile-nav'\)/);
  assert.match(audit, /guest mobile has the guest bottom navigation/);
});
