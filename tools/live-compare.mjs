#!/usr/bin/env node
// Compare what artbitrage.io serves with a dist/ tree, byte for byte.
//
//   node tools/live-compare.mjs                 live vs ./dist (after a deploy: expect 0 differ)
//   node tools/live-compare.mjs --ref origin/main   live vs dist/ at that commit (before a deploy:
//                                               a difference means live holds something main does not)
//   --base URL   compare another origin (default https://artbitrage.io)
//
// Text files only (HTML, JSON, CSS, JS, TXT, XML), not the baked collection
// shards or images. Read-only GETs with a plain project User-Agent.
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const base = (opt('--base') || 'https://artbitrage.io').replace(/\/$/, '');
const ref = opt('--ref');
const TEXT = /\.(html|json|css|js|txt|xml|webmanifest|svg)$/;
const SKIP = /^(data\/collection\/|_build\.json$|functions\/)/;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    out.push(...(entry.isDirectory() ? await walk(full) : [full]));
  }
  return out;
}

async function expectedFiles() {
  if (ref) {
    const list = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'dist'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).map(p => p.slice('dist/'.length));
    return list.filter(p => TEXT.test(p) && !SKIP.test(p)).map(p => ({
      path: p,
      read: async () => execFileSync('git', ['show', `${ref}:dist/${p}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }),
    }));
  }
  const dist = join(ROOT, 'dist');
  return (await walk(dist)).map(f => relative(dist, f).split(sep).join('/'))
    .filter(p => TEXT.test(p) && !SKIP.test(p))
    .map(p => ({ path: p, read: () => readFile(join(dist, p)) }));
}

const files = await expectedFiles();
const results = { same: [], differ: [], missing: [] };
let next = 0;
async function worker() {
  while (next < files.length) {
    const file = files[next++];
    const urlPath = file.path === 'index.html' ? '/' : `/${file.path}`;
    try {
      const res = await fetch(base + urlPath, { headers: { 'User-Agent': 'Artbitrage live-compare (+https://artbitrage.io)' }, redirect: 'follow' });
      if (!res.ok) { results.missing.push(`${file.path} (HTTP ${res.status})`); continue; }
      const live = Buffer.from(await res.arrayBuffer());
      (live.equals(await file.read()) ? results.same : results.differ).push(file.path);
    } catch (error) {
      results.missing.push(`${file.path} (${error.message})`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

console.log(`${base} vs ${ref ? `dist at ${ref}` : './dist'}: ${results.same.length} same, ${results.differ.length} differ, ${results.missing.length} missing (of ${files.length} text files)`);
for (const p of results.differ.sort()) console.log(`  differ   ${p}`);
for (const p of results.missing.sort()) console.log(`  missing  ${p}`);
process.exit(results.differ.length || results.missing.length ? 1 : 0);
