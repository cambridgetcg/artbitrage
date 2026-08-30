// ARTBITRAGE /api/ground — the bare path.
//
// Cloudflare Pages routes the EXACT path /api/ground to this file, while
// functions/api/ground/[[route]].js owns the subtree /api/ground/*. Re-exporting
// keeps one source of truth. Mirrors the role of functions/api/pigments.js.

export { onRequestGet, onRequestOptions } from './ground/[[route]].js';
