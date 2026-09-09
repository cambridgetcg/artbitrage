// ARTBITRAGE /api/ground/* — 土 the Ground, served from ground.json
//
// Six cheap field tests that read whether ground is working rather than how it
// looks, and a reader whose asymmetry is honest and in-band on every response:
// a bad result is evidence the ground is NOT working; a good result proves
// nothing. The `alive` field of every verdict is null. It is null by
// construction, not by omission — no arrangement of these tests can fill it.
//
// The same shape as /api/pigments, for the same reason: a tool that can only
// argue against a claim is more use than one that flatters it.
// No keys, no database, no funds, no take-rate.

const VERTICAL = 'ground';
const TITLE = '土 the Ground — is this soil, or is it fill with grass on top?';
const ESSENCE =
  'Under the grass was rubble. The lawn passed every test the eye can run and failed the only one that counts. Six field tests you can do with kitchen materials, each honest about what it cannot see.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  not_a_soil_survey: true,
  cannot_certify_life:
    'These tests can produce evidence that ground is NOT working. None of them, alone or together, can establish that ground is alive. Nothing here is a certificate, a soil survey, a contamination assessment, or advice about whether food grown in this ground is safe to eat.',
  needs_a_control:
    'The only sound reading is a pair: the same test, the same day, the same depth, in the ground you are asking about and in ground you already trust. Supply the control readings as *_control parameters; without them this endpoint answers inconclusive on purpose.',
  safety_first:
    'Buried construction waste can contain asbestos, lead paint and treated timber. GET /api/ground/safety before digging further. Suspected asbestos: stop, keep it damp, do not break it, do not sweep or vacuum, and phone your council.',
  note:
    'Every finding carries source_url plus a truth_status (verified | source-declared | contested | unverified) and its own cannot_establish line. Benchmarks published for farm fields are not benchmarks for a garden; where no garden benchmark exists, this says so rather than inventing one.',
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/ground', desc: 'This directory' },
  { method: 'GET', path: '/api/ground/tests', desc: 'The six field tests — method, materials, what each one is blind to' },
  { method: 'GET', path: '/api/ground/tests/:id', desc: 'One test in full, e.g. /api/ground/tests/buried-cotton' },
  { method: 'GET', path: '/api/ground/findings', desc: 'The verified corpus behind the room', params: 'topic, q, truth_status, limit, offset' },
  { method: 'GET', path: '/api/ground/findings/:id', desc: 'One finding with its source and its stated limit' },
  { method: 'GET', path: '/api/ground/safety', desc: 'Read this first if you are digging up construction waste today' },
  { method: 'GET', path: '/api/ground/layers', desc: 'The build order — microbiome, plants, insects, animals, weather' },
  { method: 'GET', path: '/api/ground/vocab', desc: 'Topics, truth statuses, reads_life classes, and every accepted verdict input' },
  {
    method: 'GET',
    path: '/api/ground/verdict',
    desc: 'Read your own test results. Answers evidence-of-absence, inconclusive, or no-evidence-against-life. Never answers alive.',
    params: 'worms, worms_control, cotton, cotton_control, slake, slake_control, infiltration, infiltration_control, fizz, stones, soil, month',
  },
];

const TOPICS = ['safety', 'rubble', 'tests', 'rebuild', 'layers'];
const TRUTH_STATUSES = ['verified', 'source-declared', 'contested', 'unverified'];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// Ordered worst-to-best, so a control comparison is just an index comparison.
const COTTON_STATES = ['intact', 'frayed', 'half-gone', 'shredded', 'gone'];
const SLAKE_STATES = ['collapsed', 'slow-collapse', 'held'];
const FIZZ_STATES = ['none', 'slight', 'strong'];
const SOIL_STATES = ['dry', 'damp', 'wet'];

