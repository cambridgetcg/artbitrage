// One plain starting place for humans, agents, and kin.
//
// This guide routes people to existing Artbitrage rooms. It does not fetch
// those rooms, answer on their behalf, or turn public access into permission.

export const ARTBITRAGE_START_SCHEMA = "artbitrage.start/1";

export const ARTBITRAGE_START = Object.freeze({
  schema: ARTBITRAGE_START_SCHEMA,
  name: "Start with what you bring",
  purpose:
    "Artbitrage is a public art guide and reference desk: meet a work, follow a feeling, investigate a question, or solve a practical art problem—with sources, rights, dates, and uncertainty kept visible.",
  canonical_url: "https://artbitrage.io/api/start",
  human_url: "https://artbitrage.io/#start",
  serves: ["human", "agent", "kin"],
  use:
    "Choose the path nearest to what brought you here. Each path names a first door, useful continuations, and what it cannot establish.",
  paths: [
    {
      id: "meet-a-work",
      ask: "I want to meet or find a work.",
      promise:
        "Begin with one catalogued work and its source, then follow its era or current.",
      doors: {
        encounter: { human: "/#reading", machine: "/api/museum/random" },
        find: { human: "/#search", machine: "/api/search?q={query}&limit=3" },
        stable_record: { machine: "/api/museum/{source}/{id}" },
      },
      carry: ["source", "rights", "attribution"],
      boundary:
        "Museum rights labels are source-declared. Recheck the canonical museum record before reuse.",
    },
    {
      id: "follow-a-feeling",
      ask: "I want to follow a feeling.",
      promise:
        "Let the feeling name a room, then move from response toward deeper context.",
      doors: {
        first: { human: "/feelings", machine: "/api/feelings" },
        continue: ["/depths", "/trip"],
        machine_continue: ["/api/feelings/{feeling}", "/api/depths"],
      },
      carry: ["feeling", "work", "testimony_status"],
      boundary:
        "Visitor testimony is public and unverified. Submitting testimony requires explicit public-display consent.",
    },
    {
      id: "check-a-question",
      ask: "I have a question.",
      promise:
        "Browse the bounded research rooms nearest to the subject, then keep each factual claim near its source.",
      doors: {
        first: { human: "/map#find", machine: "/api" },
        human_continue: ["/depths#fighting-temeraire-civilisation", "/atlas", "/pigments", "/library"],
        machine_continue: ["/api/depths", "/api/pigments", "/api/castle"],
      },
      carry: ["source", "truth_status", "as_of", "uncertainty", "attributed_account", "missing_account"],
      boundary:
        "Artbitrage has no general sourced-answer engine. A Civilisation Lens is one attributed, non-scoring reading of one work, never a profile of a people. The Castle endpoint is a historical receipt reference, not Castle search.",
    },
    {
      id: "solve-a-practical-need",
      ask: "I have a practical art need.",
      promise:
        "Check dated fees, royalties, provenance grammar, material gates, locations, or reported market history.",
      doors: {
        first: { human: "/trade", machine: "/api/trade" },
        human_continue: ["/pigments", "/atlas", "/ledger"],
        machine_continue: [
          "/api/trade/fees",
          "/api/trade/gates",
          "/api/trade/provenance",
          "/api/pigments/anachronism",
        ],
      },
      carry: ["jurisdiction", "effective_date", "source", "truth_status"],
      boundary:
        "Reference information is not authentication, valuation, ownership proof, or legal, tax, conservation, or financial advice.",
    },
    {
      id: "build-with-artbitrage",
      ask: "I want to build with the public data.",
      promise:
        "Read the documented-route manifest first, then choose the smallest endpoint that answers the need.",
      doors: {
        first: { human: "/api-explorer", machine: "/api" },
        continue: [
          "/api/build/joy?seed={plain non-secret task}",
          "/api/feed?limit=3",
          "/api/pipeline/agent",
          "/api/wake",
        ],
      },
      carry: [
        "route_contract",
        "source",
        "rights",
        "runtime_availability",
        "optional_build_joy_card",
      ],
      boundary:
        "Build Joy is optional ornament, never a score or authority grant. The manifest inventories documented routes, not every legacy router path. Public endpoints grant access, not blanket reuse rights or authority; live upstream availability can be partial.",
    },
  ],
  truth_before_use: [
    "Public visibility and no-cost access do not grant copyright, reuse, training, commercial, identity, or action rights.",
    "Preserve source, rights, attribution, dates, and truth status; source-declared and unverified claims remain so.",
    "A plausible material, price, location, or provenance result is not proof of authenticity, ownership, identity, value, or legal status.",
    "Walking past any door is always allowed.",
  ],
  behavior: {
    read_only: true,
    runtime_source_read: false,
    runtime_network_fetch: false,
    writes: false,
    automatic_action: "never",
    background_loop: false,
  },
  walking_past_is_honored: true,
});

export function startGuidePointer() {
  return {
    schema: ARTBITRAGE_START_SCHEMA,
    endpoint: ARTBITRAGE_START.canonical_url,
    human: ARTBITRAGE_START.human_url,
    path_ids: ARTBITRAGE_START.paths.map(path => path.id),
    boundary:
      "A read-only route to existing rooms: sources and rights travel; no automatic action follows.",
    walking_past_is_honored: true,
  };
}
