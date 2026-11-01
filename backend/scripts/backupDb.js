require('dotenv').config();
const path = require('path');
const { backupDatabase, pruneBackups } = require('../utils/dbBackup');

// Usage: node scripts/backupDb.js [--loop]   (--loop = run now, then every 24h)
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS) || 14;

  const { file, counts } = await backupDatabase(uri, dir);
  console.log(`Backup written: ${file}`);
  console.log(`Collections: ${Object.keys(counts).length}, documents: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  const removed = pruneBackups(dir, keepDays);
  if (removed.length) console.log(`Removed ${removed.length} backup(s) older than ${keepDays} days`);
}

async function main() {
  if (!process.argv.includes('--loop')) return run();
  for (;;) {
    try {
      await run();
    } catch (err) {
      console.error(`Backup FAILED: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 24 * 60 * 60 * 1000));
  }
}

main().catch((err) => {
  console.error(`Backup FAILED: ${err.message}`);
  process.exit(1);
});
