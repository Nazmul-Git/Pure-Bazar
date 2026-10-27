import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { totalPieces } = createRequire(import.meta.url)('../src/services/unit-pieces.cjs');

test('Doz x 10 gives 120 pieces', () => {
  assert.equal(totalPieces({ name: 'Dozen', abbreviation: 'Doz' }, '10'), '120');
  assert.equal(totalPieces({ name: 'Dozen', abbreviation: 'Doz' }, 10), '120');
});

test('units without a fixed ratio or invalid quantity give no default', () => {
  assert.equal(totalPieces({ name: 'Box', abbreviation: 'box' }, '10'), '');
  assert.equal(totalPieces({ name: 'Dozen', abbreviation: 'Doz' }, ''), '');
  assert.equal(totalPieces({ name: 'Dozen', abbreviation: 'Doz' }, '0'), '');
  assert.equal(totalPieces(null, '5'), '');
});
