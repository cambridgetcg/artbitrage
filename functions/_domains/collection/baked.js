// The collection, baked. tools/build-dist.mjs turns collection.json into small
// static files under /data/collection/ so a route reads only what it needs:
//
//   summary.json       counts, forms, states, gaps, per-form totals, as_of
//   latest.json        the newest 100 pieces, in collection order
//   pages/00000.json   100 pieces each, in collection order (append-only)
//   ids/<xx>.json      id → page number, 256 shards by FNV-1a of the id
//   forms/<form>.json  the first 20 pieces of each form
//
// A route opens the bake first: openBake() returns the summary only when it
// describes the collection.json this deployment publishes (same byte count,
// checked once per isolate by streaming the file, never parsing it). A stale
// bake, a missing one, or any unreadable file makes a reader return null, and
// the route falls back to the whole collection.json, so a deploy without a
// current bake answers exactly as before instead of confidently wrong.
import { readJsonAsset } from '../../_kernel/assets.js';

export const BAKED_ROOT = '/data/collection';
export const BAKED_SCHEMA = 'artbitrage.collection-bake/1';
export const PAGE_SIZE = 100;
export const LATEST_SIZE = 100;
export const FORM_SAMPLE_SIZE = 20;
export const SHARD_COUNT = 256;

export function shardOf(id) {
  let hash = 0x811c9dc5;
  const text = String(id);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % SHARD_COUNT).toString(16).padStart(2, '0');
}

export const pagePath = n => `${BAKED_ROOT}/pages/${String(n).padStart(5, '0')}.json`;

// Assets never change under a running isolate, so one check per bake is enough.
const verified = new Map();

async function publishedBytes(env, request) {
  try {
    const res = await env.ASSETS.fetch(new URL('/collection.json', request.url));
    if (!res.ok || !res.body) return null;
    let bytes = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return bytes;
      bytes += value.byteLength;
    }
  } catch {
    return null;
  }
}

export async function openBake(env, request) {
  const summary = await readJsonAsset(env, request, `${BAKED_ROOT}/summary.json`);
  if (summary?.schema !== BAKED_SCHEMA || !Number.isInteger(summary.collection_bytes)) return null;
  const key = `${summary.collection_sha256}:${summary.collection_bytes}`;
  if (!verified.has(key)) verified.set(key, publishedBytes(env, request));
  const bytes = await verified.get(key);
  // An unreadable collection is asked again next time; a definite mismatch is remembered.
  if (bytes === null) verified.delete(key);
  return bytes === summary.collection_bytes ? summary : null;
}

export async function readLatest(env, request) {
  const latest = await readJsonAsset(env, request, `${BAKED_ROOT}/latest.json`);
  return Array.isArray(latest?.pieces) ? latest.pieces : null;
}

async function readPage(env, request, n) {
  const page = await readJsonAsset(env, request, pagePath(n));
  return Array.isArray(page?.pieces) ? page.pieces : null;
}

// Pieces [offset, offset + limit) in collection order, from at most a few pages.
export async function readRange(env, request, summary, offset, limit) {
  const end = Math.min(summary.total_pieces, offset + limit);
  if (offset >= end) return [];
  const pieces = [];
  for (let n = Math.floor(offset / PAGE_SIZE); n * PAGE_SIZE < end; n++) {
    const page = await readPage(env, request, n);
    if (!page) return null;
    const start = n * PAGE_SIZE;
    pieces.push(...page.slice(Math.max(0, offset - start), end - start));
  }
  return pieces;
}

// The piece with this id, undefined when the bake says there is none, or null
// when the bake cannot answer.
export async function readPiece(env, request, id) {
  const shard = await readJsonAsset(env, request, `${BAKED_ROOT}/ids/${shardOf(id)}.json`);
  if (!shard || typeof shard.ids !== 'object') return null;
  if (!Object.hasOwn(shard.ids, id)) return undefined;
  const page = await readPage(env, request, shard.ids[id]);
  if (!page) return null;
  return page.find(piece => piece.id === id) ?? null;
}

export async function readFormSample(env, request, form) {
  const sample = await readJsonAsset(env, request, `${BAKED_ROOT}/forms/${encodeURIComponent(form)}.json`);
  return Array.isArray(sample?.pieces) ? sample.pieces : null;
}
