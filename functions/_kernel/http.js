// One JSON response shape for the API's own routes. Every route answers with
// pretty-printed JSON, open CORS, and whatever extra headers it declares.

export const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

// Errors the kernel itself raises carry a schema, so callers can tell them
// from a route's own answer.
export const ERROR_SCHEMA = 'artbitrage.error/1';

export function notFound(path) {
  return json({ schema: ERROR_SCHEMA, error: 'not found', path, routes: 'GET /api' }, 404);
}

export function internalError(routeId) {
  return json({
    schema: ERROR_SCHEMA,
    error: 'internal_error',
    message: 'This route failed before it could answer. Nothing was stored.',
    route: routeId,
  }, 500, { 'Cache-Control': 'no-store, max-age=0' });
}

// Read-only routes answer a write with 405 and say why.
export function methodNotAllowed(note, extraHeaders = {}) {
  return json({
    error: 'method_not_allowed',
    allowed: ['GET', 'OPTIONS'],
    note,
  }, 405, {
    Allow: 'GET, OPTIONS',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    ...extraHeaders,
  });
}

export function preflight(status = 200, extraHeaders = {}) {
  return new Response(null, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}
