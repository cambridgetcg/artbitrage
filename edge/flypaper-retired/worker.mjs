// The flypaper Worker, retired.
//
// From 2026-07-28 to October 2026 this script answered the five rooms that
// robots.txt labelled as a tarpit, slowly, with invented pages. Yu's ruling 3
// (2026-10-23, "honest no, plus alarms") retired it: each room answers 410 at
// once, with one line and a way back, and any other path answers a plain 404.
// Nothing is held, nothing is invented, nothing is recorded.
//
// Deployed with `wrangler versions upload` + `wrangler versions deploy`, so no
// zone route is set from here. The previous version stays in Cloudflare for
// rollback; its design history lives in chillspace-commons kingdom/trapline/.
// workerd refuses to start a main module with any named export but a handler,
// so these stay private to the module.
const LINE = 'A trap room stood here; retired October 2026. Nothing is here. The site is at /.';
const ROOMS = ['/lost', '/treasury', '/wallet-backup', '/investor-relations/private', '/internal/pricing-model'];
const NOT_FOUND = '404 Not Found\nNothing is published at this path.\nThe site starts at /.\n';
const SITE = 'https://artbitrage.io/';

// A room is its own path or anything under it, in any letter case, trailing slashes ignored.
function isRoom(pathname) {
  let path = pathname.toLowerCase();
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return ROOMS.some(room => path === room || path.startsWith(`${room}/`));
}

function wantsJson(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  return accept.includes('application/problem+json') || accept.includes('application/json');
}

// One whole answer with its length stated: nothing drips, nothing is held.
function whole(request, status, body, contentType, extra = {}) {
  const headers = {
    'content-type': contentType,
    'content-length': String(new TextEncoder().encode(body).length),
    'cache-control': 'no-store',
    ...extra,
  };
  return new Response(request.method === 'HEAD' ? null : body, { status, headers });
}

function gone(request) {
  const json = wantsJson(request);
  const body = json
    ? JSON.stringify({
        schema_version: 'xenia.surface.problem/0.1',
        type: SITE,
        title: 'Gone',
        status: 410,
        code: 'gone',
        detail: LINE,
        retryable: false,
        terminal: false,
        next_actions: [{ rel: 'home', href: SITE, method: 'GET', accept: 'text/html' }],
        docs: [SITE],
      })
    : `${LINE}\n`;
  return whole(request, 410, body, json ? 'application/problem+json' : 'text/plain; charset=utf-8',
    { 'vary': 'Accept', 'x-robots-tag': 'noindex' });
}

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    return isRoom(pathname) ? gone(request) : whole(request, 404, NOT_FOUND, 'text/plain; charset=utf-8');
  },
};
