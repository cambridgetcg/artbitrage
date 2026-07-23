// ARTBITRAGE /api/pigments — the exact /api/pigments path.
//
// Cloudflare Pages routes the EXACT path /api/pigments to this file, while the
// catch-all functions/api/pigments/[[route]].js owns /api/pigments/*. Because
// GET /api/pigments must serve BOTH the directory (no query) and the filtered
// list (with query, e.g. ?family=blue), this file delegates to the single
// router implementation rather than forking it — one source of truth. Mirrors
// the role of functions/api/trade.js (the directory door for the vertical).

export { onRequestGet, onRequestOptions } from './pigments/[[route]].js';
