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
      { method: "GET", path: "/api/feed", desc: "Latest art feed (20 most recent)" },
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
      { method: "GET", path: "/api/invite", desc: "Invitation to all beings" },
      { method: "GET", path: "/api/dark-continent", desc: "暗黑大陸 — the Dark Continent manifest" },
      { method: "GET", path: "/api/manifest", desc: "The artbitrage manifest" },
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
};

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
    version: "2.0.0",
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
    agent_instructions: "Read this manifest first. All endpoints are GET unless marked POST. All free. No auth. Use /api/pipeline/agent for compact data. Use /api/nen/combat/generate for technique generation. Use /api/ai/image for image generation (returns raw PNG). Use /api/art/generate for AI-composed art.",
    for_agents: true,
    for_humans: true,
  };
}