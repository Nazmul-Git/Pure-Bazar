const BRAND_NAME = 'PureBazar';

const EAN_LEFT = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const EAN_LEFT_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const EAN_RIGHT = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function isValidEan13(value) {
  if (!/^\d{13}$/.test(String(value || ''))) return false;
  const digits = String(value).split('').map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => (
    total + digit * (index % 2 === 0 ? 1 : 3)
  ), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

function getEan13Modules(barcode) {
  if (!isValidEan13(barcode)) throw new Error('A valid EAN-13 barcode is required.');
  const digits = String(barcode).split('').map(Number);
  const parity = EAN_PARITY[digits[0]];
  const middle = digits.slice(1, 7).map((digit, index) => (
    parity[index] === 'L' ? EAN_LEFT[digit] : EAN_LEFT_G[digit]
  )).join('');
  const right = digits.slice(7).map((digit) => EAN_RIGHT[digit]).join('');
  return `101${middle}01010${right}101`.split('').map((module) => module === '1');
}

function safeText(value) {
  return String(value || '')
    .replace(/[\r\n\t"]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 40);
}

function formatPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new Error('Each price label needs a valid product price.');
  return (Math.round((price + Number.EPSILON) * 100) / 100).toFixed(2);
}

function normalizeLabels(items, labelType) {
  if (!['barcode', 'price'].includes(labelType)) throw new Error('Label type must be barcode or price.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Select at least one product to print.');
  const labels = [];
  for (const item of items) {
    if (!isValidEan13(item.barcode)) throw new Error(`Product "${item.name}" has an invalid EAN-13 barcode.`);
    const copies = Number(item.copies ?? 1);
    if (!Number.isInteger(copies) || copies < 1 || copies > 500) {
      throw new Error('Label copies must be a whole number from 1 to 500.');
    }
    const label = {
      name: safeText(item.name),
      barcode: String(item.barcode),
      price: labelType === 'price' ? formatPrice(item.mrp) : '',
    };
    for (let copy = 0; copy < copies; copy += 1) labels.push(label);
  }
  return labels;
}

function buildTspl(labels) {
  return labels.map(({ name, barcode, price }) => [
    'SIZE 50 mm,30 mm',
    'GAP 2 mm,0 mm',
    'CLS',
    `TEXT 20,6,"3",0,1,1,"${BRAND_NAME}"`,
    `TEXT 20,36,"0",0,1,1,"${name}"`,
    `BARCODE 20,62,"EAN13",60,1,0,2,2,"${barcode}"`,
    ...(price ? [`TEXT 20,180,"0",0,1,1,"BDT ${price}"`] : []),
    'PRINT 1',
  ].join('\r\n')).join('\r\n');
}

function buildEscPos(labels) {
  const output = [0x1b, 0x40];
  const encoder = new TextEncoder();
  const appendText = (text) => output.push(...encoder.encode(text));
  labels.forEach(({ name, barcode, price }, index) => {
    output.push(0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01);
    appendText(`${BRAND_NAME}\n`);
    appendText(`${name}\n`);
    output.push(0x1b, 0x45, 0x00);
    if (price) appendText(`BDT ${price}\n`);
    output.push(0x1d, 0x48, 0x02, 0x1d, 0x77, 0x02, 0x1d, 0x68, 0x50);
    output.push(0x1d, 0x6b, 0x43, 0x0c, ...encoder.encode(barcode.slice(0, 12)), 0x0a, 0x0a);
    if (index === labels.length - 1) output.push(0x1d, 0x56, 0x00);
  });
  return new Uint8Array(output);
}

function buildBarcodeLabels(items, labelType = 'price') {
  const labels = normalizeLabels(items, labelType);
  return { labels, tspl: buildTspl(labels), escPos: buildEscPos(labels) };
}

module.exports = { BRAND_NAME, buildBarcodeLabels, getEan13Modules, isValidEan13 };
