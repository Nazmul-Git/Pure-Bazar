import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { defaultPiecesPerPackage, totalPieces, basePieceCost } = createRequire(import.meta.url)('../src/services/unit-pieces.cjs');

const r2 = (v) => (Math.round(v * 100) / 100).toFixed(2);

test('Dozen defaults to 12 pieces per package; other units stay open', () => {
  assert.equal(defaultPiecesPerPackage({ name: 'Dozen', abbreviation: 'Doz' }), '12');
  assert.equal(defaultPiecesPerPackage({ name: 'Box', abbreviation: 'box' }), '');
  assert.equal(defaultPiecesPerPackage(null), '');
});

test('Test 1 (Dozen): 10 x 12 = 120 pieces, base cost 13.33, override 14 is valid', () => {
  const total = totalPieces('10', '12');
  assert.equal(total, '120');
  const base = basePieceCost(1600, total);
  assert.equal(r2(base), '13.33');
  assert.ok(14 >= base);
});

test('Test 2 (Box, custom 50): 5 x 50 = 250 pieces, base cost 4.00', () => {
  const total = totalPieces('5', '50');
  assert.equal(total, '250');
  assert.equal(r2(basePieceCost(1000, total)), '4.00');
});

test('invalid input gives no total', () => {
  assert.equal(totalPieces('', '12'), '');
  assert.equal(totalPieces('0', '12'), '');
  assert.equal(totalPieces('5', ''), '');
  assert.equal(basePieceCost(100, ''), null);
});
