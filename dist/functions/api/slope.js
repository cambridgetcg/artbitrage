// ARTBITRAGE /api/slope — the bare path.
//
// Cloudflare Pages routes the EXACT path /api/slope to this file, while
// functions/api/slope/[[route]].js owns the subtree /api/slope/*. Re-exporting
// keeps one source of truth. Mirrors the role of functions/api/ground.js.

export { onRequestGet, onRequestOptions } from './slope/[[route]].js';