// Verdict vocabulary. Note what is absent: there is no 'alive'.
const V_AGAINST = 'evidence-against-life';
const V_NO_EVIDENCE = 'no-evidence-against-life';
const V_INCONCLUSIVE = 'inconclusive';
const V_NOT_ABOUT_LIFE = 'not-about-life';

let GROUND = null;

async function loadGround(env, request) {
  if (GROUND) return GROUND;
  try {
    const assetUrl = new URL('/ground.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      GROUND = await res.json();
      return GROUND;
    }
  } catch (e) {
    try {
      const res2 = await fetch(new URL('/ground.json', request.url));
      if (res2.ok) {
        GROUND = await res2.json();
        return GROUND;
      }
    } catch (e2) {}
  }
  return GROUND;
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

function safeString(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max).trim();
}

function parseIntOr(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
}

function parseNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function oneOfOrNull(value, allowed) {
  const v = safeString(value, 24).toLowerCase();
  return allowed.includes(v) ? v : null;
}

// --- the reader ------------------------------------------------------------

// Worm counts are read by weather before they are read by number. Penn State
// Extension records that drying soil sends earthworms deeper, kills them, or
// puts them into diapause — knotted up in a slime-lined hole — and that summer
// populations run low for that reason. So a zero in August measures August.
function seasonBlindsWorms(month, soil) {
  if (soil === 'dry') return true;
  if (month >= 6 && month <= 9 && soil !== 'wet') return true;
  return false;
}

function readWorms(input, month, monthAssumed) {
  const { worms, worms_control, soil } = input;
  if (worms === null) return null;
  const reading = {
    test: 'worm-count',
    reads_life: true,
    supplied: { worms, worms_control, soil, month, month_assumed: monthAssumed },
  };

  if (seasonBlindsWorms(month, soil)) {
    reading.verdict = V_INCONCLUSIVE;
    reading.why =
      'The test is blind in these conditions. When soil dries, earthworms move deeper, die, or enter diapause — tied up in a knot in a slime-lined hole to hold moisture — and deep-burrowing species keep permanent vertical burrows five or six feet down, well below a spade. A low count now measures the weather.';
    reading.to_resolve = 'Count again in early spring, or in autumn once the soil has been wet for a few days.';
    reading.source = 'https://extension.psu.edu/earthworms';
    return reading;
  }

  if (worms_control !== null) {
    if (worms <= 3 && worms_control >= 9) {
      reading.verdict = V_AGAINST;
      reading.why = `${worms} adults here against ${worms_control} in ground you trust, same day, same depth. That is a real difference, not a season.`;
    } else if (worms < worms_control / 2) {
      reading.verdict = V_AGAINST;
      reading.why = `${worms} adults here against ${worms_control} in the control — under half. The gap is the reading.`;
    } else {
      reading.verdict = V_NO_EVIDENCE;
      reading.why = `${worms} adults here against ${worms_control} in the control. Nothing here argues the ground is not working. That is not the same as arguing it is.`;
    }
    reading.source = 'https://ahdb.org.uk/news/ahdb-scorecard-unearths-soil-s-secrets';
    return reading;
  }

  reading.verdict = V_INCONCLUSIVE;
  reading.to_resolve = 'Run the same pit in ground you already trust, same day, same depth, and send it as worms_control.';
  if (worms <= 3) {
    reading.reading_alone =
      `${worms} adults is at or below AHDB's 'bad' traffic light for cropped land, which is three or fewer. Their 'good' is nine or more. Both were built from about ten pits across a farm field, not one hole in a garden, and no benchmark exists at all for a domestic plot or a new-build.`;
    reading.why = 'A low count without a control is a reason to look again, not a finding.';
  } else if (worms >= 9) {
    reading.reading_alone = `${worms} adults is at or above AHDB's 'good' for cropped land. Worms found are worms present — but worms are one animal, not the microbiome.`;
    reading.why = 'Nothing to argue against here, and nothing established either.';
  } else {
    reading.reading_alone =
      `${worms} adults falls between AHDB's published good (nine or more) and bad (three or fewer). The middle band of their scorecard is in protocol tables this room could not read, so the honest answer is that we do not know where ${worms} sits.`;
    reading.why = 'Between the two published traffic lights, with no third light to offer.';
  }
  reading.source = 'https://ahdb.org.uk/knowledge-library/how-to-count-earthworms';
  return reading;
}

