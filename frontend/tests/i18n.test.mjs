import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate, LANGUAGES } from '../src/i18n/translate.js';
import bn from '../src/i18n/bn.js';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

function jsxFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsxFiles(full, out);
    else if (full.endsWith('.jsx')) out.push(full);
  }
  return out;
}

test('supports English and Bengali', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'bn']);
});

test('English returns text unchanged and Bengali translates known keys', () => {
  assert.equal(translate('en', 'Dashboard'), 'Dashboard');
  assert.equal(translate('bn', 'Dashboard'), 'ড্যাশবোর্ড');
  assert.equal(translate('bn', 'Stock Count'), 'স্টক গণনা');
});

test('unknown text and non-strings fall back safely', () => {
  assert.equal(translate('bn', 'Some dynamic product name'), 'Some dynamic product name');
  assert.equal(translate('bn', 42), 42);
  assert.equal(translate('bn', undefined), undefined);
});

test('loading and permission patterns translate', () => {
  assert.equal(translate('bn', 'Loading products...'), 'পণ্য লোড হচ্ছে...');
  assert.equal(translate('bn', 'You do not have permission to view products.'), 'পণ্য দেখার অনুমতি আপনার নেই।');
});

test('every dictionary value is non-empty text', () => {
  for (const [key, value] of Object.entries(bn)) {
    assert.ok(typeof value === 'string' && value.trim(), `empty translation for "${key}"`);
  }
});

test('every <T> literal in the UI has a Bengali translation', () => {
  const missing = new Set();
  for (const file of jsxFiles(srcDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<T>\{("(?:[^"\\]|\\.)*")\}<\/T>/g)) {
      const text = JSON.parse(match[1]);
      if (translate('bn', text) === text) missing.add(text);
    }
  }
  assert.deepEqual([...missing], []);
});

test('Form A labels and section headings have Bengali translations', () => {
  const formPath = path.join(srcDir, 'components/vendors/vendor-register-form.jsx');
  const source = fs.readFileSync(formPath, 'utf8');
  const labels = [...source.matchAll(/(?:label|title|description)="([^"]+)"/g)].map((match) => match[1]);
  const headings = [
    'Owner Personal Identity',
    "Provide the owner's identity and contact information.",
    'Business & KYB Verification',
    'Provide the business identity and verification details.',
  ];

  assert.deepEqual(
    [...labels, ...headings].filter((text) => translate('bn', text) === text),
    [],
  );
});

test('Form A requires its KYB fields and excludes non-essential personal fields', () => {
  const formPath = path.join(srcDir, 'components/vendors/vendor-register-form.jsx');
  const source = fs.readFileSync(formPath, 'utf8');

  for (const field of [
    'nidOrPassportNumber',
    'tradeLicenseNumber',
    'mobile',
    'presentAddress',
    'permanentAddress',
    'address',
  ]) {
    const fieldIsRequired = source.split(/\r?\n/).some(
      (line) => line.includes(`name="${field}"`) && /\brequired\b/.test(line),
    );
    assert.ok(fieldIsRequired, `${field} must be required`);
  }
  assert.match(source, /nationality: 'Bangladeshi'/);
  assert.doesNotMatch(source, /Religion|Blood Group|Profession/);
});
