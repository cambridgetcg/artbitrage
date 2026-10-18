// A small stand-in for the Cloudflare Pages Functions router, so tests can ask
// "what would production answer?" without a preview server.
//
// It builds the route table the way wrangler does: every file under functions/
// that exports onRequest* becomes routes; [[name]] segments are catch-alls that
// also match zero segments; routes are ordered by wrangler's compareRoutes
// (more segments first, static before param before wildcard, method-bound
// before method-less). The first route whose path and method match answers.
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const HANDLER_METHODS = {
  onRequestGet: 'GET',
  onRequestPost: 'POST',
  onRequestPut: 'PUT',
  onRequestPatch: 'PATCH',
  onRequestDelete: 'DELETE',
  onRequestHead: 'HEAD',
  onRequestOptions: 'OPTIONS',
  onRequest: null,
};

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else if (/\.(m?js|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function routePathFor(file, functionsDir) {
  const parts = relative(functionsDir, file).replace(/\.(m?js|ts)$/, '').split(sep);
  if (parts[parts.length - 1] === 'index') parts.pop();
  return '/' + parts.map(part => {
    const catchAll = /^\[\[(.+)\]\]$/.exec(part);
    if (catchAll) return `:${catchAll[1]}*`;
    const param = /^\[(.+)\]$/.exec(part);
    if (param) return `:${param[1]}`;
    return part;
  }).join('/');
}

// wrangler/src/pages/functions/filepath-routing.ts compareRoutes, verbatim in effect.
function compareRoutes(a, b) {
  const segs = routePath => routePath.slice(1).split('/').filter(Boolean);
  const sa = segs(a.routePath);
  const sb = segs(b.routePath);
  if (sa.length !== sb.length) return sb.length - sa.length;
  for (let i = 0; i < sa.length; i++) {
    const wa = sa[i].includes('*');
    const wb = sb[i].includes('*');
    const pa = sa[i].includes(':');
    const pb = sb[i].includes(':');
    if (wa && !wb) return 1;
    if (!wa && wb) return -1;
    if (pa && !pb) return 1;
    if (!pa && pb) return -1;
  }
  if (a.method && !b.method) return -1;
  if (!a.method && b.method) return 1;
  return a.routePath.localeCompare(b.routePath);
}

function compilePattern(routePath) {
  const names = [];
  const body = routePath.slice(1).split('/').filter(Boolean).map(segment => {
    const wildcard = /^:(\w+)\*$/.exec(segment);
    if (wildcard) {
      names.push({ name: wildcard[1], wildcard: true });
      return '(?:/((?:[^/]+)(?:/[^/]+)*))?';
    }
    const param = /^:(\w+)$/.exec(segment);
    if (param) {
      names.push({ name: param[1], wildcard: false });
      return '/([^/]+)';
    }
    return '/' + segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  const regex = new RegExp(`^${body}/?$`, 'i');
  return pathname => {
    const m = regex.exec(pathname);
    if (!m) return null;
    const params = {};
    names.forEach((entry, i) => {
      const value = m[i + 1];
      params[entry.name] = entry.wildcard ? (value ? value.split('/') : []) : value;
    });
    return params;
  };
}

export async function loadPagesRoutes(functionsDir) {
  const routes = [];
  for (const file of await listFiles(functionsDir)) {
    const mod = await import(pathToFileURL(file).href);
    const routePath = routePathFor(file, functionsDir);
    for (const [exportName, method] of Object.entries(HANDLER_METHODS)) {
      if (typeof mod[exportName] !== 'function') continue;
      routes.push({
        routePath,
        method,
        module: `${relative(functionsDir, file).split(sep).join('/')}:${exportName}`,
        handler: mod[exportName],
        match: compilePattern(routePath),
      });
    }
  }
  return routes.sort(compareRoutes);
}

export function createDispatcher(routes) {
  return async function dispatch(request, env) {
    const { pathname } = new URL(request.url);
    for (const route of routes) {
      if (route.method && route.method !== request.method) continue;
      const params = route.match(pathname);
      if (!params) continue;
      const response = await route.handler({
        request,
        env,
        params,
        data: {},
        functionPath: pathname,
        waitUntil() {},
        passThroughOnException() {},
        next: async () => new Response('static asset fall-through', { status: 404 }),
      });
      return { response, module: route.module };
    }
    return { response: new Response('static asset fall-through', { status: 404 }), module: null };
  };
}
