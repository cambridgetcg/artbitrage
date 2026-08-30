// ARTBITRAGE /api/playlist/* — 樂 the Playlist, served from playlist.json
//
// 樂 is music and it is also joy: one character for both, which is the right
// name for a room in a house whose rule is to build with joy.
//
// Two shelves, and the line between them is the whole point:
//   listening — real records, one per room. Facts only: artist, title, year,
//               MusicBrainz id. Nothing hosted, nothing streamed, nothing
//               granted. No lyric appears anywhere in this data.
//   playable  — music whose licence was read on the page that states it, and
//               which this house could legally put behind a room.
//
// Plus a ledger: the house left ten silent audio placeholders promising
// specific music "in production". This says which of those promises can be
// kept, and which cannot — one of them cannot, and that is worth knowing.
// No keys, no database, no funds, no take-rate.

const VERTICAL = 'playlist';
const TITLE = '樂 the Playlist — one track per room, and a shelf we may actually play';
const ESSENCE =
  '樂 is music and joy in one character. One track per room, chosen by ear and argued for in plain words. Artbitrage hosts none of it and grants no rights in any of it; a second shelf holds music that actually could be played here, with its licence read rather than assumed.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  hosts_no_audio: true,
  grants_no_rights:
    'Artbitrage hosts none of the listening shelf, streams none of it, and grants no rights in any of it. These are facts about records — artist, title, year, MusicBrainz id — the same kind of thing a library catalogue holds. Take the titles to whatever service you already use.',
  no_lyrics: 'No lyric from any of these songs appears in this room or its data, by design.',
  curation_is_opinion:
    'Which tracks are here, and which room each sits in, is one person\'s taste and one person\'s joke. None of it is a finding. Only the facts underneath were checked: that a recording exists, under that exact artist credit, in that year.',
  playable_is_different:
    'The playable shelf is not a recommendation, it is a permission. Every licence was read on the page that states it, and the exact licence is named — CC0, CC BY 4.0 and CC BY-NC 4.0 grant wildly different things. A licence is still only as good as the uploader\'s right to grant it, which no fetch can prove.',
  not_legal_advice:
    'The licensing findings are a reading of published sources, not legal advice. Terms differ by country and change. Check the source for your own jurisdiction before you serve a file.',
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/playlist', desc: 'This directory' },
  { method: 'GET', path: '/api/playlist/listening', desc: 'The listening shelf — one track per room, with why it sits there', params: 'room, q, limit, offset' },
  { method: 'GET', path: '/api/playlist/room/:room', desc: 'The track for one room, e.g. /api/playlist/room/slope' },
  { method: 'GET', path: '/api/playlist/playable', desc: 'Music this house could legally play, each licence read on the page that states it', params: 'attribution, commercial' },
  { method: 'GET', path: '/api/playlist/licensing', desc: 'What a builder must know before putting audio behind a page — findings and traps' },
  { method: 'GET', path: '/api/playlist/promises', desc: 'Ten silent placeholders in this house, and which of their promises can legally be kept' },
  { method: 'GET', path: '/api/playlist/dropped', desc: 'What was cut for not existing. Short, and the point of checking' },
  { method: 'GET', path: '/api/playlist/text', desc: 'The listening shelf as plain text, for pasting into whatever you already use' },
];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;

let PLAYLIST = null;

async function loadPlaylist(env, request) {
  if (PLAYLIST) return PLAYLIST;
  try {
    const res = await env.ASSETS.fetch(new URL('/playlist.json', request.url));
    if (res.ok) { PLAYLIST = await res.json(); return PLAYLIST; }
  } catch (e) {
    try {
      const res2 = await fetch(new URL('/playlist.json', request.url));
      if (res2.ok) { PLAYLIST = await res2.json(); return PLAYLIST; }
    } catch (e2) {}
  }
  return PLAYLIST;
}

