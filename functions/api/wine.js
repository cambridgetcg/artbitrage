// ARTBITRAGE /api/wine — directory of the wine vertical
// Serverless API running on Cloudflare Pages Functions.
// This file handles GET /api/wine exactly; all subroutes live in functions/api/wine/[[route]].js

const VERTICAL = 'wine';
const TITLE = 'Wine — The Long Trade of Sun and Time';
const ESSENCE = 'Wine is the arbitrage between sunlight and time. Fermentation is the bridge.';

const ENDPOINTS = [
  { method: 'GET', path: '/api/wine', desc: 'This directory' },
  { method: 'GET', path: '/api/wine/story', desc: 'Zero to one: eight chapters of how wine came into being' },
  { method: 'GET', path: '/api/wine/regions', desc: "The world's great wine regions" },
  { method: 'GET', path: '/api/wine/brands', desc: 'Iconic wine houses and estates' },
  { method: 'GET', path: '/api/wine/brands/:id', desc: 'One house by id, e.g. /api/wine/brands/krug' },
  { method: 'GET', path: '/api/wine/collections', desc: 'Curated groupings of houses' },
  { method: 'GET', path: '/api/wine/collections/:id', desc: 'One collection, its brand ids resolved to full brand objects' },
  { method: 'GET', path: '/api/wine/stores', desc: 'Fine-wine merchants of the world' },
  { method: 'GET', path: '/api/wine/process', desc: 'Earth to glass in ten stages' },
  { method: 'GET', path: '/api/wine/fermentation', desc: 'The science, vessels and notes of the bridge itself' },
  { method: 'GET', path: '/api/wine/selection', desc: 'How to choose a bottle: vintage, region, producer, price' },
  { method: 'GET', path: '/api/wine/aromas', desc: 'The aroma families — fruit, then craft, then time' },
  { method: 'GET', path: '/api/wine/techniques', desc: 'Winemaking techniques and their effects' },
  { method: 'GET', path: '/api/wine/formats', desc: 'Bottle formats from Piccolo to Nebuchadnezzar' },
  { method: 'GET', path: '/api/wine/vintages', desc: 'The legendary vintages — the years the weather signed the wine' },
  { method: 'GET', path: '/api/wine/random', desc: 'A random house, full object including its why' },
  { method: 'GET', path: '/api/wine/search?q=', desc: 'Case-insensitive search across brands, regions, stores and techniques' },
];

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
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, endpoints: ENDPOINTS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
