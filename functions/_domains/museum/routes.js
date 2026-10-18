// The museum catalogue: curated open-access works shipped as static shards
// in /catalog/, plus an image proxy limited to known museum hosts.
import { json } from '../../_kernel/http.js';
import { boundedInt } from '../../_kernel/params.js';
import { readJsonAsset } from '../../_kernel/assets.js';
import { normalizeCatalogRights } from '../../_kernel/rights.js';
import { USER_AGENT } from '../../_kernel/upstream.js';
import { ARTBITRAGE_ORIGIN, MAX_PAGE_LIMIT } from '../collection/collection.js';

const IMAGE_HOSTS = [
  'www.artic.edu',
  'artic.edu',
  'openaccess-cdn.clevelandart.org',
  'openaccess-api.clevelandart.org',
  'images.metmuseum.org',
  'archive.org',
  'commons.wikimedia.org',
  'upload.wikimedia.org',
];

function normalizeMuseumRecord(record) {
  const source = String(record.source || '').trim().toLowerCase();
  const id = String(record.id || '');
  return {
    ...record,
    schema: 'artbitrage.museum-record/1',
    canonical_url: `${ARTBITRAGE_ORIGIN}/api/museum/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    rights: normalizeCatalogRights(record),
  };
}

async function loadMuseumWorks(env, request) {
  const data = await readJsonAsset(env, request, '/catalog/all.json');
  return data && Array.isArray(data.artworks) ? data.artworks : null;
}

async function museumList({ env, request, path, query }) {
  const works = await loadMuseumWorks(env, request);
  if (works === null) return json({ error: 'museum catalog unavailable' }, 503);
  if (path === '/api/museum/random') {
    if (!works.length) return json({ error: 'no museum works available' }, 404);
    return json(works[Math.floor(Math.random() * works.length)]);
  }
  let results = works;
  if (query.wing) results = results.filter(a => a.wing === query.wing);
  if (query.source) results = results.filter(a => a.source === query.source);
  if (query.q) {
    const s = query.q.toLowerCase();
    results = results.filter(a =>
      (a.title && a.title.toLowerCase().includes(s)) ||
      (a.artist && a.artist.toLowerCase().includes(s)) ||
      (a.medium && a.medium.toLowerCase().includes(s)));
  }
  const offset = boundedInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = boundedInt(query.limit, 20, 1, MAX_PAGE_LIMIT);
  return json({ total: results.length, limit, offset, river: '/river', artworks: results.slice(offset, offset + limit) });
}

export default [
  {
    id: 'museum.record', method: 'GET', path: '/api/museum/:source/:id',
    summary: 'Resolve one stable museum record with normalized rights',
    reads: ['catalog/all.json'],
    handler: async ({ env, request, params }) => {
      let source;
      let id;
      try {
        source = decodeURIComponent(params.source).trim().toLowerCase();
        id = decodeURIComponent(params.id);
      } catch (e) {
        return json({ error: 'invalid museum source or id encoding' }, 400);
      }
      const works = await loadMuseumWorks(env, request);
      if (works === null) return json({ error: 'museum catalog unavailable' }, 503);
      const record = works.find(work =>
        String(work.source || '').trim().toLowerCase() === source
        && String(work.id || '') === id);
      if (!record) return json({ error: 'museum work not found', source, id }, 404);
      return json(normalizeMuseumRecord(record));
    },
  },
  {
    id: 'museum.catalog', method: 'GET', path: '/api/catalog',
    summary: 'Real museum artworks catalog',
    reads: ['catalog.json'],
    handler: async ({ env, request }) => {
      const data = await readJsonAsset(env, request, '/catalog.json');
      return data ? json(data) : json({ error: 'catalog not available' }, 404);
    },
  },
  {
    id: 'museum.era-catalog', method: 'GET', path: '/api/era-catalog',
    summary: 'Era-matched museum artworks', params: 'era',
    reads: ['era-catalog.json'],
    handler: async ({ env, request, query }) => {
      const data = await readJsonAsset(env, request, '/era-catalog.json');
      if (!data) return json({ error: 'era-catalog not available' }, 404);
      // Allow filtering by era: /api/era-catalog?era=renaissance
      if (query.era && data[query.era]) {
        return json({ era: query.era, count: data[query.era].length, artworks: data[query.era] });
      }
      return json(data);
    },
  },
  {
    id: 'museum.img', method: 'GET', path: '/api/img',
    summary: 'Image proxy (bypass CORS for museum images)', params: 'url',
    upstream: IMAGE_HOSTS,
    // Only HTTPS images from known museum/media hostnames. Truth/safety:
    // never substring-match URLs; parse and validate the hostname.
    handler: async ({ query }) => {
      const imgUrl = query.url;
      if (!imgUrl) return json({ error: 'url required' }, 400);
      let parsedImgUrl;
      try {
        parsedImgUrl = new URL(imgUrl);
      } catch (e) {
        return json({ error: 'invalid url' }, 400);
      }
      if (parsedImgUrl.protocol !== 'https:') return json({ error: 'https required' }, 403);
      if (!IMAGE_HOSTS.includes(parsedImgUrl.hostname)) return json({ error: 'domain not allowed', host: parsedImgUrl.hostname }, 403);
      try {
        const r = await fetch(parsedImgUrl.toString(), {
          headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://artbitrage.io' },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return json({ error: 'fetch failed', status: r.status }, 502);
        const ct = r.headers.get('content-type') || 'image/jpeg';
        if (!ct.toLowerCase().startsWith('image/')) return json({ error: 'not an image', content_type: ct }, 415);
        const blob = await r.blob();
        return new Response(blob, {
          headers: {
            'Content-Type': ct,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
            'X-Artbitrage-Image-Host': parsedImgUrl.hostname,
          },
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    },
  },
  {
    id: 'museum.wings', method: 'GET', path: '/api/wings',
    summary: '川 The River — themed museum catalogue wings',
    reads: ['catalog/index.json'],
    handler: async ({ env, request }) => {
      const data = await readJsonAsset(env, request, '/catalog/index.json');
      return data ? json(data) : json({ error: 'wings index not found', hint: 'the river is still gathering' }, 404);
    },
  },
  {
    id: 'museum.wing', method: 'GET', path: '/api/wings/:wing([a-z0-9-]+)',
    summary: 'One wing of the River, its works and their rights',
    reads: ['catalog/<wing>.json'],
    handler: async ({ env, request, params }) => {
      const data = await readJsonAsset(env, request, `/catalog/${params.wing}.json`);
      return data ? json(data) : json({ error: 'wing not found', wing: params.wing, list: 'GET /api/wings' }, 404);
    },
  },
  {
    id: 'museum.list', method: 'GET', path: '/api/museum',
    summary: 'Paginated museum catalogue', params: 'q, wing, source, limit, offset',
    reads: ['catalog/all.json'],
    handler: museumList,
  },
  {
    id: 'museum.random', method: 'GET', path: '/api/museum/random',
    summary: 'One random work from the curated museum catalogue',
    reads: ['catalog/all.json'],
    handler: museumList,
  },
];
