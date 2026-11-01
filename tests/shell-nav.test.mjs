import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navCopy, routeTitle, locales } from '../lib/market/i18n.ts';
import { signInPath } from '../lib/market/access.ts';
import { headerSearchLink, headerSearchTarget } from '../lib/market/shell-search.ts';

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

test('every new shell word exists in every language, Uzbek Cyrillic included; the bottom-bar labels are short', () => {
  const keys = ['link', 'buyByLink', 'delivery', 'profile', 'profileMenu', 'search', 'searchPlaceholder', 'searchShort', 'balance', 'notifications', 'favorites', 'documents', 'theme', 'signOut', 'needsAction'];
  for (const locale of locales) for (const key of keys) assert.ok(navCopy[locale][key], `${locale}.${key}`);
  for (const locale of locales) {
    assert.ok(navCopy[locale].link.length <= 8, `${locale}: centre tab label`);
    assert.ok(navCopy[locale].profile.length <= 8, `${locale}: profile tab label`);
  }
  assert.match(navCopy.oz.profile, /^[Ѐ-ӿ]+$/, 'oz profile is Cyrillic');
  assert.match(navCopy.oz.searchPlaceholder, /^[Ѐ-ӿ\s‘’ʼ'-]+$/, 'oz search placeholder is Cyrillic');
});

test('a guest signs in and comes back to the page they were on', () => {
  assert.equal(signInPath('/catalog'), '/login?return_to=%2Fcatalog');
  assert.equal(signInPath('/order-by-link'), '/login?return_to=%2Forder-by-link');
});

test('one bottom bar for guests and members: Главная · Каталог · Ссылка · Корзина · Профиль', () => {
  const shell = source('app/marketplace.tsx');
  const tabs = shell.slice(shell.indexOf('const tabs:'), shell.indexOf('];', shell.indexOf('const tabs:')));
  const keys = [...tabs.matchAll(/key:'([a-z]+)'/g)].map(match => match[1]);
  assert.deepEqual(keys, ['catalog', 'products', 'link', 'cart', 'account', 'login'], 'home, catalog, link, cart, then the profile (member or guest)');
  assert.match(tabs, /\{href:'\/order-by-link',key:'link',Icon:Plus,label:nav\.link/, 'the centre button keeps a real link to the order page');
  assert.match(tabs, /\{href:cartHref,key:'cart'/, 'the cart tab is there for guests too');
  assert.doesNotMatch(tabs, /'\/stores'/, 'stores left the bottom bar');
  // The centre tab opens the paste-a-link sheet; a modifier click still opens the page.
  assert.match(shell, /onClick=\{centre\?openLinkSheet:undefined\}/);
  assert.match(shell, /if\(event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\|\|event\.altKey\|\|event\.button!==0\)return;/);
  assert.match(shell, /const loadLinkSheet=\(\)=>import\('\.\/link-sheet'\)/, 'the sheet is its own chunk');
  // The tab set does not depend on who is signed in, apart from the profile tab's address.
  assert.doesNotMatch(source('app/mobile.css'), /\.mobile-nav\.(guest|member)\s*\{/);
  assert.match(shell, /data-nav=\{key\}/);
});

test('the sign-in tab on /login keeps the page the guest came from', () => {
  const shell = source('app/marketplace.tsx');
  assert.match(shell, /\{href:signInPath\(signInReturn\(here\)\),key:'login',Icon:UserRound,label:nav\.profile,active:view==='login'&&!cartReturn\}/);
  // Sent to sign-in by the cart tab: the cart stays lit, not the profile; "Несколько ссылок" lights "Ссылка".
  assert.match(shell, /const cartReturn=view==='login'&&signInReturn\(here\)\.startsWith\('\/cart'\);/);
  // The checkout (/cart/checkout, redesign stage 6) keeps the cart tab lit too.
  assert.match(shell, /key:'cart',Icon:ShoppingBag,label:words\.cart,active:view==='cart'\|\|view==='checkout'\|\|\(view==='login'&&cartReturn\)\}/);
  assert.match(shell, /key:'link',Icon:Plus,label:nav\.link,active:view==='link'\|\|view==='batch'\}/);
});

test('the profile shows a dot while an order waits for the customer, said to screen readers too', () => {
  const shell = source('app/marketplace.tsx');
  // Since 1 November 2026 the recipient's passport counts too, and the same first action is the mint strip under the header.
  assert.match(shell, /const firstAction=ready\?firstProfileAction\(state\):undefined;\r?\n  const attention=Boolean\(firstAction\);/);
  assert.match(shell, /<Link className="shell-attention" href=\{strip\.href\}>/);
  assert.match(shell, /dot\?`\$\{label\} — \$\{nav\.needsAction\}`/);
  // The button's name starts with the word it shows ("Профиль"), so a voice command finds it; the list keeps "Меню профиля".
  assert.match(source('app/profile-menu.tsx'), /aria-label=\{nav\.profile\+\(attention\?' — '\+nav\.needsAction:''\)\}/);
  assert.match(source('app/profile-menu.tsx'), /role="group" aria-label=\{nav\.profileMenu\}/);
});

test('the cart keeps its count in its name in the header and the bottom bar', () => {
  const shell = source('app/marketplace.tsx');
  // While the account loads (no count known) it is just "Корзина"; a guest's browser cart is counted (redesign stage 6).
  assert.match(shell, /const cartLabel=known\|\|status==='guest'\?modalWords\.cart\+shownCount:words\.cart;/);
  assert.match(shell, /const count=ready\?state\.cart\.reduce\(\(s,i\)=>s\+i\.quantity,0\):status==='guest'\?guestUnits\(guestCart\):0/);
  // Guests open the cart itself, not the sign-in page.
  assert.match(shell, /const cartHref='\/cart',/);
  assert.match(shell, /aria-label=\{key==='cart'\?cartLabel:/);
  assert.match(shell, /className=\{'shell-cart shell-wide'[^}]*\} aria-label=\{cartLabel\}/);
  assert.match(shell, /<CartAnnouncer count=\{count\} ready=\{ready\} locale=\{locale\}\/>/, 'changes are said politely');
});

test('the header search: words go to the catalog, a store link to its calculation', () => {
  assert.equal(headerSearchTarget(''), '');
  assert.equal(headerSearchTarget('  nike кроссовки '), '/catalog?q=' + encodeURIComponent('nike кроссовки'));
  assert.equal(headerSearchTarget('nike.com'), '/catalog?q=nike.com', 'a bare domain is a search');
  assert.equal(headerSearchTarget('https://www.zara.com/uz/ru/item-p1.html'), '/order-by-link?url=' + encodeURIComponent('https://www.zara.com/uz/ru/item-p1.html'));
  assert.equal(headerSearchLink('Look at these https://www.nike.com/t/shoe-1 via Nike'), 'https://www.nike.com/t/shoe-1');
  assert.equal(headerSearchLink('zara.com/uz/item-p1.html'), 'https://zara.com/uz/item-p1.html');
  assert.equal(headerSearchTarget('x'.repeat(200)).length, '/catalog?q='.length + 80, 'a search is at most 80 characters, as the catalog field');
});

test('the theme stays reachable: the profile menu, the account settings and the footer', () => {
  assert.match(source('app/profile-menu.tsx'), /<ThemeToggle locale=\{locale\}\/>/);
  // The account's settings moved to /account/settings (1 November 2026).
  assert.match(source('app/account-views.tsx'), /<ThemeToggle locale=\{lang\} \/>/);
  assert.match(source('app/site-footer.tsx'), /<ThemeToggle locale=\{locale\}\/>/);
});

test('phones: no breadcrumb (its JSON-LD stays), a shorter footer, none in the apps', () => {
  const css = source('app/shell.css');
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*\.site-main > \.breadcrumb \{ display: none; \}/);
  // The footer's own sheet (2 November 2026): phones hide the links the bottom bar has and show the short tagline.
  const footer = source('app/footer.css');
  assert.match(footer, /@media \(max-width: 760px\) \{[\s\S]*html:root \.home-footer \.footer-dup \{ display: none; \}/);
  assert.match(footer, /html:root \.home-footer-tagline-long \{ display: none; \}/);
  assert.match(source('app/marketplace.tsx'), /<JsonLd data=\{crumb&&crumbPath\?breadcrumbList\(\[[\s\S]*?\],pageLang\):breadcrumbs\(locale,publicViewPaths\[view\],routeTitle\(locale,view\),pageLang,pageLanguageSet\(publicViewPaths\[view\]\)\)\}\/>/);
  assert.match(source('app/native.css'), /html\[data-native\] \.home-footer \{ display: none; \}/);
});

test('the notification sheet titles are not in capitals; the UI audit expects the bottom bar', () => {
  const rule = source('app/notice-panel.css').match(/\.notice-panel h3 \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /text-transform: none/);
  assert.doesNotMatch(rule, /uppercase/);
  const audit = source('scripts/audit-ui.mjs');
  assert.doesNotMatch(audit, /!document\.querySelector\('\.mobile-nav'\)/);
  assert.match(audit, /guest mobile has the bottom navigation/);
});
