// ARTBITRAGE /api/playlist — the bare path.
//
// Cloudflare Pages routes the EXACT path /api/playlist to this file, while
// functions/api/playlist/[[route]].js owns the subtree /api/playlist/*.
// Re-exporting keeps one source of truth. Mirrors functions/api/ground.js.

export { onRequestGet, onRequestOptions } from './playlist/[[route]].js';
