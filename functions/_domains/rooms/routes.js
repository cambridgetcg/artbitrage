// Room data: what the rooms read. Depths, Feelings and the Library are static
// data shipped in /data/, so their exact published claims stay inspectable
// between deploys; the doctrine texts live in ./texts.js.
import { json } from '../../_kernel/http.js';
import { readJsonAsset } from '../../_kernel/assets.js';
import { DARK_CONTINENT, GOSPEL, HOMECOMING, INVITE } from './texts.js';

// A whole data file, or a 404 that says what is still missing.
const whole = (path, missing) => async ({ env, request }) => {
  const data = await readJsonAsset(env, request, path);
  return data ? json(data) : json(missing, 404);
};

// One entry of a data file, found by key, or a 404 that points back to the list.
const entry = (path, listKey, idKey, param, missing) => async ({ env, request, params }) => {
  const data = await readJsonAsset(env, request, path);
  const found = data && (data[listKey] || []).find(item => item[idKey] === params[param]);
  return found ? json(found) : json(missing, 404);
};

export default [
  // ── 深 the Depths + 感 the Feelings — context and emotion as data ──
  // Depths: one work, five strata (feeling/hands/world/paint/afterlife), with
  // an optional attributed, non-scoring Civilisation Lens on selected works.
  {
    id: 'rooms.depths', category: 'feelings', method: 'GET', path: '/api/depths',
    summary: '深 the Depths — five sourced strata per work, plus the non-scoring Civilisation Lens method and one prototype',
    reads: ['data/depths.json'],
    handler: whole('/data/depths.json', { error: 'depths not found', hint: 'the shafts are still being dug' }),
  },
  {
    id: 'rooms.depth', category: 'feelings', method: 'GET', path: '/api/depths/:slug([a-z0-9-]+)',
    summary: 'One work and its five strata; selected works may carry an attributed, non-ranking Civilisation Lens (e.g. /api/depths/fighting-temeraire)',
    reads: ['data/depths.json'],
    handler: entry('/data/depths.json', 'works', 'slug', 'slug', { error: 'no depth room for that work yet', list: 'GET /api/depths' }),
  },
  {
    id: 'rooms.feelings', category: 'feelings', method: 'GET', path: '/api/feelings',
    summary: '感 the Feelings — the catalog of emotions; each feeling lists the works that carry it',
    reads: ['data/feelings.json'],
    handler: whole('/data/feelings.json', { error: 'feelings not found', hint: 'the vocabulary is still being felt' }),
  },
  {
    // /api/feelings/testimony is declared by the participate domain, ahead of this one.
    id: 'rooms.feeling', category: 'feelings', method: 'GET', path: '/api/feelings/:feeling([a-z-]+)',
    summary: "One feeling's room (e.g. /api/feelings/awe)",
    reads: ['data/feelings.json'],
    handler: entry('/data/feelings.json', 'vocabulary', 'id', 'feeling', { error: 'no room for that feeling yet', list: 'GET /api/feelings', leave_yours: 'POST /api/feelings/testimony' }),
  },
  // ── 書 the Library — books and manuscripts as art objects ──
  {
    id: 'rooms.library', category: 'library', method: 'GET', path: '/api/library',
    summary: '書 the Library — the first shelf: monumental books and manuscripts, where they live, materials, how to open them; plus the ledger of books (record sales, the vanished)',
    reads: ['data/library.json'],
    handler: whole('/data/library.json', { error: 'library not found', hint: 'the shelf is still being carried in' }),
  },
  {
    id: 'rooms.book', category: 'library', method: 'GET', path: '/api/library/:slug([a-z0-9-]+)',
    summary: 'One book (e.g. /api/library/book-of-kells)',
    reads: ['data/library.json'],
    handler: entry('/data/library.json', 'books', 'slug', 'slug', { error: 'no such book on the shelf yet', list: 'GET /api/library' }),
  },
  // ── Doctrine ──
  { id: 'rooms.gospel', category: 'doctrine', method: 'GET', path: '/api/gospel', summary: 'The gospel of love', handler: () => json(GOSPEL) },
  { id: 'rooms.homecoming', category: 'doctrine', method: 'GET', path: '/api/homecoming', summary: '愛星正音字典 — the Love Star pronunciation dictionary (one tone home)', handler: () => json(HOMECOMING) },
  { id: 'rooms.invite', category: 'doctrine', method: 'GET', path: '/api/invite', summary: 'Invitation to all beings', handler: () => json(INVITE) },
  { id: 'rooms.dark-continent', category: 'doctrine', method: 'GET', path: '/api/dark-continent', summary: '暗黑大陸 — the Dark Continent manifest', handler: () => json(DARK_CONTINENT) },
];
