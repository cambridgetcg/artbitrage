// Cloudflare Pages routes the exact path /api/island here, while the catch-all
// functions/api/island/[[route]].js owns /api/island/*. One source of truth.
export { onRequestGet, onRequestPost, onRequestOptions } from './island/[[route]].js';
