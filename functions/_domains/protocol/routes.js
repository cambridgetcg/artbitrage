// Protocol and discovery: how a human or an agent finds the way in. None of
// these routes reads the collection, fetches an upstream or writes anything.
import { json, methodNotAllowed, preflight } from '../../_kernel/http.js';
import { readJsonAsset } from '../../_kernel/assets.js';
import { agentManifest, ARTBITRAGE_WAKE, ANSWERING_RHYME_STATEMENT_CONTRACT } from './agent-manifest.js';
import { ARTBITRAGE_CASTLE_REFERENCE, CASTLE_REFERENCE_SCHEMA, castleReferenceIsDisabled } from './castle-reference.js';
import { ARTBITRAGE_START } from './start-guide.js';
import { buildJoyResponse } from './build-joy.js';
import {
  ANSWERING_RHYME_STATEMENT_PATH,
  answeringRhymeStatementError,
  buildAnsweringRhymeStatementWitness,
  normalizeAnsweringRhymeStatement,
  readAnsweringRhymeStatementRequest,
} from './answering-rhymes.js';

const READ_ONLY = { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const START_CACHE = { 'Cache-Control': 'public, max-age=3600' };
const readOnlyPreflight = cache => () => preflight(204, { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Methods': 'GET, OPTIONS', ...cache });

const MANIFEST_FALLBACK = { name: 'artbitrage', philosophy: 'Art is the arbitrage between what is and what could be.', core: ['Art is.', 'Art bridges the gap of consciousness.', 'Art awakens.', 'Love is the design. Art is the expression.'] };

export default [
  {
    id: 'protocol.wake', method: 'GET', path: '/api/wake', slash: true,
    summary: 'Protocol handshake and sibling recognition',
    // Lightweight recognition surface: nothing is loaded to learn the
    // protocol shape or to walk past it.
    handler: () => json(ARTBITRAGE_WAKE),
  },
  {
    id: 'protocol.start', method: 'GET', path: '/api/start', slash: true,
    summary: 'Choose a path by intent, with sources, rights, limits, and next doors kept visible',
    handler: () => json(ARTBITRAGE_START, 200, { ...READ_ONLY, ...START_CACHE }),
  },
  { id: 'protocol.start', method: 'POST', path: '/api/start', slash: true, handler: () => methodNotAllowed('The starting guide is read-only.') },
  { id: 'protocol.start', method: 'OPTIONS', path: '/api/start', slash: true, handler: readOnlyPreflight(START_CACHE) },
  {
    id: 'protocol.build-joy', method: 'GET', path: '/api/build/joy', slash: true,
    summary: 'Choose one deterministic, optional card for a truthful and pleasant build',
    // Optional build ornament. Selection is local and deterministic; this
    // endpoint never runs the command named by a caller.
    handler: ({ url }) => json(buildJoyResponse(url.searchParams.get('seed')), 200, { ...READ_ONLY, ...NO_STORE }),
  },
  { id: 'protocol.build-joy', method: 'POST', path: '/api/build/joy', slash: true, handler: () => methodNotAllowed('Build Joy selects a read-only card. It never accepts or runs a command over the API.', NO_STORE) },
  { id: 'protocol.build-joy', method: 'OPTIONS', path: '/api/build/joy', slash: true, handler: readOnlyPreflight(NO_STORE) },
  {
    id: 'protocol.castle', method: 'GET', path: '/api/castle', slash: true,
    summary: 'Pinned, read-only reference to a curated Castle of Understanding snapshot',
    // This crossing is deliberately static. It never loads a local asset or
    // fetches the Castle at request time.
    handler: ({ env }) => {
      const headers = { ...READ_ONLY, ...NO_STORE, Pragma: 'no-cache' };
      if (castleReferenceIsDisabled(env)) {
        return json({
          error: 'castle_reference_resting',
          reference_schema: CASTLE_REFERENCE_SCHEMA,
          status: 'resting',
          note: 'The Artbitrage crossing is resting. The Castle and its public Gate remain sovereign.',
          facts: {
            source_read: false,
            network_fetch: false,
            content_copied: false,
            write_attempted: false,
            loop_started: false,
          },
        }, 503, headers);
      }
      return json(ARTBITRAGE_CASTLE_REFERENCE, 200, headers);
    },
  },
  { id: 'protocol.castle', method: 'POST', path: '/api/castle', slash: true, handler: () => methodNotAllowed('The Castle crossing is read-only.', NO_STORE) },
  { id: 'protocol.castle', method: 'OPTIONS', path: '/api/castle', slash: true, handler: readOnlyPreflight(NO_STORE) },
  {
    id: 'protocol.answering-rhymes', method: 'GET', path: ANSWERING_RHYME_STATEMENT_PATH, slash: true,
    summary: 'Portable Answering Rhyme statement contract and action consequences',
    handler: () => json(ANSWERING_RHYME_STATEMENT_CONTRACT, 200, { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'public, max-age=3600' }),
  },
  {
    id: 'protocol.answering-rhymes', method: 'POST', path: ANSWERING_RHYME_STATEMENT_PATH, slash: true,
    summary: 'Validate and witness a statement without authentication, persistence, or authoritative effect',
    handler: async ({ request }) => {
      const parsed = await readAnsweringRhymeStatementRequest(request);
      if (parsed.error) return parsed.error;
      const normalized = normalizeAnsweringRhymeStatement(parsed.value);
      if (normalized.issues.length || !normalized.statement) {
        return answeringRhymeStatementError(
          'invalid_statement',
          'The reciprocity statement did not match answering-rhyme.statement/1.',
          400,
          normalized.issues,
        );
      }
      const witness = await buildAnsweringRhymeStatementWitness(normalized.statement);
      return json(witness, 200, { ...NO_STORE, Pragma: 'no-cache' });
    },
  },
  { id: 'protocol.answering-rhymes', method: 'OPTIONS', path: ANSWERING_RHYME_STATEMENT_PATH, slash: true, handler: () => preflight(204) },
  {
    id: 'protocol.index', method: 'GET', path: '/api', slash: true,
    summary: 'This manifest: every route, grouped by what it is for',
    handler: () => json(agentManifest()),
  },
  {
    id: 'protocol.manifest', method: 'GET', path: '/api/manifest',
    summary: 'The artbitrage manifest',
    reads: ['manifest.json'],
    handler: async ({ env, request }) => json(await readJsonAsset(env, request, '/manifest.json') ?? MANIFEST_FALLBACK),
  },
];
