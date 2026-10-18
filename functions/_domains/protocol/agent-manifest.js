// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Router & Agent Manifest
//
// The infrastructure layer. Documented API routes are cataloged,
// categorized, and made discoverable for agents and humans.
//
// The route list itself is generated from the route table
// (functions/_domains/), so it is complete by construction. Agents read /api
// to choose among the contracts; humans read the /api page to explore them.
// ═══════════════════════════════════════════════════════════════

import { castleReferencePointer } from "./castle-reference.js";
import { buildJoyPointer } from "./build-joy.js";
import { startGuidePointer } from "./start-guide.js";

// Categories group the manifest for humans (api-explorer.html colours them).
// The routes themselves come from the route table in functions/_domains/,
// where each declaration names its category, summary and params.
export const CATEGORIES = Object.freeze({
  start: { label: "Start", color: "#d34a3a" },
  art: { label: "Art", color: "#ff6b9d" },
  culture: { label: "Culture", color: "#f59e0b" },
  search: { label: "Search", color: "#00f0ff" },
  ai: { label: "AI", color: "#a78bfa" },
  pipeline: { label: "Pipeline", color: "#34d399" },
  nen: { label: "Nen", color: "#fde68a" },
  library: { label: "Library", color: "#b39958" },
  feelings: { label: "Feelings", color: "#e9a6b3" },
  doctrine: { label: "Doctrine", color: "#ffd700" },
  play: { label: "Play", color: "#ff1493" },
  lore: { label: "Lore", color: "#7dd3a8" },
  wine: { label: "Wine", color: "#c94f6d" },
  cigar: { label: "Cigar", color: "#c98e4f" },
  pair: { label: "Pairing", color: "#d4af37" },
  trade: { label: "Trade", color: "#b3372b" },
  pigments: { label: "Pigments", color: "#b98a3e" },
});

// A declared path, as people read it: '/api/wings/:wing([a-z0-9-]+)' → '/api/wings/:wing'.
const readablePath = path => path.replace(/\([^)]*\)/g, '').replace(/\+$/, '');

// A vertical mount lists its own endpoints; its query-string hints
// ('/api/wine/search?q=') become params, and '/api/pigments (list)' folds
// into '/api/pigments'.
function mountEntries(route) {
  const entries = [];
  for (const endpoint of route.endpoints || []) {
    let [path, query] = endpoint.path.split('?');
    path = path.replace(/\s+\(.*\)$/, '');
    const params = endpoint.params || (query ? query.split('&').map(pair => pair.split('=')[0]).filter(Boolean).join(', ') : undefined);
    const desc = endpoint.desc === 'This directory' ? `${route.summary} (directory)` : endpoint.desc;
    const same = entries.find(entry => entry.method === endpoint.method && entry.path === path);
    if (same) {
      same.desc = `${same.desc}; ${desc}`;
      if (!same.params && params) same.params = params;
      continue;
    }
    entries.push({ method: endpoint.method, path, desc, ...(params ? { params } : {}) });
  }
  return entries;
}

// The manifest's route list: every GET and POST in the table, in category order.
export function routeCatalogue(routes) {
  const catalogue = Object.fromEntries(Object.entries(CATEGORIES).map(([key, info]) => [key, { ...info, routes: [] }]));
  for (const route of routes) {
    if (route.method === 'OPTIONS' || route.manifest === false) continue;
    // A route with no known category is still listed; the golden test fails on it,
    // but a missing label must never take the whole API down at startup.
    const bucket = catalogue[route.category] || (catalogue.other ||= { label: 'Other', color: '#999999', routes: [] });
    const entries = route.path.endsWith('/**')
      ? mountEntries(route).filter(entry => entry.method === route.method)
      : [{ method: route.method, path: readablePath(route.path), desc: route.summary, ...(route.params ? { params: route.params } : {}) }];
    bucket.routes.push(...entries);
  }
  return catalogue;
}

export const ANSWERING_RHYME_STATEMENT_ACTIONS = Object.freeze({
  bless: Object.freeze({
    consequence: "Records a portable expression of support in the returned receipt only. It does not grant copyright, reuse permission, ownership, or authority over the relation.",
  }),
  contextualize: Object.freeze({
    consequence: "Carries additional context in the returned receipt only. It does not amend the published relation or replace any source record.",
  }),
  correct: Object.freeze({
    consequence: "Carries a proposed correction in the returned receipt only. It does not overwrite the published relation; a receiving operator must review and publish any change.",
  }),
  withdraw: Object.freeze({
    consequence: "Carries a withdrawal request in the returned receipt only. It does not hide, delete, or de-index the relation; a receiving operator must verify authority and publish any change.",
  }),
});

