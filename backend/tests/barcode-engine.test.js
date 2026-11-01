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
    expect(output.tspl).toContain('BARCODE 105,62,"EAN13",60,1,0,2,2,"4006381333931"');
    expect(output.tspl).toContain('TEXT 20,180,"0",0,1,1,"BDT 125.50"');
    expect(escPos.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(escPos).toContain(0x1d);
    const ean13Command = [0x1d, 0x6b, 0x43, 0x0c, ...'400638133393'.split('').map((digit) => digit.charCodeAt(0))];
    expect(escPos.join(',')).toContain(ean13Command.join(','));
    expect(getEan13Modules(product.barcode)).toHaveLength(95);
  });

  it('appends the unit to the name and prints the unit price with a struck original price', () => {
    const { getUnitOptions } = require('../../frontend/src/services/barcodeUnits');
    const egg = { name: 'Egg', barcode: '4006381333931', mrp: 120, unitsPerPackage: 12, subUnitPrice: 11, packageUnitName: 'Dozen' };
    expect(getUnitOptions(egg).map((o) => [o.name, o.price])).toEqual([['Dozen', 120], ['Pcs', 11]]);
    const output = buildBarcodeLabels([{ ...egg, unitName: 'Pcs', price: 11, originalPrice: 12 }], 'price');
    expect(output.labels[0]).toMatchObject({ name: 'Egg (Pcs)', price: '11.00', originalPrice: '12.00' });
    expect(output.tspl).toContain('"Egg (Pcs)"');
    expect(output.tspl).toContain('BAR 20,168');
    expect(() => buildBarcodeLabels([{ ...egg, price: 11, originalPrice: 10 }], 'price')).toThrow('must be higher');
  });

  it('offers Kg and Gram pricing for weight-based products', () => {
    const { getUnitOptions } = require('../../frontend/src/services/barcodeUnits');
    const rice = { name: 'Loose Rice', barcode: '4006381333931', mrp: 80, unitValue: 1000, packageUnitName: 'Gram' };
    expect(getUnitOptions(rice).map((o) => [o.value, o.name, o.price])).toEqual([['kg', 'Kg', 80], ['gram', 'Gram', 0.08]]);
    const output = buildBarcodeLabels([{ ...rice, unitName: 'Kg', price: 80 }], 'price');
    expect(output.labels[0]).toMatchObject({ name: 'Loose Rice (Kg)', price: '80.00' });
  });

  it('rejects invalid EAN-13 values and out-of-range batch quantities', () => {
    expect(() => buildBarcodeLabels([{ ...product, barcode: '123' }])).toThrow('valid EAN-13');
    expect(() => buildBarcodeLabels([{ ...product, copies: 501 }])).toThrow('from 1 to 500');
  });
});
