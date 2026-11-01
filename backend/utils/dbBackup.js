const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { once } = require('events');
const { MongoClient, BSON } = require('mongodb');

const { EJSON } = BSON;

// Backup file = gzip of newline-delimited JSON. Line 1 manifest, then index and doc lines.
function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function write(stream, line) {
  if (!stream.write(`${line}\n`)) await once(stream, 'drain');
}

async function backupDatabase(uri, outDir) {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const db = client.db();
    const collections = (await db.listCollections({ type: 'collection' }).toArray())
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'))
      .sort();

    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${db.databaseName}-${timestamp()}.ndjson.gz`);
    const tmp = `${file}.part`;
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(tmp);
    gzip.pipe(out);

    const counts = {};
    for (const name of collections) counts[name] = await db.collection(name).countDocuments();
    await write(gzip, JSON.stringify({ type: 'manifest', database: db.databaseName, createdAt: new Date().toISOString(), counts }));

    for (const name of collections) {
      const indexes = (await db.collection(name).indexes()).filter((i) => i.name !== '_id_');
      await write(gzip, JSON.stringify({ type: 'indexes', c: name, indexes }));
      for await (const doc of db.collection(name).find({})) {
        await write(gzip, `${JSON.stringify({ type: 'doc', c: name })}\t${EJSON.stringify(doc, { relaxed: false })}`);
      }
    }

    gzip.end();
    await once(out, 'finish');
    fs.renameSync(tmp, file);
    return { file, counts };
  } finally {
    await client.close();
  }
}

async function restoreDatabase(file, uri, { drop = false } = {}) {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const db = client.db();
    const existing = (await db.listCollections().toArray()).filter((c) => !c.name.startsWith('system.'));
    if (existing.length && !drop) {
      throw new Error(`Target database "${db.databaseName}" is not empty. Use a new database name or pass --drop.`);
    }
    for (const c of existing) await db.collection(c.name).drop();

    const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let manifest = null;
    const indexLines = [];
    let batchName = null;
    let batch = [];
    const flush = async () => {
      if (batch.length) await db.collection(batchName).insertMany(batch, { ordered: true });
      batch = [];
    };

    for await (const line of rl) {
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab === -1) {
        const meta = JSON.parse(line);
        if (meta.type === 'manifest') manifest = meta;
        else if (meta.type === 'indexes') indexLines.push(meta);
        continue;
      }
      const { c } = JSON.parse(line.slice(0, tab));
      if (c !== batchName || batch.length >= 500) {
        await flush();
        batchName = c;
      }
      batch.push(EJSON.parse(line.slice(tab + 1), { relaxed: false }));
    }
    await flush();
    if (!manifest) throw new Error('Backup file is invalid: manifest missing.');

    for (const { c, indexes } of indexLines) {
      await db.createCollection(c).catch(() => {});
      for (const { v, ns, ...spec } of indexes) {
        const { key, ...options } = spec;
        await db.collection(c).createIndex(key, options);
      }
    }

    const report = [];
    for (const [name, expected] of Object.entries(manifest.counts)) {
      const actual = await db.collection(name).countDocuments();
      report.push({ collection: name, expected, actual, ok: expected === actual });
    }
    return { database: db.databaseName, report, ok: report.every((r) => r.ok) };
  } finally {
    await client.close();
  }
}

function pruneBackups(dir, keepDays, now = Date.now()) {
  const removed = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.ndjson.gz')) continue;
    const full = path.join(dir, name);
    if (now - fs.statSync(full).mtimeMs > keepDays * 86400000) {
      fs.unlinkSync(full);
      removed.push(name);
    }
  }
  return removed;
}

module.exports = { backupDatabase, restoreDatabase, pruneBackups };