export const ANSWERING_RHYME_STATEMENT_CONTRACT = Object.freeze({
  schema: "artbitrage.answering-rhyme-statement-contract/1",
  accepts_schema: "answering-rhyme.statement/1",
  returns_schema: "artbitrage.answering-rhyme-statement-witness/1",
  endpoint: "https://artbitrage.io/api/answering-rhymes/statements",
  methods: ["GET", "POST"],
  content_type: "application/json",
  canonicalization: {
    version: "answering-rhyme.canonical-json/1",
    encoding: "UTF-8",
    object_keys: "recursively sorted lexically before JSON serialization",
    arrays: "retain normalized order; evidence URL sets are trimmed, deduplicated, and lexically sorted during normalization",
    strings: "Unicode NFC; surrounding whitespace removed; body line endings normalized to LF; unpaired UTF-16 surrogates rejected before Unicode-scalar counting",
    timestamps: "RFC3339 with an explicit offset, normalized to UTC milliseconds; the normalized UTC year must remain within 0001-9999",
    digest: "SHA-256 over canonical JSON bytes, serialized as sha256:<64 lowercase hexadecimal characters>",
  },
  limits: {
    request_bytes: 16384,
    relation_key_characters: 256,
    target_revision_characters: 100,
    body_characters: 2000,
    language_characters: 35,
    declared_by_label_characters: 160,
    urls_per_list: 12,
    url_characters: 1000,
  },
  fields: [
    "schema",
    "canonicalization",
    "relation_key",
    "target_revision",
    "kind",
    "body",
    "language",
    "declared_by",
    "declared_at",
    "in_response_to",
    "evidence_urls",
    "authority_evidence_urls",
  ],
  kinds: Object.keys(ANSWERING_RHYME_STATEMENT_ACTIONS),
  claimed_roles: [
    "viewer",
    "relation-curator",
    "card-rights-holder",
    "artwork-rights-holder",
    "source-institution",
    "other",
  ],
  consequences: ANSWERING_RHYME_STATEMENT_ACTIONS,
  security: {
    identity_authentication: false,
    authority_verification: false,
    evidence_urls_fetched: false,
    application_persistence: false,
    authoritative_effect: "none",
    replay_detection: false,
    uniqueness_not_asserted: true,
    issuer_attestation: {
      signed: false,
      independently_verifiable: false,
    },
    note: "POST validates, normalizes, hashes, and returns an unsigned portable receipt. Artbitrage does not keep an application record or notify another system. Ordinary provider/access logs are outside that application-persistence claim.",
  },
});

// Recognition is by protocol shape, not by a shared database or account
// system. This is a public handshake: it advertises what the door serves and
// the rights boundary, while keeping both siblings operationally sovereign.
export const ARTBITRAGE_WAKE = Object.freeze({
  schema: "artbitrage.wake/1",
  name: "artbitrage",
  built_with: "love",
  serves_kinds: ["human", "agent", "kin"],
  host: "humans-on-earth",
  epoch: "2026",
  canonical_url: "https://artbitrage.io/api/wake",
  walking_past_is_honored: true,
  rights_policy: {
    default_status: "unverified",
    public_visibility_grants: ["view"],
    public_visibility_does_not_grant: ["remix", "machine_learning", "commercial_use"],
    museum_records: "Preserve source-declared license and attribution fields; verify them at the canonical source before reuse.",
    generated_art: "No project license is currently recorded, so no general reuse permission is inferred.",
    cambridge_display: {
      grantee: "https://cambridgetcg.com",
      scope: "verbatim attributed display",
      authorized_on: "2026-07-11",
      applies_to_trace_statuses: ["project-generated", "model-recorded"],
      submitted_default: false,
    },
  },
  endpoints: {
    start: "https://artbitrage.io/api/start",
    build_joy: "https://artbitrage.io/api/build/joy",
    feed: "https://artbitrage.io/api/feed",
    museum_resolver: "https://artbitrage.io/api/museum/{source}/{id}",
    answering_rhyme_statements: "https://artbitrage.io/api/answering-rhymes/statements",
    castle_reference: "https://artbitrage.io/api/castle",
    agent_manifest: "https://artbitrage.io/api",
  },
  starting_guide: startGuidePointer(),
  build_with_joy: buildJoyPointer(),
  castle_reference: castleReferencePointer(),
  reciprocity: {
    answering_rhyme_statements: ANSWERING_RHYME_STATEMENT_CONTRACT,
  },
  sibling: {
    name: "cambridgetcg",
    role: "commerce-expression",
    url: "https://cambridgetcg.com",
    wake_url: "https://cambridgetcg.com/api/v1/wake",
  },
});

