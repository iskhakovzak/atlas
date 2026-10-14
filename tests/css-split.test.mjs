// Guards the split of the layout CSS (14.10.2026): rules only some routes or lazily loaded parts use live in app/styles/*.css
// and are imported by those pages and parts, not by the layout. Each file keeps the order its rules had in the layout, and
// every rule a later layout file overrides stayed in the layout, so: the layout's CSS imports keep their order, no layout
// import of app/styles, and every page imports the same split files, in this order, at the top of its CSS imports.
// Where the build links them (vite-rsc, collectAssetDepsInner): first the layout's CSS, then the CSS of the page's own chunk
// (its own files, plus a split file only this page uses, in import order), then the CSS of the chunks it imports, one per
// split file that several pages share, in the order the build lists those chunks (not necessarily the import order here;
// style snapshots check the result, see ARCHITECTURE.md, 14.10.2026). So a shared split file comes AFTER the page's own CSS
// although the page imports it first, and a rule moved into it wins ties it used to lose against the page or a later
// layout file: such a rule stays in the layout, and a page rule that must beat one of its rules is made more specific
// (app/admin-wide.css, app/admin-investor.css).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');
const cssImports = (file) => [...source(file).matchAll(/^import\s+["']([^"']+\.css)["'];/gm)].map((m) => m[1]);
const resolve = (file, spec) => (spec.startsWith('.') ? posix.join(posix.dirname(file), spec) : spec);
const isSplit = (path) => path.startsWith('app/styles/');

const LAYOUT_CSS = [
  '@fontsource-variable/inter/opsz.css', './fonts/manrope.css',
  './globals.css', './atlas-design.css', './finds.css', './checkout-clarity.css', './access.css', './login.css',
  './experience.css', './home-polish.css', './dark-theme.css', './mobile-polish.css', './customer-mobile.css', './home.css',
  './customer.css', './theme-night.css', './catalog.css', './stores.css', './mobile.css', './refine.css', './day-folio.css',
  './native.css', './store-marks.css', './ambient.css', './checkbox.css', './press.css', './header-panel.css', './motion.css',
  './link-inputs.css',
];

const OPERATOR = 'operator.css', CATALOG = 'catalog-pages.css', STORES = 'stores-pages.css', LINK = 'link-pages.css',
  MEMBER = 'member-pages.css', CARDS = 'catalog-cards.css';
const MEMBER_ROUTE = [CATALOG, STORES, LINK, MEMBER, CARDS];
/** Page → the split files it imports, in order, at the top of its CSS imports. */
const PAGES = {
  'app/page.tsx': ['home-only.css'],
  'app/admin/page.tsx': [OPERATOR, ...MEMBER_ROUTE],
  'app/analytics/page.tsx': [OPERATOR, STORES, MEMBER, CARDS],
  'app/batch-import/page.tsx': [OPERATOR, CATALOG, MEMBER, CARDS],
  'app/account/page.tsx': MEMBER_ROUTE,
  'app/balance/page.tsx': MEMBER_ROUTE,
  'app/cart/page.tsx': MEMBER_ROUTE,
  'app/declaration/page.tsx': MEMBER_ROUTE,
  'app/identity/page.tsx': MEMBER_ROUTE,
  'app/notifications/page.tsx': MEMBER_ROUTE,
  'app/operations/page.tsx': MEMBER_ROUTE,
  'app/orders/page.tsx': MEMBER_ROUTE,
  'app/catalog/page.tsx': [CATALOG, CARDS],
  'app/favorites/page.tsx': [CATALOG, CARDS],
  'app/login/page.tsx': [CATALOG, MEMBER],
  'app/stores/page.tsx': [STORES, CARDS],
  'app/order-by-link/page.tsx': [STORES, LINK, CARDS],
  'app/legal/page.tsx': [STORES, MEMBER],
  'app/privacy/page.tsx': [STORES, MEMBER],
  'app/terms/page.tsx': [STORES, MEMBER],
  'app/auth/return/page.tsx': [LINK, MEMBER],
  'app/customs/page.tsx': [LINK, MEMBER, CARDS],
};
/** Lazily loaded parts: their CSS comes with their chunk, before they render. */
const LAZY = {
  'app/home-decor.tsx': ['home-decor.css'],
  'app/home-rail.tsx': ['home-rail.css'],
  'app/home-resume.tsx': ['home-resume.css'],
  'app/catalog-teaser.tsx': [CARDS],
  'app/product-sheet.tsx': [CARDS],
};
/** Rules that need a width of 481px or more: linked with media, so on phones they do not block the first paint. */
const DESKTOP = { 'app/layout.tsx': ['layoutDesktopHref', 'layout-desktop.css'], 'app/page.tsx': ['homeDesktopHref', 'home-desktop.css'] };