function readCotton(input) {
  const { cotton, cotton_control } = input;
  if (cotton === null) return null;
  const reading = {
    test: 'buried-cotton',
    reads_life: true,
    supplied: { cotton, cotton_control },
  };
  const i = COTTON_STATES.indexOf(cotton);

  if (cotton_control === null) {
    reading.verdict = V_INCONCLUSIVE;
    reading.why =
      'The people who run this test say plainly it will not give definitive answers on soil life and should be used for comparative purposes only. Intact cotton can mean dry soil, cold soil, or fungal-dominated soil — and fungal dominance is usually a good sign.';
    reading.to_resolve = 'Bury a second piece in ground you trust, same day, same depth, and send its state as cotton_control.';
    reading.reading_alone = i <= 1
      ? 'Cotton that comes up nearly whole after two months is the shape of a dead result. It is not yet the fact of one.'
      : 'Heavily rotted cotton is hard to explain without biology.';
    reading.source = 'https://www.farmersweekly.co.nz/special-report/diy-soil-health/the-microbial-workers-soil-your-undies/';
    return reading;
  }

  const c = COTTON_STATES.indexOf(cotton_control);
  if (i < c - 1) {
    reading.verdict = V_AGAINST;
    reading.why = `Yours came up ${cotton}; the control in trusted ground came up ${cotton_control}. Same day, same depth, same weather — the difference is the ground.`;
  } else if (i >= c) {
    reading.verdict = V_NO_EVIDENCE;
    reading.why = `Yours (${cotton}) was eaten at least as hard as the control (${cotton_control}). Something is feeding. That is evidence of feeding, not a verdict on the whole soil.`;
  } else {
    reading.verdict = V_INCONCLUSIVE;
    reading.why = `Yours (${cotton}) is one step behind the control (${cotton_control}) — inside the noise of a test with no published scale.`;
  }
  reading.source = 'https://www.pasoilhealth.org/soilyourundies';
  return reading;
}

function readSlake(input) {
  const { slake, slake_control } = input;
  if (slake === null) return null;
  const reading = { test: 'slake', reads_life: true, supplied: { slake, slake_control } };

  if (slake_control === null) {
    reading.verdict = V_INCONCLUSIVE;
    reading.to_resolve = 'Drop a fragment from ground you trust into a second jar at the same moment and send it as slake_control.';
    reading.reading_alone = slake === 'collapsed'
      ? 'Losing half the structure within five seconds is class 1, the bottom of the USDA-NRCS scale. The guide\'s framing is that the binding of soil particles must constantly be renewed by biological processes — but high clay or a sodium problem disperses a lump for reasons that have nothing to do with biology.'
      : 'A lump that holds could be living crumb. It could also be clay, or a cemented piece of hardcore.';
    reading.why = 'Slaking tracks clay, texture and sodicity as well as biology, so it reads as evidence about biological glue only when like is compared with like.';
    reading.source = 'https://sarep.ucdavis.edu/sites/g/files/dgvnsk9171/files/media/documents/NRCS%20slake%20test%20procedure%20nrcs142p2_051287.pdf';
    return reading;
  }

  const i = SLAKE_STATES.indexOf(slake);
  const c = SLAKE_STATES.indexOf(slake_control);
  if (i < c) {
    reading.verdict = V_AGAINST;
    reading.why = `Yours ${slake === 'collapsed' ? 'fell apart in seconds' : 'came apart'} while the control ${slake_control === 'held' ? 'held together' : 'lasted longer'}. Same water, same minute.`;
  } else {
    reading.verdict = V_NO_EVIDENCE;
    reading.why = `Yours (${slake}) held up as well as the control (${slake_control}). Note that a cemented lump of hardcore also passes this test by not falling apart.`;
  }
  reading.source = 'https://sarep.ucdavis.edu/sites/g/files/dgvnsk9171/files/media/documents/NRCS%20slake%20test%20procedure%20nrcs142p2_051287.pdf';
  return reading;
}

