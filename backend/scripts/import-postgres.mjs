import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { MongoClient } from 'mongodb';
import { neon } from '@neondatabase/serverless';

if (!process.argv[2]) throw new Error('Provide the private production environment file path.');
const production = parse(await readFile(process.argv[2]));
const backend = parse(await readFile(new URL('../.env', import.meta.url)));
if (!production.DATABASE_URL || !backend.MONGODB_URI) throw new Error('Both databases must be configured.');
const sql = neon(production.DATABASE_URL);
const mongo = new MongoClient(backend.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await mongo.connect();
try {
  const db = mongo.db(backend.MONGODB_DB || 'digital_samiti');
  const groups = db.collection('samiti_groups');
  const sessions = db.collection('samiti_guest_sessions');
  let cursor = '';
  let copiedGroups = 0;
  let copiedSessions = 0;
  // Insert only. Existing MongoDB ledgers must never be overwritten by an import.
  while (true) {
    const rows = await sql.query('SELECT id, data, version, created_at FROM samiti_groups WHERE id > $1 ORDER BY id LIMIT 100', [cursor]);
    if (!rows.length) break;
    const operations = rows.map(row => ({ updateOne: {
      filter: { _id: row.id },
      update: { $setOnInsert: {
        group: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        version: Number(row.version), createdAt: new Date(row.created_at),
      } }, upsert: true,
    } }));
    await groups.bulkWrite(operations, { ordered: true });
    for (const row of rows) {
      const stored = await groups.findOne({ _id: row.id });
      const expected = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (!stored || JSON.stringify(stored.group) !== JSON.stringify(expected)) {
        throw new Error('An existing MongoDB group differs from Postgres. Reconcile it before switching production.');
      }
    }
    copiedGroups += rows.length;
    cursor = rows.at(-1).id;
  }
  cursor = '';
  while (true) {
    const rows = await sql.query('SELECT token_hash, user_id, expires_at FROM samiti_guest_sessions WHERE expires_at > now() AND token_hash > $1 ORDER BY token_hash LIMIT 100', [cursor]);
    if (!rows.length) break;
    await sessions.bulkWrite(rows.map(row => ({ updateOne: {
      filter: { _id: row.token_hash },
      update: { $setOnInsert: { userId: row.user_id, expiresAt: new Date(row.expires_at) } },
      upsert: true,
    } })));
    copiedSessions += rows.length;
    cursor = rows.at(-1).token_hash;
  }
  for await (const owner of groups.aggregate([{ $group: { _id: '$group.owner', count: { $sum: 1 } } }])) {
    await db.collection('samiti_owners').updateOne({ _id: owner._id }, { $max: { groups: owner.count } }, { upsert: true });
  }
  console.log(`Verified ${copiedGroups} copied groups and retained ${copiedSessions} unexpired guest sessions. Source data is preserved.`);
} catch (error) {
  console.error('Data import failed.', error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
} finally { await mongo.close(); }
