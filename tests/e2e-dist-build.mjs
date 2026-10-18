// dist/ is build output (node tools/build-dist.mjs). Whatever the cycle has
// done at the root since, the dist that would be deployed must agree with
// itself: the bake describes dist/collection.json exactly, every baked file
// is the one the build recorded, and no file is too large for Pages.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeCollection } from '../tools/build-dist.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
const sha256 = data => createHash('sha256').update(data).digest('hex');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    out.push(...(entry.isDirectory() ? await walk(full) : [full]));
  }
  return out;
}

// No file over Cloudflare Pages' 25 MiB limit.
for (const file of await walk(DIST)) {
  const { size } = await stat(file);
  assert.ok(size <= 25 * 1024 * 1024, `${file.slice(ROOT.length)} is ${size} bytes, over the Pages limit`);
}

if (!existsSync(join(DIST, 'data/collection/summary.json'))) {
  console.log('dist build e2e: no bake in dist yet (run node tools/build-dist.mjs); size limits checked');
  process.exit(0);
}

const collectionBytes = await readFile(join(DIST, 'collection.json'));
const collection = JSON.parse(collectionBytes.toString('utf8'));
const summary = JSON.parse(await readFile(join(DIST, 'data/collection/summary.json'), 'utf8'));
const build = JSON.parse(await readFile(join(DIST, '_build.json'), 'utf8'));

assert.equal(summary.collection_sha256, sha256(collectionBytes), 'the bake describes the collection dist publishes');
assert.equal(summary.total_pieces, collection.length);
assert.equal(build.collection.sha256, summary.collection_sha256);
assert.equal(build.collection.pieces, collection.length);

// Every baked file is exactly what the build would produce, and nothing else is there.
const expected = bakeCollection(collection, { collectionSha256: summary.collection_sha256 });
const onDisk = (await walk(join(DIST, 'data/collection'))).map(f => f.slice(DIST.length).split('\\').join('/'));
assert.deepEqual(onDisk.sort(), [...expected.keys()].sort(), 'the baked file set matches the collection');
for (const [path, text] of expected) {
  assert.equal(await readFile(join(DIST, path), 'utf8'), text, `${path} is current`);
  assert.equal(build.baked[path], sha256(text), `${path} is recorded in _build.json`);
}

console.log(`dist build e2e passed: ${collection.length} pieces, ${expected.size} baked files consistent with dist/collection.json and _build.json`);