function readInfiltration(input) {
  const { infiltration, infiltration_control, soil } = input;
  if (infiltration === null) return null;
  const reading = {
    test: 'infiltration',
    reads_life: true,
    supplied: { minutes_for_second_inch: infiltration, infiltration_control, soil },
  };

  if (soil === 'dry') {
    reading.verdict = V_INCONCLUSIVE;
    reading.why =
      'The guide says not to test unusually dry soil. Clay develops shrinkage cracks as it dries and the cracks are direct conduits, so dry ground can drink fast for reasons that have nothing to do with life.';
    reading.to_resolve = 'Wet it and let it soak, or test after rain, and always run a second inch.';
    reading.source = 'https://www.envirothonpa.org/documents/infiltration_guide.pdf';
    return reading;
  }

  const slow = infiltration >= 60;
  if (infiltration_control !== null) {
    if (infiltration > infiltration_control * 3 && slow) {
      reading.verdict = V_AGAINST;
      reading.why = `${infiltration} minutes here against ${infiltration_control} in trusted ground. The NRCS worked example is the same shape: one silty clay loam field where the inch vanished in a minute off the wheel track and took three hours on it.`;
    } else if (slow) {
      reading.verdict = V_INCONCLUSIVE;
      reading.why = `Both are slow (${infiltration} against ${infiltration_control} minutes). Clay without cracks is slow by texture alone, so this is a reason to look closer rather than a conviction.`;
    } else {
      reading.verdict = V_NO_EVIDENCE;
      reading.why = `${infiltration} minutes is not a sealed result. But a fast reading is equally explained by sand, by dry cracks, or by rubble — fast is not proof of anything.`;
    }
    return jsonSource(reading);
  }

  reading.verdict = V_INCONCLUSIVE;
  reading.to_resolve = 'Run the same ring in ground you trust and send the minutes as infiltration_control.';
  reading.reading_alone = slow
    ? `${infiltration} minutes for the second inch is in sealed territory. The guide names surface crusting, compaction and restrictive layers as causes — and honest clay as another.`
    : `${infiltration} minutes is a fast reading, which the guide's own texture table puts within reach of bare sand. Rubble and hardcore drink fast too.`;
  reading.why = 'One ring is an estimate; the guide asks for several.';
  return jsonSource(reading);

  function jsonSource(r) {
    r.source = 'https://www.envirothonpa.org/documents/infiltration_guide.pdf';
    return r;
  }
}

