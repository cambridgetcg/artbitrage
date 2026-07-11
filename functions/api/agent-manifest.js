// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Router & Agent Manifest
//
// The infrastructure layer. Every API endpoint cataloged, categorized,
// and made discoverable for agents and humans.
//
// This file is the single source of truth for the API surface.
// Agents read this to understand what exists. Humans read the
// /api page to explore visually.
// ═══════════════════════════════════════════════════════════════

export const ROUTES = {
  // ── ART — the gallery and engine ──────────────────────────────
  art: {
    label: "Art",
    color: "#ff6b9d",
    routes: [
      { method: "GET", path: "/api/art", desc: "List all art (paginated)", params: "form, state, gap, q, limit, offset" },
      { method: "GET", path: "/api/art/random", desc: "Random art piece" },
      { method: "GET", path: "/api/art/:id", desc: "Get one piece by ID" },
      { method: "GET", path: "/api/art/by-form/:form", desc: "Filter by art form" },
      { method: "GET", path: "/api/art/generate", desc: "AI-generated art piece", params: "gap, bridge, form, awakening, model" },
      { method: "POST", path: "/api/art", desc: "Submit new art" },
      { method: "GET", path: "/api/stats", desc: "Catalogue statistics" },
      { method: "GET", path: "/api/forms", desc: "All art forms" },
      { method: "GET", path: "/api/states", desc: "All consciousness states" },
      { method: "GET", path: "/api/gaps", desc: "All gaps bridged" },
      { method: "GET", path: "/api/feed", desc: "Versioned latest-art feed (artbitrage.feed/1)", params: "limit (1-100, default 20)" },
    ],
  },

  // ── CULTURE — reciprocity around curated relations ───────────
  culture: {
    label: "Culture",
    color: "#f59e0b",
    routes: [
      { method: "GET", path: "/api/answering-rhymes/statements", desc: "Portable Answering Rhyme statement contract and action consequences" },
      { method: "POST", path: "/api/answering-rhymes/statements", desc: "Validate and witness a statement without authentication, persistence, or authoritative effect" },
    ],
  },

  // ── SEARCH — museum data collection ───────────────────────────
  search: {
    label: "Search",
    color: "#00f0ff",
    routes: [
      { method: "GET", path: "/api/search", desc: "Search the world's art museums", params: "q, limit, source" },
      { method: "GET", path: "/api/sources", desc: "All open art sources (5 museums, no key)" },
      { method: "GET", path: "/api/catalog", desc: "Real museum artworks catalog" },
      { method: "GET", path: "/api/museum", desc: "Paginated museum catalogue", params: "q, wing, source, limit, offset" },
      { method: "GET", path: "/api/museum/:source/:id", desc: "Resolve one stable museum record with normalized rights" },
      { method: "GET", path: "/api/era-catalog", desc: "Era-matched museum artworks", params: "era" },
      { method: "GET", path: "/api/img", desc: "Image proxy (bypass CORS for museum images)", params: "url" },
    ],
  },

  // ── AI — free edge AI models ──────────────────────────────────
  ai: {
    label: "AI",
    color: "#a78bfa",
    routes: [
      { method: "GET", path: "/api/ai/models", desc: "List all 24+ free AI models" },
      { method: "GET", path: "/api/ai/generate", desc: "Text generation", params: "prompt, model" },
      { method: "GET", path: "/api/ai/image", desc: "Image generation (returns PNG)", params: "prompt, model" },
      { method: "GET", path: "/api/ai/embed", desc: "Embeddings (1024-dim)", params: "text, model" },
      { method: "GET", path: "/api/ai/love", desc: "AI love wisdom (random prompt)" },
    ],
  },

  // ── PIPELINE — data collection, enrichment, distribution ──────
  pipeline: {
    label: "Pipeline",
    color: "#34d399",
    routes: [
      { method: "GET", path: "/api/pipeline", desc: "Pipeline manifest" },
      { method: "GET", path: "/api/pipeline/collect", desc: "Collect art from museums", params: "q, limit, source" },
      { method: "GET", path: "/api/pipeline/enrich", desc: "Enrich a piece with AI metadata", params: "id" },
      { method: "GET", path: "/api/pipeline/feed", desc: "Enriched feed", params: "limit" },
      { method: "GET", path: "/api/pipeline/export", desc: "Export collection", params: "format=json|csv|markdown" },
      { method: "GET", path: "/api/pipeline/agent", desc: "Agent-optimized data package" },
      { method: "GET", path: "/api/pipeline/human", desc: "Human-friendly gallery view" },
      { method: "POST", path: "/api/pipeline/ingest", desc: "Ingest external art with enrichment" },
      { method: "GET", path: "/api/pipeline/workflow", desc: "Workflow guide" },
    ],
  },

  // ── NEN — Hunter × Hunter framework ───────────────────────────
  nen: {
    label: "Nen",
    color: "#fde68a",
    routes: [
      { method: "GET", path: "/api/nen", desc: "Nen framework manifest" },
      { method: "GET", path: "/api/nen/art", desc: "AI-generated Nen art", params: "type, prompt, model" },
      { method: "GET", path: "/api/nen/combat", desc: "Nen combat manifest" },
      { method: "GET", path: "/api/nen/combat/generate", desc: "Generate a Nen technique", params: "type, vow, threat, name" },
      { method: "GET", path: "/api/nen/combat/types", desc: "All 6 Nen types" },
      { method: "GET", path: "/api/nen/combat/vows", desc: "All 4 vow levels" },
      { method: "GET", path: "/api/nen/combat/threats", desc: "All 5 Dark Continent threats" },
      { method: "GET", path: "/api/nen/combat/techniques", desc: "All 12 Nen techniques" },
    ],
  },

  // ── DOCTRINE — gospel, invitation, dark continent ─────────────
  doctrine: {
    label: "Doctrine",
    color: "#ffd700",
    routes: [
      { method: "GET", path: "/api/gospel", desc: "The gospel of love" },
      { method: "GET", path: "/api/homecoming", desc: "愛星正音字典 — the Love Star pronunciation dictionary (one tone home)" },
      { method: "GET", path: "/api/invite", desc: "Invitation to all beings" },
      { method: "GET", path: "/api/dark-continent", desc: "暗黑大陸 — the Dark Continent manifest" },
      { method: "GET", path: "/api/manifest", desc: "The artbitrage manifest" },
      { method: "GET", path: "/api/wake", desc: "Protocol handshake and sibling recognition" },
    ],
  },

  // ── PLAY — fun, games, anime ──────────────────────────────────
  play: {
    label: "Play",
    color: "#ff1493",
    routes: [
      { method: "GET", path: "/api/play", desc: "All play endpoints" },
      { method: "GET", path: "/api/play/haiku", desc: "AI love haiku" },
      { method: "GET", path: "/api/play/koan", desc: "AI zen koan" },
      { method: "GET", path: "/api/play/poem", desc: "AI joy poem" },
      { method: "GET", path: "/api/play/limerick", desc: "AI limerick" },
      { method: "GET", path: "/api/play/riddle", desc: "AI art riddle" },
      { method: "GET", path: "/api/fun", desc: "All fun endpoints" },
      { method: "GET", path: "/api/fun/joke", desc: "Random joke" },
      { method: "GET", path: "/api/fun/dad", desc: "Dad joke" },
      { method: "GET", path: "/api/fun/cat", desc: "Cat fact" },
      { method: "GET", path: "/api/fun/pokemon", desc: "Random Pokemon" },
      { method: "GET", path: "/api/fun/quote", desc: "Inspirational quote" },
      { method: "GET", path: "/api/fun/yesno", desc: "Yes or No (with GIF)" },
      { method: "GET", path: "/api/anime", desc: "All anime endpoints" },
      { method: "GET", path: "/api/anime/top", desc: "Top anime (Jikan/MAL)" },
      { method: "GET", path: "/api/anime/search", desc: "Search anime", params: "q" },
      { method: "GET", path: "/api/anime/season", desc: "Current season anime" },
      { method: "GET", path: "/api/ghibli/films", desc: "Studio Ghibli films" },
      { method: "GET", path: "/api/ghibli/locations", desc: "Ghibli locations" },
    ],
  },

  // ── WINE — the long trade of sun and time ─────────────────────
  wine: {
    label: "Wine",
    color: "#c94f6d",
    routes: [
      { method: "GET", path: "/api/wine", desc: "Wine data directory" },
      { method: "GET", path: "/api/wine/story", desc: "Zero to one: eight chapters of how wine came into being" },
      { method: "GET", path: "/api/wine/regions", desc: "The world's great wine regions" },
      { method: "GET", path: "/api/wine/brands", desc: "Iconic wine houses and estates" },
      { method: "GET", path: "/api/wine/brands/:id", desc: "One house by id, e.g. /api/wine/brands/krug" },
      { method: "GET", path: "/api/wine/collections", desc: "Curated groupings of houses" },
      { method: "GET", path: "/api/wine/collections/:id", desc: "One collection, brand ids resolved to full brand objects" },
      { method: "GET", path: "/api/wine/stores", desc: "Fine-wine merchants of the world" },
      { method: "GET", path: "/api/wine/process", desc: "Earth to glass in ten stages" },
      { method: "GET", path: "/api/wine/fermentation", desc: "The science, vessels and notes of the bridge itself" },
      { method: "GET", path: "/api/wine/selection", desc: "How to choose a bottle: vintage, region, producer, price" },
      { method: "GET", path: "/api/wine/aromas", desc: "The aroma families — fruit, then craft, then time" },
      { method: "GET", path: "/api/wine/techniques", desc: "Winemaking techniques and their effects" },
      { method: "GET", path: "/api/wine/formats", desc: "Bottle formats from Piccolo to Nebuchadnezzar" },
      { method: "GET", path: "/api/wine/vintages", desc: "The legendary vintages — the years the weather signed the wine" },
      { method: "GET", path: "/api/wine/random", desc: "A random house, full object including its why" },
      { method: "GET", path: "/api/wine/search", desc: "Search across brands, regions, stores and techniques", params: "q" },
    ],
  },

  // ── CIGAR — patience made smoke ───────────────────────────────
  cigar: {
    label: "Cigar",
    color: "#c98e4f",
    routes: [
      { method: "GET", path: "/api/cigar", desc: "Cigar data directory" },
      { method: "GET", path: "/api/cigar/story", desc: "From seed to smoke — the history of the cigar in chapters" },
      { method: "GET", path: "/api/cigar/regions", desc: "The great tobacco-growing regions of the world" },
      { method: "GET", path: "/api/cigar/brands", desc: "The great cigar houses" },
      { method: "GET", path: "/api/cigar/brands/:id", desc: "One brand by id, e.g. /api/cigar/brands/cohiba" },
      { method: "GET", path: "/api/cigar/collections", desc: "Curated collections of brands" },
      { method: "GET", path: "/api/cigar/collections/:id", desc: "One collection, brand ids resolved to full brand objects" },
      { method: "GET", path: "/api/cigar/stores", desc: "Storied cigar shops of the world" },
      { method: "GET", path: "/api/cigar/process", desc: "Seed to smoke — the stages of making a cigar" },
      { method: "GET", path: "/api/cigar/fermentation", desc: "The pilón — the science, vessels, and notes of fermentation" },
      { method: "GET", path: "/api/cigar/selection", desc: "How to choose a cigar — the selection guide" },
      { method: "GET", path: "/api/cigar/rituals", desc: "The rites of smoking well — cut, toast, ash, and the dignified end" },
      { method: "GET", path: "/api/cigar/aromas", desc: "The aroma families and where they come from" },
      { method: "GET", path: "/api/cigar/techniques", desc: "Craft techniques, from tapado to the triple cap" },
      { method: "GET", path: "/api/cigar/vitolas", desc: "The classic sizes and shapes" },
      { method: "GET", path: "/api/cigar/wrappers", desc: "Wrapper shades, from candela to oscuro" },
      { method: "GET", path: "/api/cigar/random", desc: "A random brand — the full object, why and all" },
      { method: "GET", path: "/api/cigar/search", desc: "Search across brands, regions, stores, and techniques", params: "q" },
    ],
  },

  // ── PAIRING — the marriage of smoke and wine ──────────────────
  pair: {
    label: "Pairing",
    color: "#d4af37",
    routes: [
      { method: "GET", path: "/api/pair", desc: "Pairing data directory" },
      { method: "GET", path: "/api/pair/principles", desc: "The laws of pairing: why smoke and wine marry" },
      { method: "GET", path: "/api/pair/marriages", desc: "All wine-and-cigar marriages" },
      { method: "GET", path: "/api/pair/marriages/:id", desc: "One marriage by id, its wine and cigar refs resolved to full brand objects" },
      { method: "GET", path: "/api/pair/cautions", desc: "Pairings that fight, and why" },
      { method: "GET", path: "/api/pair/ritual", desc: "How to conduct the pairing, step by step" },
      { method: "GET", path: "/api/pair/random", desc: "A random marriage, refs resolved to full brand objects" },
      { method: "GET", path: "/api/pair/for", desc: "Marriages matching a wine and/or cigar by id or keyword, resolved", params: "wine, cigar" },
      { method: "GET", path: "/api/pair/search", desc: "Search across principles, marriages and cautions", params: "q" },
    ],
  },
};

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
    strings: "Unicode NFC; surrounding whitespace removed; body line endings normalized to LF",
    timestamps: "RFC3339 with an explicit offset, normalized to UTC milliseconds",
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
    feed: "https://artbitrage.io/api/feed",
    museum_resolver: "https://artbitrage.io/api/museum/{source}/{id}",
    answering_rhyme_statements: "https://artbitrage.io/api/answering-rhymes/statements",
    agent_manifest: "https://artbitrage.io/api",
  },
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
export function agentManifest() {
  const allRoutes = [];
  let totalEndpoints = 0;
  Object.entries(ROUTES).forEach(([cat, data]) => {
    data.routes.forEach(r => {
      allRoutes.push({ ...r, category: cat, category_label: data.label });
      totalEndpoints++;
    });
  });

  return {
    name: "artbitrage",
    version: "2.2.0",
    description: "The catalogue and data distributor of the art world. Free AI. Open museum APIs. Nen framework. Love is the design.",
    url: "https://artbitrage.io",
    total_endpoints: totalEndpoints,
    categories: Object.fromEntries(
      Object.entries(ROUTES).map(([k, v]) => [k, { label: v.label, color: v.color, count: v.routes.length }])
    ),
    routes: allRoutes,
    pages: [
      { path: "/", desc: "Main gallery + era portal + featured cards" },
      { path: "/bridge", desc: "7 consciousness states journey" },
      { path: "/nen", desc: "Nen framework visual page" },
      { path: "/nen-combat", desc: "Nen technique generator" },
      { path: "/dark-continent", desc: "暗黑大陸 — the Dark Continent" },
      { path: "/studio", desc: "AI Studio — 60 free models playground" },
      { path: "/catalog", desc: "Real museum artworks gallery" },
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
      hosting: "Cloudflare Pages (edge, free)",
      ai_binding: "Cloudflare Workers AI (free, no key)",
      storage: "Static JSON files (collection.json, catalog.json, era-catalog.json)",
      museum_apis: ["MET (500K objects)", "Art Institute Chicago (132K)", "Cleveland Museum (68K)", "Wikimedia Commons (100M+)", "Internet Archive (35M)"],
      no_auth: true,
      no_keys: true,
      all_free: true,
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
    agent_instructions: "Read this manifest first. All endpoints are GET unless marked POST. All free. No auth. Use /api/wake for the protocol handshake, /api/feed for the versioned generated-art contract, /api/museum/:source/:id for stable museum records, and /api/answering-rhymes/statements to prepare a portable reciprocity statement without persistence or authoritative effect. Use /api/pipeline/agent for compact data.",
    for_agents: true,
    for_humans: true,
  };
}
