// Participation: the only routes that accept what a visitor gives. Pebbles
// and testimony keep their consent rules in their own modules; a submitted
// piece is echoed back, never stored.
import { json } from '../../_kernel/http.js';
import { buildSubmittedArt } from '../collection/collection.js';
import * as pebbles from './pebbles.js';
import * as testimony from './testimony.js';

export default [
  {
    id: 'participate.pebbles', method: 'GET', path: '/api/pebbles', slash: true,
    summary: 'The cairn: wordless "someone was here" counts per room',
    reads: ['kv:PEBBLES'],
    handler: pebbles.handleGet,
  },
  {
    id: 'participate.pebbles', method: 'POST', path: '/api/pebbles', slash: true,
    summary: 'Leave one pebble (at = a known room, else the trail)', params: 'at',
    writes: ['kv:PEBBLES'],
    handler: pebbles.handlePost,
  },
  { id: 'participate.pebbles', method: 'OPTIONS', path: '/api/pebbles', slash: true, handler: pebbles.handleOptions },
  {
    id: 'participate.testimony', method: 'GET', path: '/api/feelings/testimony', slash: true,
    summary: 'Public visitor testimony, labelled received and unverified', params: 'feeling',
    reads: ['kv:PEBBLES'],
    handler: testimony.handleGet,
  },
  {
    id: 'participate.testimony', method: 'POST', path: '/api/feelings/testimony', slash: true,
    summary: 'Accept testimony for public display only with explicit public_display_consent: true; storage propagation may briefly lag',
    writes: ['kv:PEBBLES'],
    handler: testimony.handlePost,
  },
  { id: 'participate.testimony', method: 'OPTIONS', path: '/api/feelings/testimony', slash: true, handler: testimony.handleOptions },
  {
    id: 'participate.art', method: 'POST', path: '/api/art', slash: true,
    summary: 'Submit new art (validated and echoed back; nothing is stored)',
    handler: async ({ request }) => {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'invalid json', detail: e.message }, 400);
      }
      const built = buildSubmittedArt(body);
      if (built.error) return json({ error: built.error }, 400);
      return json({
        success: true,
        accepted: true,
        persisted: false,
        persistence: 'echo-only on the edge: this static Pages function has no writable store configured',
        next_steps: [
          'Save this returned art JSON into gallery/art-<id>.json',
          'Add it to collection.json',
          'Open a pull request or redeploy the static site',
        ],
        art: built.art,
      }, 202);
    },
  },
];