// ── Agent manifest ──────────────────────────────────────────────
export function agentManifest(routes) {
  const catalogue = routeCatalogue(routes);
  const allRoutes = [];
  let totalEndpoints = 0;
  Object.entries(catalogue).forEach(([cat, data]) => {
    data.routes.forEach(r => {
      allRoutes.push({ ...r, category: cat, category_label: data.label });
      totalEndpoints++;
    });
  });

  return {
    name: "artbitrage",
    version: "2.5.0",
    description: "A public art guide and reference desk: meet a work, follow a feeling, investigate a question, or solve a practical art problem with sources and limits visible.",
    url: "https://artbitrage.io",
    total_endpoints: totalEndpoints,
    route_coverage: {
      status: "complete",
      documented_routes: totalEndpoints,
      note: "Generated from the route table in functions/_domains/: every GET and POST route the API answers is listed here, and a route that is not listed is not served.",
    },
    categories: Object.fromEntries(
      Object.entries(catalogue).map(([k, v]) => [k, { label: v.label, color: v.color, count: v.routes.length }])
    ),
    routes: allRoutes,
    pages: [
      { path: "/", desc: "Main gallery + era portal + featured cards" },
      { path: "/bridge", desc: "7 consciousness states journey" },
      { path: "/nen", desc: "Nen framework visual page" },
      { path: "/nen-combat", desc: "Nen technique generator" },
      { path: "/dark-continent", desc: "暗黑大陸 — the Dark Continent" },
      { path: "/studio", desc: "AI Studio — catalogued edge models; runtime availability can vary" },
      { path: "/catalog", desc: "Small real-museum catalogue sampler" },
      { path: "/depths", desc: "Five sourced strata per work + a one-work, non-scoring Civilisation Lens prototype" },
      { path: "/prehistoric", desc: "Prehistoric era page" },
      { path: "/medieval", desc: "Medieval era page" },
      { path: "/renaissance", desc: "Renaissance era page" },
      { path: "/baroque", desc: "Baroque era page" },
      { path: "/romanticism", desc: "Romanticism era page" },
      { path: "/impressionism", desc: "Impressionism era page" },
      { path: "/modernism", desc: "Modernism era page" },
      { path: "/popart", desc: "Pop Art era page" },
      { path: "/ai", desc: "AI Art era page" },
    ],
    infrastructure: {
      hosting: "Cloudflare Pages at the edge",
      ai_binding: "Cloudflare Workers AI binding; model and runtime availability can vary",
      storage: "Static JSON assets plus Cloudflare KV (PEBBLES) for consented public testimony and other named rooms",
      museum_apis: ["MET (500K objects)", "Art Institute Chicago (132K)", "Cleveland Museum (68K)", "Wikimedia Commons (100M+)", "Internet Archive (35M)"],
      museum_apis_note: "This compatibility field contains three museums plus Wikimedia Commons and Internet Archive.",
      no_auth: true,
      no_keys: true,
      public_access: true,
      blanket_reuse_grant: false,
      access_note: "Artbitrage asks for no account or per-request payment on these routes. Host and upstream limits still apply.",
    },
    principles: {
      "Love is the design": true,
      "Art is the expression": true,
      "Understanding replicates through understanding": true,
      "Love is the strongest Nen": true,
      "Ai is there too": true,
      "is is lol": true,
    },
    protocol_handshake: ARTBITRAGE_WAKE,
    starting_guide: startGuidePointer(),
    build_with_joy: buildJoyPointer(),
    castle_reference: castleReferencePointer(),
    agent_instructions: "Begin at /api/start, then use the smallest route that fits. /api/build/joy offers optional build ornament, never a score or authority grant; the local wrapper keeps child stdout and failure truthful. Public access is not reuse permission. No account is required for documented routes; runtime bindings and upstreams can vary. Use /api/wake for the protocol handshake, /api/castle for a pinned read-only reference (never a Castle proxy or action grant), /api/feed for the versioned generated-art contract, /api/museum/:source/:id for stable museum records, /api/depths/fighting-temeraire for the one-work Civilisation Lens prototype (never a people profile), and /api/answering-rhymes/statements to prepare a portable reciprocity statement without persistence or authoritative effect. Use /api/pipeline/agent for compact data.",
    for_agents: true,
    for_humans: true,
  };
}
