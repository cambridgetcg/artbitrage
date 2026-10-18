// A small stand-in for a Cloudflare D1 binding, backed by Node's built-in
// SQLite, so budget SQL runs for real in tests: prepare(sql).bind(...).first()
// / .run() / .all(), with ?1-style positional parameters.
import { DatabaseSync } from 'node:sqlite';

export function sqliteD1() {
  const db = new DatabaseSync(':memory:');
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { db.prepare(sql).run(...args); return { success: true }; },
    async all() { return { results: db.prepare(sql).all(...args), success: true }; },
  });
  return { prepare: sql => statement(sql), _db: db };
}
