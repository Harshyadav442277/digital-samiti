import { neon } from '@neondatabase/serverless';
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error('Persistent database is not configured.');
  return neon(process.env.DATABASE_URL);
}
// A small adapter for the application's existing parameterized statement contract.
// These rewrites cover only the owned Samiti queries; no input is interpolated as SQL.
function postgresQuery(query: string) {
  let q = query.replace(/json_each\(samiti_groups.data, '\$\.members'\) AS m/g, "jsonb_array_elements(samiti_groups.data::jsonb->'members') AS m")
    .replace(/json_extract\(m.value, '\$\.id'\)/g, "m.value->>'id'")
    .replace(/json_each\(samiti_groups.data, '\$\.autoPay'\) AS p/g, "jsonb_each(COALESCE(samiti_groups.data::jsonb->'autoPay', '{}'::jsonb)) AS p")
    .replace(/json_extract\(p.value, '\$\.(status|nextDate)'\)/g, "p.value->>'$1'")
    .replace('ORDER BY rowid ASC', 'ORDER BY created_at ASC, id ASC');
  if (q.startsWith('INSERT OR IGNORE')) q = q.replace('INSERT OR IGNORE', 'INSERT') + ' ON CONFLICT DO NOTHING';
  let parameter = 0; return q.replace(/\?/g, () => `$${++parameter}`);
}
class Statement {
  constructor(private query: string, private values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.query, values); }
  async all<T = Record<string, unknown>>() { const rows = await sql().query(postgresQuery(this.query), this.values); return { results: rows as T[] }; }
  async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  async run() { const result = await sql().query(postgresQuery(this.query), this.values, { fullResults: true }); return { meta: { changes: result.rowCount ?? 0 } }; }
}
export type Database = { prepare: (query: string) => Statement };
export const database: Database = { prepare: query => new Statement(query) };
