// ARTBITRAGE /api/trade — directory of the trade vertical
// Reference & computation for auction houses and galleries (TRADE-MODULE.md).
// This file handles GET /api/trade exactly; all subroutes live in functions/api/trade/[[route]].js

const VERTICAL = 'trade';
const TITLE = 'Trade — reference & computation for auction houses and galleries';
const ESSENCE = 'Artlogic manages; artbitrage speaks. No keys, no database, no funds, no take-rate.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  legal_advice: false,
  note: 'Reference arithmetic over cited public schedules. Confirm against the primary source before invoicing. Never legal, tax, or valuation advice.',
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/trade', desc: 'This directory' },
  { method: 'GET', path: '/api/trade/fees', desc: "Buyer's-premium schedules with effective dates and source citations", params: 'house, location, category, as_of' },
  { method: 'GET', path: '/api/trade/fees/compute', desc: 'All-in buyer cost: marginal band math, line items, schedule_applied, explicit not_included', params: 'hammer, currency, house, location, category, as_of' },
  { method: 'GET', path: '/api/trade/arr', desc: "Artist's Resale Right royalty: cumulative bands, cap status, liable society", params: 'price, currency=EUR, sale_date, artist_death_year, jurisdiction' },
  { method: 'GET', path: '/api/trade/thresholds', desc: 'Dated compliance constants (AML, export, import, VAT) with source_url per entry', params: 'jurisdiction, kind' },
  { method: 'GET', path: '/api/trade/gates', desc: 'Does this object cross a licensing/compliance gate — one call, each gate citing its regulation', params: 'year, value, currency, jurisdiction, materials, category' },
  { method: 'GET', path: '/api/trade/vocab', desc: 'Trade vocabularies: lot lifecycle, settlement status, heading-qualifier ladder, catalogue symbols, gallery availability' },
  { method: 'GET', path: '/api/trade/vocab/:id', desc: 'One vocabulary by id, e.g. /api/trade/vocab/heading-qualifiers' },
  { method: 'GET', path: '/api/trade/lots', desc: 'The frozen artbitrage.lot/1 contract: fields, enums, CSV door documentation' },
  { method: 'POST', path: '/api/trade/lots', desc: 'Validate lot records — application/json (one record) or text/csv (Artlogic-vocabulary fuzzy header mapping, then strict re-validation); echoes normalized records with content_hash; never stores' },
  { method: 'GET', path: '/api/trade/provenance', desc: 'The versioned aam-provenance/1 grammar: punctuation semantics with per-rule verification status' },
  { method: 'POST', path: '/api/trade/provenance', desc: 'Round-trip: {display_string} → parsed artbitrage.provenance-chain/1 events, or {events} → generated display string; never stores' },
  { method: 'GET', path: '/api/trade/results', desc: 'The voluntary results corpus with an honest coverage matrix — thin stated plainly, never fake-full' },
  { method: 'POST', path: '/api/trade/results', desc: 'Validate a results submission (price_basis required), receive an unsigned witness receipt and the pull-request persistence path' },
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function onRequestGet() {
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, disclosure: DISCLOSURE, endpoints: ENDPOINTS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
