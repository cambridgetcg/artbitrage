#!/usr/bin/env node
// Build dist/ for `wrangler pages deploy dist`.
//
//   node tools/build-dist.mjs            sync, bake, write dist/_build.json
//   node tools/build-dist.mjs --check    say what a build would change; exit 1 if dist is stale
//
// 1. Sync: every file dist/ already publishes that also exists at the repo
//    root is copied from the root when it differs (in practice: the cycle's
//    collection.json and artbitrage-state.json; rooms are kept identical by
//    their own tests). A new root file is not published until it is copied
//    into dist/ once. Files that live only in dist/ (art/, llms.txt, …) stay.
// 2. Bake: dist/collection.json → dist/data/collection/ (see
//    functions/_domains/collection/baked.js for the layout and who reads it).
// 3. Record: dist/_build.json names the source commit, the collection's
//    hash and size, and the hash of every baked file.
//
// No network, no secrets. Functions are not copied: wrangler compiles the
// root functions/ directory.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BAKED_ROOT, BAKED_SCHEMA, FORM_SAMPLE_SIZE, LATEST_SIZE, PAGE_SIZE, SHARD_COUNT, pagePath, shardOf,
} from '../functions/_domains/collection/baked.js';
import { getStats } from '../functions/_domains/collection/collection.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
const BAKED_DIR = join(DIST, BAKED_ROOT);
const BUILD_FILE = join(DIST, '_build.json');
// Cloudflare Pages refuses any single file over 25 MiB.
const PAGES_FILE_LIMIT = 25 * 1024 * 1024;
const SAFE_FORM = /^[a-z0-9-]+$/;

const sha256 = data => createHash('sha256').update(data).digest('hex');

