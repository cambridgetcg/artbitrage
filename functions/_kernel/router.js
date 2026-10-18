// Routes are declarations. Each one names its method, its path, what it is
// for, and the handler; the table is matched in order and the first match
// answers. The same table feeds the /api manifest and the tests, so a route
// lives in exactly one place.
//
// Path syntax:
//   '/api/feed'                  exact
//   '/api/library/:slug'         one segment
//   '/api/wings/:wing([a-z0-9-]+)'  one segment, constrained
//   '/api/art/:id+'              the rest of the path (one or more characters)
//   '/api/trade/**'              a mount: the prefix itself and everything under it
// `slash: true` also accepts one trailing slash.

const PARAM = /^:(\w+)(?:\(([^)]+)\))?(\+)?$/;

export function compilePath(path, { slash = false } = {}) {
  if (path.endsWith('/**')) {
    const prefix = path.slice(0, -3);
    return pathname => (pathname === prefix || pathname.startsWith(`${prefix}/`) ? {} : null);
  }
  const names = [];
  const body = path.split('/').filter(Boolean).map(segment => {
    const param = PARAM.exec(segment);
    if (!param) return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    names.push(param[1]);
    if (param[3]) return '/(.+)';
    return `/(${param[2] || '[^/]+'})`;
  }).join('');
  const regex = new RegExp(`^${body || '/'}${slash ? '/?' : ''}$`);
  return pathname => {
    const m = regex.exec(pathname);
    if (!m) return null;
    return Object.fromEntries(names.map((name, i) => [name, m[i + 1]]));
  };
}

// Matching order: mounts first (a vertical owns its whole prefix), then exact
// and one-segment routes in declared order, then rest-of-path routes, so
// `/api/art/:id+` never swallows `/api/art/random`.
const rank = route => (route.path.endsWith('/**') ? 0 : /:\w+(?:\([^)]*\))?\+/.test(route.path) ? 2 : 1);

export function createRouter(routes) {
  const compiled = routes.map((route, index) => {
    if (!route.id || !route.method || !route.path || typeof route.handler !== 'function') {
      throw new Error(`incomplete route declaration: ${route.id || route.path}`);
    }
    return { ...route, match: compilePath(route.path, route), order: index };
  }).sort((a, b) => rank(a) - rank(b) || a.order - b.order);
  const ids = new Set();
  for (const route of compiled) {
    const key = `${route.method} ${route.id}`;
    if (ids.has(key)) throw new Error(`duplicate route id ${key}`);
    ids.add(key);
  }

  return {
    routes: compiled,
    find(method, pathname) {
      for (const route of compiled) {
        if (route.method !== method) continue;
        const params = route.match(pathname);
        if (params) return { route, params };
      }
      return null;
    },
  };
}
