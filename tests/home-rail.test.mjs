import test from 'node:test';
import assert from 'node:assert/strict';
import { homeRailCopy } from '../lib/market/home-rail-copy.ts';
import { currentChapterIndex, padChapter, railFill } from '../lib/market/home-rail.ts';

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'function') return 'function';
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return typeof value;
}

test('rail copy has the same keys in Uzbek, Russian and English, with no empty strings', () => {
  assert.deepEqual(Object.keys(homeRailCopy).sort(), ['en', 'ru', 'uz']);
  assert.deepEqual(shape(homeRailCopy.uz), shape(homeRailCopy.ru));
  assert.deepEqual(shape(homeRailCopy.en), shape(homeRailCopy.ru));
  for (const [locale, copy] of Object.entries(homeRailCopy)) {
    const walk = (value, path) => {
      if (typeof value === 'string') assert.ok(value.trim(), `${locale}.${path} is empty`);
      else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
    };
    walk(copy, '');
    // «How it works» and «Rates» come from homeCopy.nav: no second copy of them here.
    assert.deepEqual(Object.keys(copy.chapters).sort(), ['end', 'faq', 'finds', 'top', 'trust']);
  }
});

test('Uzbek rail copy uses Latin script and the ‘ letter mark, not Cyrillic', () => {
  const text = JSON.stringify(homeRailCopy.uz);
  assert.doesNotMatch(text, /[Ѐ-ӿ]/);
  assert.doesNotMatch(text, /o'|g'|O'|G'/);
  assert.doesNotMatch(JSON.stringify(homeRailCopy.en), /[Ѐ-ӿ]/);
});

test('chapter numbers are two digits', () => {
  assert.equal(padChapter(1), '01');
  assert.equal(padChapter(7), '07');
  assert.equal(padChapter(12), '12');
});

// Seven one-screen sheets of 1000px in a 1000px window: the document is 7000px, the last scroll position 6000.
const vh = 1000;
const seven = [0, 1000, 2000, 3000, 4000, 5000, 6000];
// Rail items 44px tall with a 2px gap: their centres.
const centres = n => Array.from({ length: n }, (_, i) => 22 + i * 46);

test('the current chapter is the last one whose top has passed 45% of the window', () => {
  assert.equal(currentChapterIndex(seven, 0, vh, 7000), 0, 'top of the page');
  assert.equal(currentChapterIndex(seven, 549, vh, 7000), 0, 'the next sheet is not yet at 45%');
  assert.equal(currentChapterIndex(seven, 550, vh, 7000), 1, 'the next sheet reached 45%');
  assert.equal(currentChapterIndex(seven, 3000, vh, 7000), 3, 'snapped on a middle sheet');
  assert.equal(currentChapterIndex(seven, 3400, vh, 7000), 3, 'part way down a middle sheet');
  assert.equal(currentChapterIndex(seven, 6000, vh, 7000), 6, 'bottom of the page');
});

test('at the end of the document the last chapter is current, even when it is shorter than the window', () => {
  // The end sheet starts at 5800 and the document ends at 6300: the last scroll position is 5300.
  const tops = [0, 1000, 2000, 3000, 4000, 5000, 5800];
  assert.equal(currentChapterIndex(tops, 5300, vh, 6300), 6);
  assert.equal(currentChapterIndex(tops, 5297, vh, 6300), 5, 'not yet at the end');
  assert.equal(currentChapterIndex(tops, 5298, vh, 6300), 6, 'within 2px of the end');
});

test('without the product selection there are six chapters and the indexes close up', () => {
  const six = [0, 1000, 2000, 3000, 4000, 5000];
  assert.equal(currentChapterIndex(six, 0, vh, 6000), 0);
  assert.equal(currentChapterIndex(six, 2000, vh, 6000), 2, 'the third chapter is the rates now');
  assert.equal(currentChapterIndex(six, 5000, vh, 6000), 5, 'the end is the sixth');
  assert.equal(railFill(six, centres(6), 5000, 5), 1);
  assert.equal(railFill(six, centres(6), 2000, 2), 0.4);
});

test('the progress line runs from the first item to the last as the page scrolls', () => {
  const c = centres(7), span = c[6] - c[0];
  assert.equal(railFill(seven, c, 0, 0), 0, 'top of the page');
  assert.equal(railFill(seven, c, 500, 0), (0.5 * 46) / span, 'half way through the first sheet');
  assert.equal(railFill(seven, c, 3000, 3), 0.5, 'on the middle sheet');
  assert.equal(railFill(seven, c, 6000, 6), 1, 'bottom of the page');
  // Between two sheets the line moves continuously and never goes back.
  let last = -1;
  for (let y = 0; y <= 6000; y += 50) {
    const f = railFill(seven, c, y, currentChapterIndex(seven, y, vh, 7000));
    assert.ok(f >= 0 && f <= 1, `fill ${f} at ${y}`);
    assert.ok(f >= last, `fill went back at ${y}`);
    last = f;
  }
});

test('the progress line never breaks on odd geometry', () => {
  assert.equal(railFill([0], [22], 0, 0), 0, 'one chapter');
  assert.equal(railFill([], [], 0, 0), 0, 'nothing measured yet');
  assert.equal(railFill([0, 0, 1000], centres(3), 0, 0), 0, 'two tops in the same place: no division by zero');
  assert.equal(railFill([0, 0, 1000], centres(3), 0, 1), 0.5);
  assert.equal(railFill(seven, centres(7), 0, 9), 0, 'index out of range');
  assert.equal(railFill(seven, [22, 22], 0, 0), 0, 'no span');
  assert.equal(currentChapterIndex([], 0, vh, 0), 0, 'no chapters');
});
