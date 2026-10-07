import test from 'node:test';
import assert from 'node:assert/strict';
import {magnetStops, magnetTarget, wheelPixels} from '../lib/market/home-magnet.ts';

const vh = 1080;
// Seven one-screen sheets and a closing sheet taller than the window (footer under it)
const sheets = [0, 1080, 2160, 3240, 4320, 5400].map((top) => ({top, height: vh})).concat({top: 6480, height: 1211});

test('every sheet top is a stop, and a tall sheet also stops at its bottom edge', () => {
  const max = 6480 + 1211 - vh;
  assert.deepEqual(magnetStops(sheets, vh, max), [0, 1080, 2160, 3240, 4320, 5400, 6480, 6611]);
});

test('stops are clamped to the scroll range, sorted and without near duplicates', () => {
  assert.deepEqual(magnetStops([{top: 500, height: vh}, {top: -20, height: vh}, {top: 501, height: vh}, {top: 9000, height: vh}], vh, 4000), [0, 500, 4000]);
});

test('one gesture moves exactly one stop in its direction', () => {
  const stops = magnetStops(sheets, vh, 6611);
  assert.equal(magnetTarget(stops, 0, 1), 1080);
  assert.equal(magnetTarget(stops, 1080, 1), 2160);
  assert.equal(magnetTarget(stops, 1081, 1), 2160);   // a pixel off still counts as on the sheet
  assert.equal(magnetTarget(stops, 2160, -1), 1080);
  assert.equal(magnetTarget(stops, 6480, 1), 6611);
});

test('between stops the nearest one ahead wins; at the ends there is none', () => {
  const stops = magnetStops(sheets, vh, 6611);
  assert.equal(magnetTarget(stops, 1500, 1), 2160);
  assert.equal(magnetTarget(stops, 1500, -1), 1080);
  assert.equal(magnetTarget(stops, 6611, 1), null);
  assert.equal(magnetTarget(stops, 0, -1), null);
});

test('wheel deltas in lines and pages become pixels', () => {
  assert.equal(wheelPixels(120, 0, vh), 120);
  assert.equal(wheelPixels(3, 1, vh), 120);
  assert.equal(wheelPixels(-1, 2, vh), -vh);
});
