// ARTBITRAGE /api/slope/* — 坡 the Slope, served from slope.json
//
// A record of a search for walls in a living garden: conditions without which a
// thing cannot work at all. Forty were proposed from real evidence. Thirty-nine
// were destroyed, in nearly every case by the source that was meant to hold
// them up. The fortieth survives only as a definition.
//
// So every response carries "guaranteed": null and "walls": [] — not because the
// data is thin, but because that is the finding. The sibling room /api/ground
// owns the one place a real floor was found: plants over sealed rubble.
// No keys, no database, no funds, no take-rate.

const VERTICAL = 'slope';
const TITLE = '坡 the Slope — what is a wall, and what only sounds like one';
const ESSENCE =
  'Forty hard rules were proposed from the evidence and thirty-nine fell. Almost nothing in a garden is a wall. Almost everything is a slope — which means you cannot fail this by missing a rule, only do more or less of what helps.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  no_guarantees: true,
  almost_nothing_is_a_wall:
    'Treat any garden advice phrased as "you must have X or Y will not come" as a slope until someone shows you the study. Forty such rules were tested here against their own cited sources; thirty-nine did not survive.',
  a_slope_is_not_nothing:
    'That almost nothing is a wall does not mean nothing matters. The effects are gradients with sizes, and the sizes are published here. There is no threshold to clear and no exam to fail.',
  not_advice:
    'A record of what published sources do and do not establish. Not garden design advice, ecological consultancy, a species survey, or a legal compliance check. Protected species and planning rules are not covered.',
  note:
    "Every claim carries source_url, a truth_status, its own cannot_establish line, and the checker's verbatim verdict. Where two checkers disagreed, the stricter reading won and the disagreement is published rather than resolved away.",
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/slope', desc: 'This directory' },
  { method: 'GET', path: '/api/slope/walls', desc: 'The walls that survived. The list is empty, and the adjudication says why' },
  { method: 'GET', path: '/api/slope/rules', desc: 'All forty rules that were proposed and tested, with the verbatim reason each fell', params: 'topic, verdict, limit, offset' },
  { method: 'GET', path: '/api/slope/rules/:id', desc: 'One tested rule, with the claim and source behind it' },
  { method: 'GET', path: '/api/slope/claims', desc: 'The verified corpus — 89 claims about what living layers actually need', params: 'topic, truth_status, q, limit, offset' },
  { method: 'GET', path: '/api/slope/claims/:id', desc: 'One claim with its source, its limit, and its checker note' },
  { method: 'GET', path: '/api/slope/aims', desc: 'The six areas you can ask about, in plain words' },
  { method: 'GET', path: '/api/slope/weigh', desc: 'For one area: the walls (none), the rules that fell, and the gradients that remain', params: 'want (see /api/slope/aims)' },
  { method: 'GET', path: '/api/slope/vocab', desc: 'Topics, truth statuses, verdicts, and the value never returned' },
];

const TOPICS = ['soil-to-plants', 'plants', 'invertebrates', 'vertebrates', 'water-weather', 'time-and-look'];
const TRUTH_STATUSES = ['verified', 'source-declared', 'contested', 'unverified'];
const VERDICTS = ['slope', 'definition-not-evidence'];

// Plain-word doors onto the same six areas. No invented mapping: one aim, one topic.
const AIMS = [
  { id: 'ground-for-plants', topic: 'soil-to-plants', label: 'What plants need from the ground', asks: 'Will things grow here, and what stops them?' },
  { id: 'planting', topic: 'plants', label: 'What to plant on poor alkaline ground', asks: 'What actually tolerates this, and what is sold to me anyway?' },
  { id: 'insects', topic: 'invertebrates', label: 'Insects and other invertebrates', asks: 'What makes a garden usable by them?' },
  { id: 'animals', topic: 'vertebrates', label: 'Hedgehogs, birds, amphibians', asks: 'What do they need that a garden usually lacks?' },
  { id: 'water', topic: 'water-weather', label: 'Water, ponds, drought and flood', asks: 'What works in a year that does both?' },
  { id: 'time', topic: 'time-and-look', label: 'How long things really take', asks: 'When has it recovered, and when does it only look recovered?' },
];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

