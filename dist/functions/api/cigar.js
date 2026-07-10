// ARTBITRAGE API — CIGAR vertical directory
// Serverless API running on Cloudflare Pages Functions
// Handles GET /api/cigar exactly; subroutes live in functions/api/cigar/[[route]].js

const DIRECTORY = {
  vertical: "cigar",
  title: "Cigar — Patience Made Smoke",
  essence: "A cigar is the arbitrage between leaf and fire. Patience made smoke.",
  endpoints: [
    { method: "GET", path: "/api/cigar", desc: "This directory" },
    { method: "GET", path: "/api/cigar/story", desc: "From seed to smoke — the history of the cigar in chapters" },
    { method: "GET", path: "/api/cigar/regions", desc: "The great tobacco-growing regions of the world" },
    { method: "GET", path: "/api/cigar/brands", desc: "The great cigar houses" },
    { method: "GET", path: "/api/cigar/brands/:id", desc: "One brand by id, e.g. /api/cigar/brands/cohiba" },
    { method: "GET", path: "/api/cigar/collections", desc: "Curated collections of brands" },
    { method: "GET", path: "/api/cigar/collections/:id", desc: "One collection, its brand ids resolved to full brand objects" },
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
    { method: "GET", path: "/api/cigar/search?q=", desc: "Case-insensitive search across brands, regions, stores, and techniques" },
  ],
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestGet() {
  return jsonResponse(DIRECTORY);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
