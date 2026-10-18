// The open-search bridge: live museum search with rights kept on every record.
import { json } from '../../_kernel/http.js';
import { boundedInt, safeString } from '../../_kernel/params.js';
import { DEFAULT_SOURCE_KEYS, MAX_SEARCH_LIMIT, OPEN_ART_SOURCES, searchSource, selectSources } from './sources.js';

const UPSTREAM_HOSTS = Object.values(OPEN_ART_SOURCES).map(source => new URL(source.url).hostname);

export default [
  {
    id: 'search.sources', category: 'search', method: 'GET', path: '/api/sources',
    summary: 'Five public museum/archive sources; rights vary by record and source',
    handler: () => json({
      sources: Object.values(OPEN_ART_SOURCES),
      count: Object.keys(OPEN_ART_SOURCES).length,
      default_sources: DEFAULT_SOURCE_KEYS,
      search: 'GET /api/search?q=love&source=met,artic,cma,wikimedia,internet_archive',
      no_keys: true,
      mirror_friendly: true,
    }),
  },
  {
    id: 'search.search', category: 'search', method: 'GET', path: '/api/search',
    summary: "Search the world's art museums", params: 'q, limit, source',
    upstream: UPSTREAM_HOSTS,
    handler: async ({ query }) => {
      const q = safeString(query.q || 'love', 160) || 'love';
      const limit = boundedInt(query.limit, 3, 1, MAX_SEARCH_LIMIT);
      const sourceKeys = selectSources(query.source || query.sources);
      const sources = await Promise.all(sourceKeys.map(source => searchSource(source, q, limit)));
      const totalArt = sources.reduce((s, r) => s + (r.artworks?.length || 0), 0);
      const totalAvail = sources.reduce((s, r) => s + (r.total || 0), 0);
      return json({
        query: q, limit, sources_requested: sourceKeys,
        sources_searched: sources.length,
        sources_successful: sources.filter(s => !s.error).length,
        total_artworks_returned: totalArt, total_artworks_available: totalAvail,
        sources, searched_at: new Date().toISOString(),
      });
    },
  },
];
