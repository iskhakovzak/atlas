import test from 'node:test';
import assert from 'node:assert/strict';
import { isLand, landDots, landGrid, landRings, quadArc, routeBulge, routeLabelSide, routeOrigins, tashkent, waterRings } from '../lib/market/world-land.ts';
import { deliveryRegions } from '../lib/market/site-content.ts';

// The dot map on the home page's closing sheet (app/home-decor.tsx, wide screens): an illustration built from
// coarse hand-drawn outlines. These checks keep it sane when the outlines or the delivery regions change.

const inGrid = ([lon, lat]) => lon >= landGrid.west && lon <= landGrid.east && lat >= landGrid.south && lat <= landGrid.north;

test('land dots: a stable, finite set inside the grid, memoised per step', () => {
  const dots = landDots();
  // 4 768 dots at the default 1.8-degree step; a wide band so a small outline fix does not fail the test.
  assert.ok(dots.length > 4000 && dots.length < 5600, `unexpected dot count ${dots.length}`);
  assert.ok(dots.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)), 'NaN or Infinity in the dots');
  assert.ok(dots.every(inGrid), 'a dot outside the grid');
  assert.equal(landDots(), dots, 'the default step is computed once');
  assert.equal(landDots(1.8), dots);
  assert.ok(landDots(3.6).length < dots.length / 2, 'a coarser step gives fewer dots');
});

test('land dots are exactly the grid points on land (the scanline agrees with isLand point by point)', () => {
  for (const step of [1.8, 2.5]) {
    const brute = [];
    for (let row = 0, lat = landGrid.north; lat >= landGrid.south; row++, lat = landGrid.north - row * step) {
      for (let lon = landGrid.west + (row % 2) * step / 2; lon <= landGrid.east; lon += step) if (isLand(lon, lat)) brute.push([lon, lat]);
    }
    assert.deepEqual(landDots(step), brute, `step ${step}`);
  }
});

test('outlines: closed rings of [lon, lat] pairs', () => {
  for (const ring of [...landRings, ...waterRings]) {
    assert.ok(ring.length >= 3, 'a ring needs at least three points');
    for (const [lon, lat] of ring) assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90);
  }
});

test('water is cut out of the land: Tashkent is on land, the Caspian and the Black Sea are not', () => {
  assert.equal(isLand(tashkent[0], tashkent[1]), true);
  assert.equal(isLand(51, 40.5), false, 'the middle of the Caspian');
  assert.equal(isLand(34, 43.5), false, 'the middle of the Black Sea');
  assert.equal(isLand(-30, 30), false, 'the Atlantic');
});

test('every delivery region has a route origin on the map', () => {
  for (const { id } of deliveryRegions) {
    const at = routeOrigins[id];
    assert.ok(at, `no route origin for ${id}`);
    assert.ok(inGrid(at), `the ${id} origin is outside the grid`);
    assert.equal(isLand(at[0], at[1]), true, `the ${id} origin is not on land`);
    assert.ok(['l', 'r', 'b'].includes(routeLabelSide[id] ?? 'l'));
    assert.ok((routeBulge[id] ?? .36) >= 0 && (routeBulge[id] ?? .36) < 1);
  }
  assert.ok(inGrid(tashkent));
});

test('route arcs are measured without the DOM: length, points and direction along the curve', () => {
  const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
  // A straight "curve" (the control point on the chord): its length is the chord, its direction the chord's.
  const line = quadArc(0, 0, 50, 50, 100, 100);
  close(line.length, Math.hypot(100, 100), 1e-9, 'straight length');
  close(line.at(line.length / 2).x, 50, 1e-9, 'straight midpoint');
  close(line.at(10).angle, 45, 1e-9, 'straight angle');
  // A route-like arc (Madrid → Tashkent on a 1920 map): the chord table agrees with a fine walk of the same curve.
  const [x0, y0, cx, cy, x1, y1] = [884.6, 437.5, 1130.9, 300.2, 1377.2, 424.3];
  const arc = quadArc(x0, y0, cx, cy, x1, y1);
  const fine = quadArc(x0, y0, cx, cy, x1, y1, 20000);
  close(arc.length, fine.length, .05, 'length');
  for (const share of [0, .1, .25, .55, .8, 1]) {
    const p = arc.at(arc.length * share), q = fine.at(fine.length * share);
    close(p.x, q.x, .1, `x at ${share}`); close(p.y, q.y, .1, `y at ${share}`); close(p.angle, q.angle, .2, `angle at ${share}`);
  }
  // The ends, clamped beyond them; the parcel heads up-right at the start and down-right at the end (screen y grows down).
  assert.deepEqual([arc.at(-5).x, arc.at(-5).y], [x0, y0]);
  close(arc.at(arc.length + 5).x, x1, 1e-9, 'end x'); close(arc.at(arc.length + 5).y, y1, 1e-9, 'end y');
  assert.ok(arc.at(0).angle < 0 && arc.at(arc.length).angle > 0);
  // Monotonic along x for a route that runs west to east
  let last = -Infinity;
  for (let len = 0; len <= arc.length; len += arc.length / 50) { const { x } = arc.at(len); assert.ok(x >= last); last = x; }
});
