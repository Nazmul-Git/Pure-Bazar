const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { Product } = require('../models');
const { generateEan13Barcode, isValidEan13 } = require('../utils/productIdentifiers');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

function prepareProductBarcodeUpdates(products, createBarcode = generateEan13Barcode) {
  const usedBarcodes = new Set(products.map(({ barcode }) => barcode).filter(Boolean));
  const reservedBarcodes = new Set();
  const updates = [];

  function nextBarcode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const barcode = createBarcode();
      if (!isValidEan13(barcode)) {
        throw new Error('Barcode generator returned an invalid EAN-13 number');
      }
      if (!usedBarcodes.has(barcode) && !reservedBarcodes.has(barcode)) return barcode;
    }
    throw new Error('Unable to generate a unique product barcode');
  }

  products.forEach((product) => {
    if (isValidEan13(product.barcode)) return;
    const barcode = nextBarcode();
    reservedBarcodes.add(barcode);
    updates.push({ id: product._id, barcode });
  });

  return updates;
}

async function migrateProductBarcodes() {
  const products = await Product.find().select('_id barcode').sort({ _id: 1 }).lean();
  const updates = prepareProductBarcodeUpdates(products);
  if (!updates.length) return { scanned: products.length, updated: 0 };

  const result = await Product.bulkWrite(updates.map(({ id, barcode }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { barcode } },
    },
  })), { ordered: true, runValidators: true });

  return { scanned: products.length, updated: result.modifiedCount };
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Pass --apply to regenerate legacy product barcodes in the configured database');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await connectDB(process.env.MONGODB_URI);
  const result = await migrateProductBarcodes();
  console.log(`Product barcode migration complete: ${JSON.stringify(result)}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Product barcode migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
}

module.exports = { prepareProductBarcodeUpdates, migrateProductBarcodes };