let SLOPE = null;

async function loadSlope(env, request) {
  if (SLOPE) return SLOPE;
  try {
    const res = await env.ASSETS.fetch(new URL('/slope.json', request.url));
    if (res.ok) { SLOPE = await res.json(); return SLOPE; }
  } catch (e) {
    try {
      const res2 = await fetch(new URL('/slope.json', request.url));
      if (res2.ok) { SLOPE = await res2.json(); return SLOPE; }
    } catch (e2) {}
  }
  return SLOPE;
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

// Present in every response this endpoint returns. Nothing you can ask will fill it.
const NEVER = Object.freeze({
  guaranteed: null,
  guaranteed_note:
    'This field is null by construction. Forty hard rules were tested against their own sources and thirty-nine fell; the fortieth is a definition. Nothing here can promise an outcome in a living system, and an endpoint that filled this field would be selling certainty it does not have.',
});

function paginate(list, url) {
  const limit = parseIntOr(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseIntOr(url.searchParams.get('offset'), 0, 0, 10000);
  return { limit, offset, page: list.slice(offset, offset + limit) };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segments = url.pathname.split('/').map(decodeURIComponent).filter(Boolean).slice(2);

  const data = await loadSlope(env, request);
  if (!data) {
    return jsonResponse({ error: 'slope data unavailable', hint: 'GET /api/slope once the room has woken' }, 503);
  }

  const [head, tail] = segments;

  if (segments.length === 0) {
    return jsonResponse({
      schema: data.schema,
      vertical: VERTICAL,
      title: TITLE,
      essence: ESSENCE,
      room: 'https://artbitrage.io/slope',
      sibling: data.sibling,
      counts: data.counts,
      corpus: data.corpus,
      climate_note: data.climate_note,
      headline: data.adjudication.so_the_count_is,
      aims: AIMS,
      endpoints: ENDPOINTS,
      ...NEVER,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'walls' && !tail) {
    return jsonResponse({
      schema: data.schema,
      // The finding, as a data structure: the list is empty.
      walls: [],
      count: 0,
      rules_proposed: data.counts.rules_proposed,
      rules_fell: data.counts.rules_fell,
      adjudication: data.adjudication,
      the_one_real_floor_is_elsewhere: data.sibling,
      ...NEVER,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'rules') {
    if (tail) {
      const rule = data.tested_rules.find(r => r.id === tail);
      if (!rule) {
        return jsonResponse({
          error: 'rule not found', id: tail,
          hint: 'GET /api/slope/rules to list all forty',
          valid_ids: data.tested_rules.map(r => r.id),
        }, 404);
      }
      const claim = data.claims.find(c => c.id === rule.claim_id) || null;
      return jsonResponse({ schema: data.schema, rule, claim, ...NEVER, disclosure: DISCLOSURE }, 200, 3600);
    }
    const topic = safeString(url.searchParams.get('topic'), 24).toLowerCase();
    const verdict = safeString(url.searchParams.get('verdict'), 32).toLowerCase();
    if (topic && !TOPICS.includes(topic)) {
      return jsonResponse({ error: 'unknown topic', topic, valid_topics: TOPICS, hint: 'GET /api/slope/rules?topic=vertebrates' }, 400);
    }
    if (verdict && !VERDICTS.includes(verdict)) {
      return jsonResponse({ error: 'unknown verdict', verdict, valid_verdicts: VERDICTS }, 400);
    }
    let list = data.tested_rules;
    if (topic) list = list.filter(r => r.topic === topic);
    if (verdict) list = list.filter(r => r.verdict === verdict);
    const { limit, offset, page } = paginate(list, url);
    return jsonResponse({ schema: data.schema, total: list.length, limit, offset, rules: page, ...NEVER, disclosure: DISCLOSURE }, 200, 3600);
  }

  if (head === 'claims') {
    if (tail) {
      const claim = data.claims.find(c => c.id === tail);
      if (!claim) {
        return jsonResponse({ error: 'claim not found', id: tail, hint: 'GET /api/slope/claims?topic=plants to list them' }, 404);
      }
      return jsonResponse({ schema: data.schema, claim, ...NEVER, disclosure: DISCLOSURE }, 200, 3600);
    }
    const topic = safeString(url.searchParams.get('topic'), 24).toLowerCase();
    const status = safeString(url.searchParams.get('truth_status'), 24).toLowerCase();
    const q = safeString(url.searchParams.get('q'), 80).toLowerCase();
    if (topic && !TOPICS.includes(topic)) {
      return jsonResponse({ error: 'unknown topic', topic, valid_topics: TOPICS, hint: 'GET /api/slope/claims?topic=water-weather' }, 400);
    }
    if (status && !TRUTH_STATUSES.includes(status)) {
      return jsonResponse({ error: 'unknown truth_status', truth_status: status, valid: TRUTH_STATUSES }, 400);
    }
    let list = data.claims;
    if (topic) list = list.filter(c => c.topic === topic);
    if (status) list = list.filter(c => c.truth_status === status);
    if (q) list = list.filter(c => (c.statement + ' ' + c.detail).toLowerCase().includes(q));
    const { limit, offset, page } = paginate(list, url);
    return jsonResponse({ schema: data.schema, total: list.length, limit, offset, claims: page, ...NEVER, disclosure: DISCLOSURE }, 200, 3600);
  }

  if (head === 'aims' && !tail) {
    return jsonResponse({ schema: data.schema, count: AIMS.length, aims: AIMS, ...NEVER, disclosure: DISCLOSURE }, 200, 3600);
  }

  if (head === 'weigh' && !tail) {
    const want = safeString(url.searchParams.get('want'), 40).toLowerCase();
    const aim = AIMS.find(a => a.id === want);
    if (!aim) {
      return jsonResponse({
        error: want ? 'unknown area' : 'no area given',
        want: want || null,
        valid: AIMS.map(a => a.id),
        hint: 'GET /api/slope/weigh?want=animals',
      }, 400);
    }
    const fell = data.tested_rules.filter(r => r.topic === aim.topic && r.verdict === 'slope');
    const definitions = data.tested_rules.filter(r => r.topic === aim.topic && r.verdict === 'definition-not-evidence');
    const gradients = data.claims.filter(c => c.topic === aim.topic);
    return jsonResponse({
      schema: data.schema,
      want: aim.id,
      area: aim.label,
      // The shape of the answer is the argument.
      walls: [],
      walls_note:
        fell.length
          ? `${fell.length} rule${fell.length === 1 ? ' was' : 's were'} proposed as a hard requirement in this area and none of them held. What you were told you must do, you may not have to.`
          : 'No hard rule was even proposed in this area from the evidence gathered.',
      definitions_only: definitions,
      rules_that_fell: fell,
      gradients: gradients.map(c => ({
        id: c.id, statement: c.statement, truth_status: c.truth_status,
        source: c.source, cannot_establish: c.cannot_establish,
      })),
      method:
        'Rules were proposed by researchers from fetched sources, then judged by an independent sceptic who fetched the same source again under an explicitly harsh standard: a rule survives only if the thing cannot work at all without the condition, never merely worse.',
      ...NEVER,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  if (head === 'vocab' && !tail) {
    return jsonResponse({
      schema: data.schema,
      topics: TOPICS,
      truth_statuses: TRUTH_STATUSES,
      verdicts: {
        slope: 'Proposed as a hard requirement; the evidence showed a gradient. Doing this helps by some amount; not doing it does not stop the thing.',
        'definition-not-evidence': 'Survives only as a matter of definition — true the way it is true that you cannot dig a hole in a rock. No study established it.',
      },
      aims: AIMS.map(a => a.id),
      never_returned: ['guaranteed', 'walls (non-empty)'],
      ...NEVER,
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }

  return jsonResponse({ error: 'unknown slope route', path: url.pathname, endpoints: ENDPOINTS, hint: 'GET /api/slope' }, 404);
}
