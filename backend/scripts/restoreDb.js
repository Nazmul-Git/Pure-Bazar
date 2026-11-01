require('dotenv').config();
const { restoreDatabase } = require('../utils/dbBackup');

// Usage: node scripts/restoreDb.js <backup-file> <target-mongodb-uri> [--drop]
// The target must be an empty database unless --drop is given.
async function main() {
  const [file, uri] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!file || !uri) {
    console.error('Usage: node scripts/restoreDb.js <backup-file> <target-mongodb-uri> [--drop]');
    process.exit(2);
  }
  const result = await restoreDatabase(file, uri, { drop: process.argv.includes('--drop') });
  console.log(`Restored into database "${result.database}"`);
  for (const r of result.report) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.collection}: backup=${r.expected} restored=${r.actual}`);
  console.log(result.ok ? 'RESULT: all counts match' : 'RESULT: COUNT MISMATCH');
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`Restore FAILED: ${err.message}`);
  process.exit(1);
});
