import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/app/inventory/barcodes/page.jsx', import.meta.url), 'utf8');

test('catalog constrains its grid track, search, scanner, and scrollable table', () => {
  assert.match(page, /grid-cols-\[minmax\(0,1fr\)\].*xl:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(0,1fr\)\]/);
  assert.match(page, /<Card className="min-w-0" title="Product catalog"/);
  assert.match(page, /className="w-full min-w-0 flex-1"><Input label="Search products"/);
  assert.match(page, /className="w-full sm:w-auto \[&>span>button\]:w-full sm:\[&>span>button\]:w-11"><CameraBarcodeScanner/);
  assert.match(page, /className="block w-full min-w-0 overflow-x-auto"><Table/);
});

test('batch settings, empty state, and queued items fit and stack on mobile', () => {
  assert.match(page, /<Card className="min-w-0" title="Label batch"/);
  assert.match(page, /className="mb-4 flex w-full min-w-0 max-w-xl flex-col gap-3 sm:grid sm:grid-cols-2"/);
  for (const label of ['Label format', 'Label size']) {
    assert.ok(page.includes(`<Select className="w-full min-w-0" label="${label}"`), label);
  }
  assert.match(page, /<p className="w-full break-words [^"]+"><T>\{"Add one or more products to create a batch\."\}/);
  assert.match(page, /className="flex w-full min-w-0 flex-col gap-3 [^"]+ sm:grid sm:grid-cols-2 sm:items-end"/);
});

test('all batch print and export actions are full width on mobile', () => {
  assert.match(page, /className="barcode-actions mt-4 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"/);
  for (const action of ['Export TSPL', 'Print TSPL (Xprinter)', 'Export ESC/POS', 'Print ESC/POS', 'Print preview']) {
    const line = page.split('\n').find((entry) => entry.includes(`>${action}</Button>`));
    assert.ok(line, action);
    assert.match(line, /className="[^"]*\bw-full\b[^"]*\bsm:w-auto\b/);
  }
});
