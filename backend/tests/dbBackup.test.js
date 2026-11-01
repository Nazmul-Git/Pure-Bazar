const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient, ObjectId } = require('mongodb');
const { backupDatabase, restoreDatabase, pruneBackups } = require('../utils/dbBackup');

describe('database backup and restore', () => {
  let mongod;
  let dir;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-backup-'));
  }, 120000);
  afterAll(async () => {
    await mongod.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('backs up, restores into a new database and counts match', async () => {
    const client = await MongoClient.connect(mongod.getUri('src_db'));
    const src = client.db('src_db');
    const id = new ObjectId();
    await src.collection('products').insertMany([
      { _id: id, sku: 'A1', price: 10.5, createdAt: new Date('2026-01-01T00:00:00Z') },
      { sku: 'B2', price: 3, ref: id }
    ]);
    await src.collection('products').createIndex({ sku: 1 }, { unique: true });
    await src.collection('users').insertOne({ name: 'x' });

    const { file, counts } = await backupDatabase(mongod.getUri('src_db'), dir);
    expect(counts).toEqual({ products: 2, users: 1 });

    const result = await restoreDatabase(file, mongod.getUri('restored_db'));
    expect(result.ok).toBe(true);

    const dst = client.db('restored_db');
    const doc = await dst.collection('products').findOne({ sku: 'A1' });
    expect(doc._id.equals(id)).toBe(true);
    expect(doc.createdAt).toBeInstanceOf(Date);
    const idx = await dst.collection('products').indexes();
    expect(idx.some((i) => i.name === 'sku_1' && i.unique)).toBe(true);

    await expect(restoreDatabase(file, mongod.getUri('restored_db'))).rejects.toThrow(/not empty/);
    await client.close();
  });

  it('prunes only old backups', () => {
    const old = path.join(dir, 'old.ndjson.gz');
    fs.writeFileSync(old, 'x');
    const removed = pruneBackups(dir, 14, Date.now() + 30 * 86400000);
    expect(removed).toContain('old.ndjson.gz');
  });
});