const splitOf = (file) => cssImports(file).map((spec) => resolve(file, spec)).filter(isSplit).map((p) => p.slice('app/styles/'.length));

test('the layout keeps its CSS imports, in cascade order, and imports none of app/styles', () => {
  assert.deepEqual(cssImports('app/layout.tsx'), LAYOUT_CSS);
  assert.deepEqual(splitOf('app/layout.tsx'), []);
});

test('every page imports the split files it needs, in order, at the top of its CSS imports', () => {
  for (const [page, files] of Object.entries(PAGES)) {
    const imports = cssImports(page).map((spec) => resolve(page, spec));
    assert.deepEqual(splitOf(page), files, page);
    assert.ok(imports.slice(0, files.length).every(isSplit), `${page}: split CSS is imported at the top`);
  }
});

test('lazily loaded parts import their own split CSS', () => {
  for (const [part, files] of Object.entries(LAZY)) assert.deepEqual(splitOf(part), files, part);
});

// The server links catalog-cards.css as css/catalog-cards.<hash>.css; without its own client chunk the browser build named
// the same file after the home teaser, so opening the product sheet on a catalog page fetched a second copy and appended it
// after every other stylesheet (14.10.2026).
test('the client build gives catalog-cards.css its own chunk, named as on the server', () => {
  const config = source('vite.config.ts');
  assert.ok(config.includes('groups: [{ name: "catalog-cards", test: /[\\\\/]app[\\\\/]styles[\\\\/]catalog-cards\\.css$/, minSize: 0, priority: 1 }]'));
  assert.deepEqual(Object.entries(LAZY).filter(([, files]) => files.includes(CARDS)).map(([part]) => part).sort(), ['app/catalog-teaser.tsx', 'app/product-sheet.tsx']);
});

test('the desktop-only files are linked with a media query and the build\'s precedence, not imported', () => {
  for (const [file, [href, css]] of Object.entries(DESKTOP)) {
    const text = source(file);
    assert.match(text, new RegExp(`^import ${href} from ["']\\.\\/styles\\/${css.replace('.', '\\.')}\\?url["'];`, 'm'), file);
    assert.match(text, new RegExp(`<link rel="stylesheet" href=\\{${href}\\} media="\\(min-width: 481px\\)" precedence="vite-rsc/importer-resources" ?/>`), file);
  }
});

test('nothing else imports app/styles, and every file there is used', () => {
  const users = new Set();
  for (const entry of readdirSync(new URL('app/', root), { recursive: true })) {
    const file = 'app/' + String(entry).replace(/\\/g, '/');
    if (!/\.(tsx?|mjs)$/.test(file)) continue;
    if (splitOf(file).length) users.add(file);
  }
  assert.deepEqual([...users].sort(), Object.keys({ ...PAGES, ...LAZY }).sort());
  const used = new Set([...Object.values(PAGES), ...Object.values(LAZY)].flat().concat(Object.values(DESKTOP).map(([, css]) => css)));
  assert.deepEqual(readdirSync(new URL('app/styles/', root)).filter((f) => f.endsWith('.css')).sort(), [...used].sort());
});
