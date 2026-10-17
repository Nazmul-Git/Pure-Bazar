const { randomInt } = require('crypto');

const EAN13_BODY_RANGE = 1_000_000_000_000;

function ean13CheckDigit(body) {
  const digits = String(body);
  if (!/^\d{12}$/.test(digits)) {
    throw new Error('An EAN-13 barcode body must contain exactly 12 digits');
  }
  const sum = [...digits].reduce((total, digit, index) => (
    total + Number(digit) * (index % 2 === 0 ? 1 : 3)
  ), 0);
  return String((10 - (sum % 10)) % 10);
}

function generateEan13Barcode() {
  const body = String(randomInt(0, EAN13_BODY_RANGE)).padStart(12, '0');
  return `${body}${ean13CheckDigit(body)}`;
}

function isValidEan13(value) {
  return typeof value === 'string'
    && /^\d{13}$/.test(value)
    && value[12] === ean13CheckDigit(value.slice(0, 12));
}

function generateSku(barcode) {
  if (!isValidEan13(barcode)) {
    throw new Error('A valid EAN-13 barcode is required to generate a product SKU');
  }
  return `PB-${barcode}`;
}

module.exports = { ean13CheckDigit, generateEan13Barcode, generateSku, isValidEan13 };
