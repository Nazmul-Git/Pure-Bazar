const {
  ean13CheckDigit, generateEan13Barcode, isValidEan13,
} = require('../utils/productIdentifiers');
const { prepareProductBarcodeUpdates } = require('../scripts/migrateProductBarcodes');

describe('product barcode identifiers', () => {
  it('generates numeric EAN-13 barcodes with a valid check digit', () => {
    const barcode = generateEan13Barcode();

    expect(barcode).toMatch(/^\d{13}$/);
    expect(isValidEan13(barcode)).toBe(true);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  it('migrates legacy barcodes while preserving already-valid EAN-13 barcodes', () => {
    const generatedBarcode = '2000000000015';
    const generateBarcode = jest.fn(() => generatedBarcode);
    const updates = prepareProductBarcodeUpdates([
      { _id: 'legacy', barcode: 'PB6AD34C028662EC73AC50D9BE' },
      { _id: 'valid', barcode: '4006381333931' },
    ], generateBarcode);

    expect(updates).toEqual([{ id: 'legacy', barcode: generatedBarcode }]);
    expect(generateBarcode).toHaveBeenCalledTimes(1);
  });

  it('avoids barcode collisions with existing products', () => {
    const occupied = '2000000000015';
    const available = '2000000000022';
    const generateBarcode = jest.fn()
      .mockReturnValueOnce(occupied)
      .mockReturnValueOnce(available);
    const updates = prepareProductBarcodeUpdates([
      { _id: 'legacy', barcode: 'OLD-BARCODE' },
      { _id: 'existing', barcode: occupied },
    ], generateBarcode);

    expect(updates).toEqual([{ id: 'legacy', barcode: available }]);
    expect(generateBarcode).toHaveBeenCalledTimes(2);
  });
});