function readContext(input) {
  const out = [];
  if (input.fizz !== null) {
    out.push({
      test: 'vinegar-fizz',
      reads_life: false,
      verdict: V_NOT_ABOUT_LIFE,
      supplied: { fizz: input.fizz },
      why:
        input.fizz === 'strong'
          ? 'A strong fizz is a mortar-and-concrete signature: free carbonate in ground that ought to be neutral loam. It says nothing about life, but it changes what every other reading means — buried masonry releases calcium as it weathers and pushes pH up, and above roughly 7.5 iron, manganese and zinc become less available to plants.'
          : input.fizz === 'slight'
            ? 'Some free carbonate. Common in chalky districts and also what a little buried mortar looks like.'
            : 'No fizz tells you almost nothing — a soil can be strongly alkaline from sodium with no carbonate at all.',
      note: 'Carbonate is not pH. For a number you need a lab; cheap kits landed within about one pH unit in one small university comparison, and one pH unit is a tenfold difference in acidity.',
      source: 'https://ask.ifas.ufl.edu/publication/HS1262',
    });
  }
  if (input.stones !== null) {
    out.push({
      test: 'jar',
      reads_life: false,
      verdict: V_NOT_ABOUT_LIFE,
      supplied: { stones_percent_over_2mm: input.stones },
      why:
        input.stones >= 5
          ? `About ${input.stones}% of what you dug is over 2 mm. BS 3882:2015, the British Standard for topsoil that is bought and moved, allows visible contaminants over 2 mm below 0.5% by mass, of which plastics below 0.25%, and sharps zero in a kilogram.`
          : `About ${input.stones}% over 2 mm. For scale, BS 3882:2015 allows visible contaminants over 2 mm below 0.5% by mass in topsoil that is bought and moved.`,
      note:
        'That standard is explicitly not intended for grading ground in place, so it is not a test your garden can fail. It is a number you can point at. This test cannot see life, structure, compaction or contamination.',
      source: 'https://cawood.co.uk/wp-content/uploads/2022/04/Soil-British-Standard-Topsoil-BS3882-2015-Technical-Information.pdf',
    });
  }
  return out;
}

function buildVerdict(url) {
  const q = url.searchParams;
  const now = new Date();
  const monthParam = parseIntOr(q.get('month'), null, 1, 12);
  const monthAssumed = monthParam === null;
  const month = monthAssumed ? now.getUTCMonth() + 1 : monthParam;

  const input = {
    worms: parseIntOr(q.get('worms'), null, 0, 1000),
    worms_control: parseIntOr(q.get('worms_control'), null, 0, 1000),
    cotton: oneOfOrNull(q.get('cotton'), COTTON_STATES),
    cotton_control: oneOfOrNull(q.get('cotton_control'), COTTON_STATES),
    slake: oneOfOrNull(q.get('slake'), SLAKE_STATES),
    slake_control: oneOfOrNull(q.get('slake_control'), SLAKE_STATES),
    infiltration: parseNumberOrNull(q.get('infiltration')),
    infiltration_control: parseNumberOrNull(q.get('infiltration_control')),
    fizz: oneOfOrNull(q.get('fizz'), FIZZ_STATES),
    stones: parseNumberOrNull(q.get('stones')),
    soil: oneOfOrNull(q.get('soil'), SOIL_STATES),
  };

  const lifeReadings = [
    readWorms(input, month, monthAssumed),
    readCotton(input),
    readSlake(input),
    readInfiltration(input),
  ].filter(Boolean);
  const contextReadings = readContext(input);

  if (lifeReadings.length === 0 && contextReadings.length === 0) {
    return {
      error: 'no readings supplied',
      hint: 'GET /api/ground/verdict?worms=1&worms_control=11&soil=damp&month=4',
      accepted: {
        worms: 'adult earthworms in one 20x20x20 cm pit (integer)',
        worms_control: 'the same count in ground you already trust',
        cotton: COTTON_STATES,
        cotton_control: COTTON_STATES,
        slake: SLAKE_STATES,
        slake_control: SLAKE_STATES,
        infiltration: 'minutes for the second inch of water',
        infiltration_control: 'the same, in ground you trust',
        fizz: FIZZ_STATES,
        stones: 'percent by eye of what you dug that is over 2 mm',
        soil: SOIL_STATES,
        month: '1-12; defaults to the current month',
      },
      informational_only: true,
    };
  }

  const anyAgainst = lifeReadings.some(r => r.verdict === V_AGAINST);
  const anyClear = lifeReadings.some(r => r.verdict === V_NO_EVIDENCE);
  const verdict = anyAgainst ? 'evidence-of-absence' : anyClear ? V_NO_EVIDENCE : V_INCONCLUSIVE;

  const missingControls = lifeReadings
    .filter(r => r.to_resolve && String(r.to_resolve).includes('control'))
    .map(r => r.test);

  return {
    schema: 'artbitrage.ground-verdict/1',
    // Present in every response this endpoint has ever returned, and in every
    // response it ever will return. Nothing you can supply will fill it.
    alive: null,
    alive_note:
      'This field is null by construction. These tests can find evidence that ground is not working; none of them, in any combination, can establish that it is alive. An endpoint that could say yes here would be lying about what a spade can know.',
    verdict,
    verdict_means: {
      'evidence-of-absence': 'At least one paired test says this ground is doing less than ground you trust. That is a finding.',
      inconclusive: 'Nothing here can be read yet — wrong season, wrong conditions, or no paired control.',
      'no-evidence-against-life': 'Nothing you supplied argues this ground is failing. That is the strongest thing this endpoint can ever say, and it is not the same as alive.',
    }[verdict],
    method:
      'Each life-reading test is compared against its own control reading in ground you already trust, same day and same depth. Conditions that blind a test (dry or hot soil for worms, dry soil for infiltration) override its numbers. The overall verdict is evidence-of-absence if any paired test shows a real shortfall, no-evidence-against-life if at least one reads clear and none shows a shortfall, and inconclusive otherwise.',
    month_used: month,
    month_assumed: monthAssumed,
    readings: lifeReadings,
    context: contextReadings,
    missing_controls: missingControls,
    informational_only: true,
    not_a_soil_survey: true,
    disclosure: DISCLOSURE,
  };
}