// Newest creation time as RFC 3339 UTC, reading offset-less engine times as UTC
// the same way the feed does.
function newestCreated(pieces) {
  let newest = null;
  for (const piece of pieces) {
    const raw = typeof piece.created === 'string' ? piece.created.trim() : '';
    if (!raw) continue;
    const zoned = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`;
    const t = Date.parse(zoned.replace(/(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:\d{2})$)/i, '$1'));
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  }
  return newest === null ? null : new Date(newest).toISOString();
}

// The baked files for one collection, as a Map of path (under the site root) → JSON text.
export function bakeCollection(pieces, { collectionSha256, collectionBytes }) {
  if (!Array.isArray(pieces)) throw new Error('collection must be a JSON array');
  const files = new Map();
  const put = (path, value) => files.set(path, JSON.stringify(value));
  const pageCount = Math.ceil(pieces.length / PAGE_SIZE);

  // Null-prototype maps: a form or id named like a built-in ('constructor',
  // '__proto__') is just another key.
  const formTotals = Object.create(null);
  const formSamples = Object.create(null);
  for (const piece of pieces) {
    if (typeof piece.form !== 'string' || !piece.form) continue;
    formTotals[piece.form] = (formTotals[piece.form] || 0) + 1;
    if (SAFE_FORM.test(piece.form)) {
      const sample = (formSamples[piece.form] ||= []);
      if (sample.length < FORM_SAMPLE_SIZE) sample.push(piece);
    }
  }

  put(`${BAKED_ROOT}/summary.json`, {
    schema: BAKED_SCHEMA,
    collection_sha256: collectionSha256,
    collection_bytes: collectionBytes,
    as_of: newestCreated(pieces),
    total_pieces: pieces.length,
    page_size: PAGE_SIZE,
    pages: pageCount,
    stats: getStats(pieces),
    forms_list: [...new Set(pieces.map(a => a.form).filter(Boolean))].sort(),
    gaps_list: [...new Set(pieces.map(a => a.gap).filter(Boolean))].sort(),
    form_totals: formTotals,
    baked_forms: Object.keys(formSamples).sort(),
  });
  put(`${BAKED_ROOT}/latest.json`, { schema: BAKED_SCHEMA, pieces: pieces.slice(-LATEST_SIZE) });
  for (let n = 0; n < pageCount; n++) {
    put(pagePath(n), { schema: BAKED_SCHEMA, page: n, offset: n * PAGE_SIZE, pieces: pieces.slice(n * PAGE_SIZE, (n + 1) * PAGE_SIZE) });
  }
  const shards = Array.from({ length: SHARD_COUNT }, () => Object.create(null));
  pieces.forEach((piece, index) => {
    if (typeof piece.id !== 'string') return;
    const shard = shards[parseInt(shardOf(piece.id), 16)];
    // The first piece with an id wins, as a lookup through the whole collection would.
    if (!Object.hasOwn(shard, piece.id)) shard[piece.id] = Math.floor(index / PAGE_SIZE);
  });
  shards.forEach((ids, n) => put(`${BAKED_ROOT}/ids/${n.toString(16).padStart(2, '0')}.json`, { schema: BAKED_SCHEMA, ids }));
  for (const [form, sample] of Object.entries(formSamples)) {
    put(`${BAKED_ROOT}/forms/${form}.json`, { schema: BAKED_SCHEMA, form, total: formTotals[form], pieces: sample });
  }
  return files;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

async function readIfExists(path) {
  try { return await readFile(path); } catch { return null; }
}

function sourceCommit() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'collection.json', 'artbitrage-state.json'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
    return { sha, collection_uncommitted: dirty };
  } catch {
    return { sha: null, collection_uncommitted: null };
  }
}

async function plan() {
  const changes = [];
  // 1. Sync what dist already publishes.
  for (const file of await walk(DIST)) {
    const rel = relative(DIST, file).split(sep).join('/');
    if (rel.startsWith(`${BAKED_ROOT.slice(1)}/`) || rel === '_build.json') continue;
    const source = await readIfExists(join(ROOT, rel));
    if (!source) continue;
    const current = await readFile(file);
    if (!source.equals(current)) changes.push({ kind: 'sync', rel, bytes: source });
  }
  // 2. Bake from the collection dist will publish.
  const synced = changes.find(c => c.rel === 'collection.json');
  const collectionBytes = synced ? synced.bytes : await readFile(join(DIST, 'collection.json'));
  const collectionSha256 = sha256(collectionBytes);
  const baked = bakeCollection(JSON.parse(collectionBytes.toString('utf8')), { collectionSha256, collectionBytes: collectionBytes.length });
  let bakedOnDisk = [];
  try { bakedOnDisk = (await walk(BAKED_DIR)).map(f => '/' + relative(DIST, f).split(sep).join('/')); } catch {}
  for (const [path, text] of baked) {
    const current = await readIfExists(join(DIST, path));
    if (!current || current.toString('utf8') !== text) changes.push({ kind: 'bake', rel: path.slice(1), bytes: Buffer.from(text) });
  }
  for (const path of bakedOnDisk) if (!baked.has(path)) changes.push({ kind: 'remove', rel: path.slice(1) });
  return { changes, baked, collectionBytes, collectionSha256 };
}

async function main() {
  const check = process.argv.includes('--check');
  const { changes, baked, collectionBytes, collectionSha256 } = await plan();
  const synced = changes.filter(c => c.kind === 'sync').map(c => c.rel);
  const bakedChanged = changes.filter(c => c.kind === 'bake').length;
  const removed = changes.filter(c => c.kind === 'remove').length;
  const pieces = JSON.parse(collectionBytes.toString('utf8')).length;

  for (const c of changes) {
    if (c.bytes && c.bytes.length > PAGES_FILE_LIMIT) {
      throw new Error(`${c.rel} is ${(c.bytes.length / 1048576).toFixed(1)} MiB; Cloudflare Pages refuses files over 25 MiB`);
    }
  }
  if (collectionBytes.length > PAGES_FILE_LIMIT * 0.8) {
    console.warn(`warning: collection.json is ${(collectionBytes.length / 1048576).toFixed(1)} MiB, within 20% of the 25 MiB Pages limit`);
  }

  const summary = `${synced.length} synced (${synced.join(', ') || 'none'}), ${bakedChanged} baked files changed, ${removed} removed; collection ${pieces} pieces`;
  if (check) {
    console.log(changes.length ? `dist is stale: ${summary}` : `dist is current: collection ${pieces} pieces`);
    process.exit(changes.length ? 1 : 0);
  }

  for (const c of changes) {
    const target = join(DIST, c.rel);
    if (c.kind === 'remove') { await rm(target); continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, c.bytes);
  }
  const record = {
    schema: 'artbitrage.build/1',
    built_at: new Date().toISOString(),
    source_commit: sourceCommit(),
    collection: { pieces, bytes: collectionBytes.length, sha256: collectionSha256 },
    baked: Object.fromEntries([...baked].map(([path, text]) => [path, sha256(text)]).sort(([a], [b]) => a.localeCompare(b))),
    note: 'Written by node tools/build-dist.mjs. Functions are compiled from the root functions/ directory at deploy time and are not part of dist/.',
  };
  await writeFile(BUILD_FILE, JSON.stringify(record, null, 1) + '\n');
  console.log(`dist built: ${summary}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(`build-dist failed: ${error.message}`);
    process.exit(1);
  });
}
