import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getUnitOptions } = require('../src/services/barcodeUnits.js');
const { buildBarcodeLabels } = require('../src/services/barcodeEngine.js');

const product = {
  name: 'Basmati Rice', barcode: '4006381333931', mrp: 500, unitValue: 5,
  packageUnitName: 'Bag', unitsPerPackage: 10, subUnitPrice: 55,
};

test('unit options use POS pricing rules', () => {
  const options = getUnitOptions(product);
  assert.deepEqual(options.slice(0, 2).map((o) => [o.name, o.price]), [['Bag', 100], ['Pcs', 55]]);
});

test('label shows product name with selected unit and its price', () => {
  const [piece] = getUnitOptions(product).slice(1);
  const { labels } = buildBarcodeLabels([{ ...product, unitName: piece.name, price: piece.price }], 'price');
  assert.equal(labels[0].name, 'Basmati Rice (Pcs)');
  assert.equal(labels[0].price, '55.00');
});

test('long names keep the unit suffix', () => {
  const { labels } = buildBarcodeLabels([{ ...product, name: 'X'.repeat(60), unitName: 'Carton', price: 1 }], 'price');
  assert.ok(labels[0].name.endsWith('(Carton)'));
  assert.ok(labels[0].name.length <= 40);
});

test('label size changes TSPL paper dimensions', () => {
  const item = { ...product, price: 100, originalPrice: 120 };
  assert.match(buildBarcodeLabels([item], 'price', '38x25').tspl, /SIZE 38 mm,25 mm/);
  assert.match(buildBarcodeLabels([item], 'price', '32x18').tspl, /SIZE 32 mm,18 mm/);
  assert.throws(() => buildBarcodeLabels([item], 'price', '1x1'));
});

test('dropdown includes universal units without rescaling price', () => {
  const names = getUnitOptions(product).map((o) => o.name);
  for (const n of ['Box', 'Pcs', 'Pack', 'Kg', 'Gram', 'Liter']) assert.ok(names.includes(n), n);
  const box = getUnitOptions(product).find((o) => o.name === 'Box');
  assert.equal(box.price, 500);
});
