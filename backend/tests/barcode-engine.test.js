const { buildBarcodeLabels, getEan13Modules } = require('../../frontend/src/services/barcodeEngine');

describe('barcode label output', () => {
  const product = {
    name: 'Whole Grain Rice',
    barcode: '4006381333931',
    mrp: 125.5,
  };

  it('builds TSPL and ESC/POS output for each requested price label copy', () => {
    const output = buildBarcodeLabels([{ ...product, copies: 2 }], 'price');
    const escPos = Array.from(output.escPos);

    expect(output.labels).toHaveLength(2);
    expect(output.tspl.match(/PRINT 1/g)).toHaveLength(2);
    expect(output.tspl).toContain('TEXT 20,6,"3",0,1,1,"PureBazar"');
    expect(output.tspl).toContain('BARCODE 20,62,"EAN13",60,1,0,2,2,"4006381333931"');
    expect(output.tspl).toContain('TEXT 20,180,"0",0,1,1,"BDT 125.50"');
    expect(escPos.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(escPos).toContain(0x1d);
    const ean13Command = [0x1d, 0x6b, 0x43, 0x0c, ...'400638133393'.split('').map((digit) => digit.charCodeAt(0))];
    expect(escPos.join(',')).toContain(ean13Command.join(','));
    expect(getEan13Modules(product.barcode)).toHaveLength(95);
  });

  it('rejects invalid EAN-13 values and out-of-range batch quantities', () => {
    expect(() => buildBarcodeLabels([{ ...product, barcode: '123' }])).toThrow('valid EAN-13');
    expect(() => buildBarcodeLabels([{ ...product, copies: 501 }])).toThrow('from 1 to 500');
  });
});
