// What the first screen of every page loads (14.10.2026, PageSpeed): code that renders nothing at first or only after a
// press comes later, without changing how anything looks or behaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');
const appFiles = readdirSync(new URL('app/', root)).filter((f) => f.endsWith('.tsx')).map((f) => 'app/' + f);

test('the window (Radix Dialog) is not part of market-ui, which every page loads', () => {
  const ui = source('app/market-ui.tsx');
  assert.doesNotMatch(ui, /components\/ui\/dialog/);
  assert.doesNotMatch(ui, /export function Modal\b/);
  const modal = source('app/modal.tsx');
  assert.match(modal, /^'use client';/);
  assert.match(modal, /export function Modal\(\{open,onClose,title,description,children,locale='ru'\}/);
  assert.match(modal, /<DialogContent className="atlas-modal" showCloseButton=\{false\}>/);
  for (const file of appFiles) {
    const src = source(file);
    if (!/<Modal[\s>]/.test(src) || file === 'app/modal.tsx') continue;
    assert.ok(/import \{[^}]*\bModal\b[^}]*\} from (['"])\.\/modal\1;/.test(src), file + ' imports Modal from ./modal');
  }
});

test('the "?" bubble (Radix Popover) loads on demand; until then the button looks and reads like the Radix trigger', () => {
  const tip = source('components/info-tip.tsx');
  assert.doesNotMatch(tip, /^import .*components\/ui\/popover/m, 'no static import of the popover');
  // Fetching ahead (idle, focus, pointer down) is a plain import that forgets a failure; only a press may reload the page
  // for a part missing after a deploy, and it tries a failed fetch once more first.
  assert.match(tip, /loading \?\?= import\('\.\/info-tip-popover'\)\.then\(\(module\) => \(loaded = module\), \(error: unknown\) => \{ loading = null; throw error; \}\);/);
  assert.match(tip, /function warmInfoTipPopover\(\) \{\n  if \(!loaded\) void importInfoTipPopover\(\)\.catch\(\(\) => \{\}\);\n\}/);
  assert.match(tip, /return loadChunk\(\(\) => importInfoTipPopover\(\)\.catch\(\(\) => importInfoTipPopover\(\)\)\);/);
  assert.equal(tip.match(/loadChunk\(/g).length, 1, 'loadChunk only behind a press');
  assert.match(tip, /onPointerDown=\{warmInfoTipPopover\} onFocus=\{warmInfoTipPopover\} onClick=\{\(\) => \{ void loadInfoTipPopover\(\)\.then\(setPressed, \(\) => \{\}\); \}\}/);
  // The attributes Radix renders on a closed PopoverTrigger, so CSS and assistive tech see the same button.
  for (const attribute of ['type="button"', 'className="info-tip"', 'aria-label={name}', 'aria-haspopup="dialog"', 'aria-expanded="false"', 'data-state="closed"', 'data-slot="popover-trigger"']) assert.ok(tip.includes(attribute), attribute);
  assert.match(tip, /<CircleHelp size=\{17\} aria-hidden="true" \/>/);
  // Only a press swaps in the Radix button, open at once: a plain button that merely has focus is never replaced, so
  // focus does not drop to the page body when the code arrives.
  assert.doesNotMatch(tip, /useSyncExternalStore/);
  assert.match(tip, /if \(pressed\) return <pressed\.InfoTipPopover name=\{name\} defaultOpen>\{children\}<\/pressed\.InfoTipPopover>;/);
  const popover = source('components/info-tip-popover.tsx');
  assert.match(popover, /<PopoverTrigger asChild><button type="button" className="info-tip" aria-label=\{name\}><CircleHelp size=\{17\} aria-hidden="true" \/><\/button><\/PopoverTrigger>/);
  assert.match(popover, /<PopoverContent className="info-tip-bubble" side="bottom" align="center" sideOffset=\{8\} collisionPadding=\{16\}>/);
});

// A shared "icons" chunk (J4 of the plan) was tried and dropped on 14.10.2026: rolldown also pulled React into it, and with
// fewer requests Lighthouse's simulation counted more script before first paint (mobile /catalog 83 → 77, /order-by-link
// 84 → 79 in one session). Keep the bundler's own split unless a same-session A/B says otherwise.
test('the client build keeps the bundler\'s own chunk split (no forced icons chunk)', () => {
  const config = source('vite.config.ts');
  assert.doesNotMatch(config, /name:\s*["']icons["']/);
  assert.doesNotMatch(config, /lucide-react/);
});

test('the consent sheet, the speed beacon and Impact come right after hydration; Impact is still mounted', () => {
  const layout = source('app/layout.tsx');
  for (const name of ['StorageNotice', 'PerformanceProbe', 'ImpactTracking']) assert.doesNotMatch(layout, new RegExp(`import \\{ ${name} \\}`), name + ' is not in the layout chunk');
  assert.match(layout, /\{children\}<ShellExtras \/><StaleBuildReload \/><NativeShell \/><PressFeedback \/><\/MarketProvider>/);
  const extras = source('app/shell-extras.tsx');
  // Requested once the store is subscribed, i.e. after hydration; the server and the hydration render draw nothing.
  assert.match(extras, /useSyncExternalStore\(subscribe,\(\)=>parts,\(\)=>null\)/);
  assert.match(extras, /return loaded\?<loaded\.ShellExtrasParts\/>:null;/);
  // A failed chunk leaves the spot empty: no lazy() without an error boundary, no page reload. No retry either: Chrome
  // keeps a failed module failed until the page reloads, so a second import() would fail at once.
  assert.doesNotMatch(extras, /\blazy\(|loadChunk|Suspense|reload\(/);
  assert.match(extras, /if\(requested\)return;\n  requested=true;\n  import\('\.\/shell-extras-parts'\)\.then\(module=>\{\n    parts=module;\n    listeners\.forEach\(notify=>notify\(\)\);\n  \},\(\)=>\{\}\);/);
  // Script errors from before the beacon mounts are kept and handed to it.
  assert.match(extras, /^listenEarlyErrors\(\);$/m);
  assert.match(source('app/performance-probe.tsx'), /window\.addEventListener\('unhandledrejection', onRejection\);\n    takeEarlyErrors\(\)\.forEach\(report\);/);
  assert.match(source('app/shell-extras-parts.tsx'), /return <><StorageNotice\/><PerformanceProbe\/><ImpactTracking\/><\/>/);
  // The head bootstrap of Impact stays in the layout.
  assert.match(layout, /<script id="atlas-impact-bootstrap"/);
});

test('script errors from before the beacon mounts are kept, up to five, and handed over once', async () => {
  const target = new EventTarget();
  globalThis.window = target;
  try {
    const { listenEarlyErrors, takeEarlyErrors } = await import('../lib/market/early-errors.ts');
    listenEarlyErrors();
    listenEarlyErrors();
    const fire = (type, fields) => target.dispatchEvent(Object.assign(new Event(type), fields));
    fire('error', { message: 'boom', filename: 'https://atlas.example/_next/static/chunks/a.js?v=1#x', lineno: 3 });
    fire('unhandledrejection', { reason: new TypeError('bad') });
    fire('error', { message: '  ' });
    for (let i = 0; i < 6; i++) fire('error', { message: 'e' + i });
    const caught = takeEarlyErrors();
    assert.equal(caught.length, 5);
    assert.deepEqual(caught[0], { kind: 'error', message: 'boom', source: 'https://atlas.example/_next/static/chunks/a.js', line: 3 });
    assert.deepEqual(caught[1], { kind: 'rejection', message: 'TypeError: bad' });
    assert.deepEqual(caught.slice(2).map((error) => error.message), ['e0', 'e1', 'e2']);
    // The beacon listens from here on: nothing is kept twice, and the early listener does not start again.
    fire('error', { message: 'late' });
    listenEarlyErrors();
    fire('error', { message: 'later' });
    assert.deepEqual(takeEarlyErrors(), []);
  } finally {
    delete globalThis.window;
  }
});

test('ribbon marks out of view at the start are asked for once the page has settled, never drawn as solid blocks', () => {
  const css = source('app/store-marks.css');
  assert.match(css, /^\.store-mark\[data-mark="later"\] \{ background: none; \}$/m);
  const logo = source('app/store-logo.tsx');
  assert.match(logo, /\.\.\.\(later \? \{\} : \{ '--mark': `url\(\/store-marks\/\$\{brandKey\}\.svg\)` \}\)/);
  assert.match(logo, /data-mark=\{later \? 'later' : undefined\}/);
  const marquee = source('app/store-marquee.tsx');
  assert.match(marquee, /const firstMarks=14,lastMarks=6;/);
  assert.match(marquee, /index<firstMarks\|\|\(reverse&&index>=count-lastMarks\)/);
  assert.match(marquee, /requestIdleCallback\(show,\{timeout:1500\}\)/);
  // It keeps moving under the pointer: no pause on hover.
  assert.doesNotMatch(css, /:hover[^{]*\.store-marquee-track[^{]*\{[^}]*paused/);
});

test('the bottom bar pages are warmed after the first scroll or touch, or after 8 s', () => {
  const link = source('components/site-link.tsx');
  assert.match(link, /export const warmLinkEvents = \["scroll", "touchstart", "pointerdown", "keydown"\] as const;/);
  assert.match(link, /export const warmLinksFallbackMs = 8000;/);
  assert.match(link, /fallback = window\.setTimeout\(start, warmLinksFallbackMs\);/);
});

test('showcase photos on /stores take a smaller copy with a fixed `sizes` (not "auto", which adds contain: size)', () => {
  const stores = source('app/stores-directory.tsx');
  assert.match(stores, /srcSet=\{sizedSrcSet\(src, 500\)\} sizes=\{showcaseSizes\(count\)\}/);
  assert.match(stores, /return Math\.round\(300 \/ Math\.min\(3, Math\.max\(1, count\)\)\) \+ 'px';/);
  assert.match(stores, /<ShowcasePhoto key=\{item\.product\.id\} src=\{item\.product\.image\} brand=\{brand\} count=\{photos\.length\} \/>/);
});