function jsonResponse(data, status = 200, cacheSeconds = 0) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (cacheSeconds > 0) headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function textResponse(body, cacheSeconds = 3600) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=${cacheSeconds}`,
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

const safeString = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max).trim() : '');
function parseIntOr(v, fallback, min, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Carried on every response, so the boundary cannot be lost by reading one part.
const BOUNDARY = Object.freeze({
  audio_hosted_here: false,
  rights_granted_here: 'none',
});

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segments = url.pathname.split('/').map(decodeURIComponent).filter(Boolean).slice(2);

  const data = await loadPlaylist(env, request);
  if (!data) {
    return jsonResponse({ error: 'playlist data unavailable', hint: 'GET /api/playlist once the room has woken' }, 503);
  }

  const [head, tail] = segments;

  if (segments.length === 0) {
    return jsonResponse({
      schema: data.schema,
      vertical: VERTICAL,
      title: TITLE,
      essence: ESSENCE,
      room: 'https://artbitrage.io/playlist',
      counts: data.counts,
      corpus: data.corpus,
      shelves: {
        listening: 'Real records, one per room. Facts only. Hosted nowhere, licensed to nobody.',
        playable: 'Music whose licence was read on the page that states it. This house could legally play these.',
      },
      endpoints: ENDPOINTS,
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'listening' && !tail) {
    const room = safeString(url.searchParams.get('room'), 40).toLowerCase();
    const q = safeString(url.searchParams.get('q'), 80).toLowerCase();
    let list = data.listening;
    if (room) {
      const want = room.startsWith('/') ? room : '/' + room;
      list = list.filter(t => t.room.toLowerCase() === want);
    }
    if (q) list = list.filter(t => (t.artist + ' ' + t.title + ' ' + t.why_this_room).toLowerCase().includes(q));
    const limit = parseIntOr(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseIntOr(url.searchParams.get('offset'), 0, 0, 1000);
    return jsonResponse({
      schema: data.schema,
      total: list.length,
      limit,
      offset,
      tracks: list.slice(offset, offset + limit),
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'room') {
    if (!tail) {
      return jsonResponse({
        error: 'no room given',
        hint: 'GET /api/playlist/room/slope',
        valid_rooms: data.listening.map(t => t.room),
      }, 400);
    }
    const want = tail.startsWith('/') ? tail : '/' + tail;
    const track = data.listening.find(t => t.room.toLowerCase() === want.toLowerCase());
    if (!track) {
      return jsonResponse({
        error: 'no track for that room',
        room: want,
        valid_rooms: data.listening.map(t => t.room),
        hint: 'GET /api/playlist/room/maybe',
      }, 404);
    }
    return jsonResponse({ schema: data.schema, track, ...BOUNDARY, disclosure: DISCLOSURE }, 200, 3600);
  }

  if (head === 'playable' && !tail) {
    const attribution = safeString(url.searchParams.get('attribution'), 12).toLowerCase();
    const commercial = safeString(url.searchParams.get('commercial'), 12).toLowerCase();
    let list = data.playable;
    if (attribution === 'none') list = list.filter(p => !p.attribution_required);
    if (attribution === 'required') list = list.filter(p => p.attribution_required);
    if (commercial === 'yes') list = list.filter(p => p.commercial_ok);
    if (commercial === 'no') list = list.filter(p => !p.commercial_ok);
    return jsonResponse({
      schema: data.schema,
      total: list.length,
      how_to_use:
        'Name the exact licence, keep the credit line where a reader can find it, self-host the file rather than hotlinking, and save a dated copy of the licence page the day you adopt it — that copy is your answer if a fingerprint system later claims your legally free audio.',
      items: list,
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'licensing' && !tail) {
    return jsonResponse({
      schema: data.schema,
      the_rule:
        'Every piece of recorded music carries at least two rights: the composition and the recording. A composition is free 70 years after the composer dies. The recording is a separate copyright belonging to whoever made it — so a public-domain Gymnopédie still needs a recording whose own rights are clear.',
      count: data.licensing_findings.length,
      findings: data.licensing_findings,
      builder_notes: data.builder_notes,
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'promises' && !tail) {
    return jsonResponse({
      schema: data.schema,
      what_this_is:
        'Ten rooms in this house carry an audio player holding a 44-byte silent file, each with a note promising specific music "in production". Nobody ever came back. This applies the licensing rule to those ten promises.',
      count: data.promise_ledger.length,
      keepable: data.counts.promises_keepable,
      ledger: data.promise_ledger,
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'dropped' && !tail) {
    return jsonResponse({
      schema: data.schema,
      why_this_exists:
        'Checking is only worth anything if it can remove something. This is what it removed.',
      count: data.dropped.length,
      corrections_made: data.counts.corrected,
      dropped: data.dropped,
      ...BOUNDARY,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'text' && !tail) {
    const lines = [
      '樂 the Playlist — artbitrage.io/playlist',
      'One track per room. Artbitrage hosts none of this and grants no rights in it.',
      'Paste into whatever you already use.',
      '',
      ...data.listening.map(t => `${t.artist} — ${t.title}${t.year ? ` (${t.year})` : ''}   [${t.room}]`),
      '',
      `${data.counts.listening} tracks. Checked against MusicBrainz; ${data.counts.corrected} credits corrected, ${data.counts.dropped} dropped for not existing.`,
    ];
    return textResponse(lines.join('\n') + '\n');
  }

  return jsonResponse({ error: 'unknown playlist route', path: url.pathname, endpoints: ENDPOINTS, hint: 'GET /api/playlist' }, 404);
}