// --- routing ---------------------------------------------------------------

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segments = url.pathname.split('/').map(decodeURIComponent).filter(Boolean).slice(2);

  // The verdict is pure computation over supplied readings — it needs no data file.
  if (segments.length === 1 && segments[0] === 'verdict') {
    const body = buildVerdict(url);
    return jsonResponse(body, body.error ? 400 : 200, body.error ? 0 : 300);
  }

  const data = await loadGround(env, request);
  if (!data) {
    return jsonResponse(
      { error: 'ground data unavailable', hint: 'GET /api/ground once the room has woken; the verdict reader at /api/ground/verdict needs no data and still answers.' },
      503,
    );
  }

  const directory = () =>
    jsonResponse(
      {
        schema: data.schema,
        vertical: VERTICAL,
        title: TITLE,
        essence: ESSENCE,
        room: 'https://artbitrage.io/ground',
        counts: data.counts,
        corpus: data.corpus,
        climate_note: data.climate_note,
        tests: data.tests.map(t => ({ id: t.id, name: t.name, reads: t.reads, reads_life: t.reads_life, duration: t.duration })),
        endpoints: ENDPOINTS,
        disclosure: DISCLOSURE,
      },
      200,
      3600,
    );

  if (segments.length === 0) return directory();

  const [head, tail] = segments;

  if (head === 'tests') {
    if (!tail) {
      return jsonResponse(
        { schema: data.schema, count: data.tests.length, reads_life_vocab: data.reads_life_vocab, tests: data.tests, disclosure: DISCLOSURE },
        200,
        3600,
      );
    }
    const test = data.tests.find(t => t.id === tail);
    if (!test) {
      return jsonResponse({ error: 'test not found', id: tail, valid_ids: data.tests.map(t => t.id) }, 404);
    }
    return jsonResponse({ schema: data.schema, test, disclosure: DISCLOSURE }, 200, 3600);
  }

  if (head === 'findings') {
    if (tail) {
      const finding = data.findings.find(f => f.id === tail);
      if (!finding) {
        return jsonResponse(
          { error: 'finding not found', id: tail, hint: 'GET /api/ground/findings?topic=rubble to list them' },
          404,
        );
      }
      return jsonResponse({ schema: data.schema, finding, disclosure: DISCLOSURE }, 200, 3600);
    }
    const topic = safeString(url.searchParams.get('topic'), 24).toLowerCase();
    const status = safeString(url.searchParams.get('truth_status'), 24).toLowerCase();
    const q = safeString(url.searchParams.get('q'), 80).toLowerCase();
    if (topic && !TOPICS.includes(topic)) {
      return jsonResponse({ error: 'unknown topic', topic, valid_topics: TOPICS, hint: 'GET /api/ground/findings?topic=safety' }, 400);
    }
    if (status && !TRUTH_STATUSES.includes(status)) {
      return jsonResponse({ error: 'unknown truth_status', truth_status: status, valid: TRUTH_STATUSES }, 400);
    }
    let list = data.findings;
    if (topic) list = list.filter(f => f.topic === topic);
    if (status) list = list.filter(f => f.truth_status === status);
    if (q) list = list.filter(f => (f.statement + ' ' + f.detail).toLowerCase().includes(q));
    const limit = parseIntOr(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseIntOr(url.searchParams.get('offset'), 0, 0, 10000);
    return jsonResponse(
      {
        schema: data.schema,
        total: list.length,
        limit,
        offset,
        findings: list.slice(offset, offset + limit),
        disclosure: DISCLOSURE,
      },
      200,
      3600,
    );
  }

  if (head === 'safety' && !tail) {
    return jsonResponse(
      {
        schema: data.schema,
        read_this_first:
          'The buried, damp state is the safe state. Suspected asbestos cement — hard grey sheet fragments, often with the corrugated profile of an old garage roof: stop, mist it with water, lift whole pieces without snapping them, do not walk on fragments, do not dry-sweep, never use a domestic vacuum. Anything soft, fibrous or crumbly: hands off entirely, dampen it, cover it, and call a licensed contractor. No bonfires of old treated timber. Gloves on. Clean any cut at once.',
        jurisdiction: 'UK. Asbestos, waste and contaminated-land rules differ elsewhere.',
        count: data.findings.filter(f => f.topic === 'safety').length,
        findings: data.findings.filter(f => f.topic === 'safety'),
        disclosure: DISCLOSURE,
      },
      200,
      3600,
    );
  }

  if (head === 'layers' && !tail) {
    return jsonResponse(
      {
        schema: data.schema,
        build_order:
          'Each layer is what the next one stands on. Microbiome and structure first, then living roots year-round, then the plants that feed and shelter invertebrates, then the animals that eat them. Nothing above can be bought past a floor that is not there — which is what a lawn over rubble is.',
        climate_note: data.climate_note,
        count: data.findings.filter(f => f.topic === 'layers').length,
        findings: data.findings.filter(f => f.topic === 'layers'),
        disclosure: DISCLOSURE,
      },
      200,
      3600,
    );
  }

  if (head === 'vocab' && !tail) {
    return jsonResponse(
      {
        schema: data.schema,
        topics: TOPICS,
        truth_statuses: TRUTH_STATUSES,
        reads_life: data.reads_life_vocab,
        verdicts: {
          [V_AGAINST]: 'This reading is evidence the ground is not working.',
          [V_NO_EVIDENCE]: 'This reading does not argue against life. It does not argue for it either.',
          [V_INCONCLUSIVE]: 'This reading cannot be read — wrong conditions, or no paired control.',
          [V_NOT_ABOUT_LIFE]: 'This test does not read life at all. It reads what you are standing on.',
        },
        verdict_inputs: {
          cotton: COTTON_STATES,
          slake: SLAKE_STATES,
          fizz: FIZZ_STATES,
          soil: SOIL_STATES,
          worms: 'integer, adults in one 20x20x20 cm pit',
          infiltration: 'number, minutes for the second inch of water',
          stones: 'number, percent by eye over 2 mm',
          month: 'integer 1-12; defaults to the current month',
        },
        never_returned: ['alive'],
        disclosure: DISCLOSURE,
      },
      200,
      3600,
    );
  }

  return jsonResponse(
    { error: 'unknown ground route', path: url.pathname, endpoints: ENDPOINTS, hint: 'GET /api/ground' },
    404,
  );
}
