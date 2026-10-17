const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { Product } = require('../models');
const {
  generateEan13Barcode, generateSku, isValidEan13,
} = require('../utils/productIdentifiers');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

function prepareProductIdentifierUpdates(products, createBarcode = generateEan13Barcode) {
  const usedBarcodes = new Set(products.map(({ barcode }) => barcode).filter(Boolean));
  const usedSkus = new Set(products.map(({ sku }) => sku?.trim()).filter(Boolean));
  const reservedBarcodes = new Set();
  const reservedSkus = new Set();
  const updates = [];

  function nextBarcode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const barcode = createBarcode();
      if (!isValidEan13(barcode)) {
        throw new Error('Barcode generator returned an invalid EAN-13 number');
      }
      const sku = generateSku(barcode);
      if (!usedBarcodes.has(barcode) && !reservedBarcodes.has(barcode)
        && !usedSkus.has(sku) && !reservedSkus.has(sku)) {
        return barcode;
      }
    }
    throw new Error('Unable to generate a unique product barcode and SKU');
  }

  products.forEach((product) => {
    let barcode = product.barcode;
    let sku = product.sku?.trim();
    const needsBarcode = !isValidEan13(barcode);

    if (needsBarcode) barcode = nextBarcode();
    if (!sku && usedSkus.has(generateSku(barcode))) barcode = nextBarcode();
    if (!sku) sku = generateSku(barcode);

    if (needsBarcode || sku !== product.sku) {
      reservedBarcodes.add(barcode);
      reservedSkus.add(sku);
      updates.push({ id: product._id, barcode, sku });
    }
  });

  return updates;
}

async function migrateProductIdentifiers() {
  const products = await Product.find().select('_id barcode sku').sort({ _id: 1 }).lean();
  const updates = prepareProductIdentifierUpdates(products);
  if (!updates.length) return { scanned: products.length, updated: 0 };

  const result = await Product.bulkWrite(updates.map(({ id, barcode, sku }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { barcode, sku } },
    },
  })), { ordered: true, runValidators: true });

  return { scanned: products.length, updated: result.modifiedCount };
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Pass --apply to regenerate product identifiers in the configured database');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await connectDB(process.env.MONGODB_URI);
  const result = await migrateProductIdentifiers();
  console.log(`Product identifier migration complete: ${JSON.stringify(result)}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Product identifier migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
}

module.exports = { prepareProductIdentifierUpdates, migrateProductIdentifiers };
