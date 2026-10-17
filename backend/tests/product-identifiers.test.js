const {
  ean13CheckDigit, generateEan13Barcode, generateSku, isValidEan13,
} = require('../utils/productIdentifiers');
const { prepareProductIdentifierUpdates } = require('../scripts/migrateProductIdentifiers');

function ean13(body) {
  return `${body}${ean13CheckDigit(body)}`;
}

describe('product identifiers', () => {
  it('generates numeric EAN-13 barcodes with a valid check digit', () => {
    const barcode = generateEan13Barcode();

    expect(barcode).toMatch(/^\d{13}$/);
    expect(isValidEan13(barcode)).toBe(true);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(generateSku(barcode)).toBe(`PB-${barcode}`);
  });

  it('migrates legacy barcodes and missing SKUs without changing existing valid identifiers', () => {
    const validBarcode = '4006381333931';
    const generatedBarcode = ean13('200000000001');
    const products = [
      { _id: 'legacy', barcode: 'PB6AD34C028662EC73AC50D9BE' },
      { _id: 'missing-sku', barcode: validBarcode, sku: '' },
      { _id: 'complete', barcode: '5901234123457', sku: 'CUSTOM-1' },
    ];
    const generateBarcode = jest.fn(() => generatedBarcode);

    const updates = prepareProductIdentifierUpdates(products, generateBarcode);

    expect(updates).toEqual([
      { id: 'legacy', barcode: generatedBarcode, sku: `PB-${generatedBarcode}` },
      { id: 'missing-sku', barcode: validBarcode, sku: `PB-${validBarcode}` },
    ]);
  });

  it('avoids collisions with existing barcode and SKU values during migration', () => {
    const occupied = ean13('200000000001');
    const available = ean13('200000000002');
    const unoccupied = ean13('200000000003');
    const generateBarcode = jest.fn()
      .mockReturnValueOnce(occupied)
      .mockReturnValueOnce(available)
      .mockReturnValueOnce(unoccupied);

    const updates = prepareProductIdentifierUpdates([
      { _id: 'legacy', barcode: 'OLD-BARCODE' },
      { _id: 'existing-barcode', barcode: occupied, sku: 'CUSTOM-1' },
      { _id: 'existing-sku', barcode: ean13('300000000001'), sku: `PB-${available}` },
    ], generateBarcode);

    expect(updates[0]).toEqual({
      id: 'legacy',
      barcode: unoccupied,
      sku: `PB-${unoccupied}`,
    });
    expect(generateBarcode).toHaveBeenCalledTimes(3);
  });
});
