import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { MongoClient } from 'mongodb';
import { neon } from '@neondatabase/serverless';

const backend = parse(await readFile(new URL('../.env', import.meta.url)));
const frontend = parse(await readFile(new URL('../../.env.local', import.meta.url)));
const mongo = new MongoClient(backend.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const sql = neon(frontend.DATABASE_URL);
const names = ['Campus circle', 'Family & friends', 'The dream team'];
function generated(id, group) {
  const index = names.indexOf(group.name);
  return index >= 0 && group.id === id && id === `demo-${group.owner}-${index}` && !group.guestOnly;
}

await mongo.connect();
try {
  const db = mongo.db(backend.MONGODB_DB);
  const candidates = await db.collection('samiti_groups').find({ _id: { $regex: '^demo-' } }).toArray();
  const groups = candidates.filter(row => generated(row._id, row.group));
  const original = await sql.query("SELECT id, data, version FROM samiti_groups WHERE id LIKE 'demo-%'");
  const legacy = original.filter(row => generated(row.id, JSON.parse(row.data)));
  console.log(`Generated sample groups found: MongoDB ${groups.length}, legacy Postgres ${legacy.length}.`);
  if (!process.argv.includes('--apply')) {
    console.log('Dry run. Use --apply to remove only these generated sample groups.');
  } else {
    const backupDirectory = new URL('../../outputs/', import.meta.url);
    await mkdir(backupDirectory, { recursive: true });
    const name = `removed-seeds-${Date.now()}.json`;
    await writeFile(new URL(name, backupDirectory), JSON.stringify({ mongo: groups, postgres: legacy }, null, 2), { mode: 0o600 });
    await mongo.withSession(session => session.withTransaction(async () => {
      for (const row of groups) {
        const result = await db.collection('samiti_groups').deleteOne({ _id: row._id, version: row.version }, { session });
        if (result.deletedCount !== 1) throw new Error('A sample group changed during cleanup. Retry after reviewing it.');
      }
      for (const owner of new Set(groups.map(row => row.group.owner))) {
        const count = await db.collection('samiti_groups').countDocuments({ 'group.owner': owner }, { session });
        await db.collection('samiti_owners').updateOne({ _id: owner }, { $set: { groups: count } }, { session });
      }
    }));
    for (const row of legacy) {
      const result = await sql.query('DELETE FROM samiti_groups WHERE id = $1 AND version = $2 RETURNING id', [row.id, row.version]);
      if (result.length !== 1) throw new Error('A legacy sample group changed during cleanup. Review it before retrying.');
    }
    console.log(`Removed generated sample groups. Recovery copy saved privately in outputs/${name}. User-created groups were preserved.`);
  }
} finally { await mongo.close(); }
