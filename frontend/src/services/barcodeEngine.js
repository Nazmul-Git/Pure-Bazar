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

// Truncates only the product name so the unit suffix always survives the 40-char limit.
// A custom package size/weight tag (e.g. "5 Kg") replaces the plain unit name.
function labelName(name, unitName, sizeTag) {
  const tag = safeText(sizeTag).trim();
  const plainUnit = safeText(unitName).trim();
  // A bare quantity such as "5" gets the selected unit appended ("5 Kg"); a tag with its own unit text is kept as typed.
  const unit = tag && /^[\d.,\s/x×-]+$/i.test(tag) && plainUnit ? `${tag} ${plainUnit}` : tag || plainUnit;
  if (!unit) return safeText(name);
  const suffix = ` (${unit})`.slice(0, 20);
  return `${safeText(name).slice(0, 40 - suffix.length).trimEnd()}${suffix}`;
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
    const unitName = String(item.unitName || '').trim();
    const price = labelType === 'price' ? formatPrice(item.price ?? item.mrp) : '';
    const hasOriginal = labelType === 'price' && item.originalPrice !== undefined && item.originalPrice !== null && item.originalPrice !== '';
    const originalPrice = hasOriginal ? formatPrice(item.originalPrice) : '';
    if (hasOriginal && Number(originalPrice) <= Number(price)) {
      throw new Error(`Original price for "${item.name}" must be higher than the selling price.`);
    }
    const label = {
      name: labelName(item.name, unitName, item.packageTag),
      barcode: String(item.barcode),
      price,
      originalPrice,
    };
    for (let copy = 0; copy < copies; copy += 1) labels.push(label);
  }
  return labels;
}

// Dimensions in mm; layout values are printer dots at 203 dpi (8 dots/mm).
const LABEL_SIZES = {
  '50x30': { key: '50x30', label: '50mm x 30mm', width: 50, height: 30, x: 20, brandY: 6, nameY: 36, barY: 62, barH: 60, origY: 160, priceY: 180, priceX: 20 },
  '38x25': { key: '38x25', label: '38mm x 25mm', width: 38, height: 25, x: 8, brandY: 4, nameY: 24, barY: 46, barH: 50, origY: 126, priceY: 150, priceX: 8 },
  '32x18': { key: '32x18', label: '32mm x 18mm', width: 32, height: 18, x: 6, brandY: 2, nameY: 18, barY: 34, barH: 32, origY: 108, priceY: 108, priceX: 130 },
};
const DEFAULT_LABEL_SIZE = '50x30';

function getLabelSize(sizeKey) {
  const size = LABEL_SIZES[sizeKey || DEFAULT_LABEL_SIZE];
  if (!size) throw new Error('Unsupported label size.');
  return size;
}

function buildTspl(labels, size) {
  const barX = Math.max(0, Math.round((size.width * 8 - 190) / 2));
  return labels.map(({ name, barcode, price, originalPrice }) => [
    `SIZE ${size.width} mm,${size.height} mm`,
    'GAP 2 mm,0 mm',
    'CLS',
    `TEXT ${size.x},${size.brandY},"${size.key === '50x30' ? '3' : '0'}",0,1,1,"${BRAND_NAME}"`,
    `TEXT ${size.x},${size.nameY},"0",0,1,1,"${name}"`,
    `BARCODE ${barX},${size.barY},"EAN13",${size.barH},1,0,2,2,"${barcode}"`,
    ...(originalPrice ? [
      `TEXT ${size.x},${size.origY},"0",0,1,1,"BDT ${originalPrice}"`,
      `BAR ${size.x},${size.origY + 8},${(originalPrice.length + 4) * 8},2`,
    ] : []),
    ...(price ? [`TEXT ${originalPrice ? size.priceX : size.x},${size.priceY},"0",0,1,1,"BDT ${price}"`] : []),
    'PRINT 1',
  ].join('\r\n')).join('\r\n');
}

function buildEscPos(labels) {
  const output = [0x1b, 0x40];
  const encoder = new TextEncoder();
  const appendText = (text) => output.push(...encoder.encode(text));
  labels.forEach(({ name, barcode, price, originalPrice }, index) => {
    output.push(0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01);
    appendText(`${BRAND_NAME}\n`);
    appendText(`${name}\n`);
    output.push(0x1b, 0x45, 0x00);
    if (originalPrice) {
      output.push(0x1b, 0x2d, 0x01);
      appendText(`BDT ${originalPrice}`);
      output.push(0x1b, 0x2d, 0x00);
      appendText('\n');
    }
    if (price) appendText(`BDT ${price}\n`);
    output.push(0x1d, 0x48, 0x02, 0x1d, 0x77, 0x02, 0x1d, 0x68, 0x50);
    output.push(0x1d, 0x6b, 0x43, 0x0c, ...encoder.encode(barcode.slice(0, 12)), 0x0a, 0x0a);
    if (index === labels.length - 1) output.push(0x1d, 0x56, 0x00);
  });
  return new Uint8Array(output);
}

function buildBarcodeLabels(items, labelType = 'price', sizeKey = DEFAULT_LABEL_SIZE) {
  const size = getLabelSize(sizeKey);
  const labels = normalizeLabels(items, labelType);
  return { labels, size, tspl: buildTspl(labels, size), escPos: buildEscPos(labels) };
}

module.exports = { BRAND_NAME, DEFAULT_LABEL_SIZE, LABEL_SIZES, buildBarcodeLabels, getEan13Modules, isValidEan13 };
