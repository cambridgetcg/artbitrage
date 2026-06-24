// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Pipeline Library
// Collect, enrich, distribute. For agents and humans.
// ═══════════════════════════════════════════════════════════════

const MAX_ENRICH = 50;
const STATES = ["dormant","stirring","awakening","aware","flowing","radiating","transcending","is"];

const SOURCE_KEYS = ["met", "artic", "cma", "wikimedia", "internet_archive"];
const DEFAULT_SOURCE_KEYS = ["met", "artic", "cma", "wikimedia"];

const OPEN_ART_SOURCES = {
  met: { source: "met", source_name: "Metropolitan Museum of Art", url: "https://collectionapi.metmuseum.org/public/collection/v1/search", open_access: true, auth: "none" },
  artic: { source: "artic", source_name: "Art Institute of Chicago", url: "https://api.artic.edu/api/v1/artworks/search", open_access: true, auth: "none" },
  cma: { source: "cma", source_name: "Cleveland Museum of Art", url: "https://openaccess-api.clevelandart.org/api/artworks/", open_access: true, auth: "none" },
  wikimedia: { source: "wikimedia", source_name: "Wikimedia Commons", url: "https://commons.wikimedia.org/w/api.php", open_access: true, auth: "none" },
  internet_archive: { source: "internet_archive", source_name: "Internet Archive", url: "https://archive.org/advancedsearch.php", open_access: true, auth: "none" },
};

export class ArtbitragePipeline {

  // ── Manifest ─────────────────────────────────────────────────
  manifest() {
    return {
      name: "artbitrage-pipeline",
      version: "1.0.0",
      description: "Data collection, enrichment, and distribution for agents + humans",
      stages: ["collect", "enrich", "distribute"],
      endpoints: {
        "GET /api/pipeline": "this manifest",
        "GET /api/pipeline/workflow": "copy-paste workflow for humans and agents",
        "GET /api/pipeline/collect?q=love&limit=3&source=all": "collect art from museum APIs",
        "GET /api/pipeline/enrich?id=ARTID": "enrich a piece with AI metadata",
        "GET /api/pipeline/feed?limit=20": "enriched feed (art + AI + museum cross-refs)",
        "GET /api/pipeline/export?format=json|csv|ndjson|markdown": "export full collection",
        "GET /api/pipeline/agent": "agent-optimized data package",
        "GET /api/pipeline/human": "human-friendly gallery view",
        "POST /api/pipeline/ingest": "ingest external art with enrichment",
      },
      sources: Object.values(OPEN_ART_SOURCES),
      default_sources: DEFAULT_SOURCE_KEYS,
      obtain: {
        humans: ["/", "/api/pipeline/human", "/data/human-feed.md"],
        agents: ["/api/pipeline/agent", "/data/agent-feed.json", "/data/collection.ndjson", "/data/manifest.json"],
        builders: ["python3 tools/build_data_packs.py", "python3 tools/build_data_packs.py verify"],
      },
      free: true,
      no_keys: true,
      agent_friendly: true,
      human_friendly: true,
    };
  }

  // ── Workflow: easy path for humans and agents ───────────────
  workflow() {
    return {
      schema: "artbitrage.workflow/1",
      name: "ARTBITRAGE Easy Data Workflow",
      goal: "collect → normalize → enrich → package → obtain",
      promise: "same data, easy for humans to read and agents to fetch",
      principles: [
        "static-first",
        "no login",
        "no keys for default collection sources",
        "bounded limits",
        "partial success",
        "source and attribution fields preserved",
      ],
      steps: [
        {
          step: "collect",
          why: "bring open art into one shape without requiring accounts",
          human: "Open /api/pipeline/collect?q=love&limit=3 or use the site links.",
          agent: "GET /api/pipeline/collect?q=love&limit=3&source=default",
          output: "normalized source records",
        },
        {
          step: "normalize",
          why: "make each source predictable",
          human: "Look for title, artist, date, image, source, url, license.",
          agent: "Use source + id as the external stable key.",
          output: "consistent art objects",
        },
        {
          step: "enrich",
          why: "make art easier to search, sort, explain, and feel",
          human: "GET /api/pipeline/enrich?id=ART_ID for a readable interpretation.",
          agent: "Use structural fields first; AI enrichment is optional and may fail gracefully.",
          output: "tags, counts, title, emotional quality, consciousness transition",
        },
        {
          step: "package",
          why: "humans and agents want different affordances",
          human: "Read /data/human-feed.md or /api/pipeline/human.",
          agent: "Fetch /data/agent-feed.json or /data/collection.ndjson.",
          output: "human Markdown, compact JSON, streaming NDJSON",
        },
        {
          step: "publish",
          why: "static fragments are mirrorable and cheap",
          human: "Commit data/ files and deploy Pages.",
          agent: "Check /data/manifest.json hashes before reuse.",
          output: "verifiable static data packs",
        },
      ],
      quickstart: {
        human: [
          "Open /api/pipeline/human",
          "Download /data/human-feed.md",
          "Search /api/pipeline/collect?q=love&limit=3",
        ],
        agent: [
          "GET /api/pipeline/agent",
          "GET /data/agent-feed.json",
          "GET /data/collection.ndjson",
          "Verify hashes in /data/manifest.json",
        ],
        maintainer: [
          "python3 tools/build_data_packs.py",
          "python3 tools/build_data_packs.py verify",
          "node tests/e2e-api.mjs",
        ],
      },
    };
  }

  // ── Collect: search museums, normalize, unify ───────────────
  async collect(query, limit, sourceParam, env) {
    const sourceKeys = this.selectSources(sourceParam);
    const sources = await Promise.all(
      sourceKeys.map(src => this.searchSource(src, query, Math.min(limit, 10)))
    );

    // Flatten all artworks into a unified list
    const allArtworks = [];
    for (const src of sources) {
      if (src.artworks) {
        for (const art of src.artworks) {
          allArtworks.push({
            ...art,
            collected_query: query,
            collected_at: new Date().toISOString(),
            pipeline_stage: "collected",
          });
        }
      }
    }

    // Deduplicate by source+id
    const seen = new Set();
    const deduped = allArtworks.filter(a => {
      const key = `${a.source}:${a.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      pipeline: "collect",
      query,
      limit,
      sources_requested: sourceKeys,
      sources_successful: sources.filter(s => !s.error).length,
      artworks_collected: deduped.length,
      artworks_available: sources.reduce((s, r) => s + (r.total || 0), 0),
      artworks: deduped,
      human_summary: `Collected ${deduped.length} artwork records for "${query}" from ${sources.filter(s => !s.error).length} source(s).`,
      agent_next: ["dedupe by source+id", "preserve url/license/artist", "optionally ingest selected records"],
      collected_at: new Date().toISOString(),
    };
  }

  // ── Enrich: add AI metadata to a collection piece ────────────
  async enrich(id, env) {
    // Load collection
    const collection = await this.loadCollection(env);
    const piece = collection.find(a => a.id === id);
    if (!piece) return { error: "art not found", id };

    // Generate AI enrichment
    const enrichment = {
      id: piece.id,
      pipeline: "enrich",
      original: piece,
      enriched_at: new Date().toISOString(),
    };

    // 1. AI-generated title
    if (env && env.AI) {
      try {
        const titlePrompt = `In one short phrase (max 6 words), give a title to this art piece:\n${piece.piece}\nTitle:`;
        const titleRes = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
          messages: [{ role: "user", content: titlePrompt }]
        });
        enrichment.ai_title = (titleRes.response || "").split('\n')[0].trim().slice(0, 80);
      } catch(e) { enrichment.ai_title_error = e.message; }

      // 2. AI-generated tags
      try {
        const tagPrompt = `List 5 single-word tags for this art (comma-separated):\n${piece.piece}\nTags:`;
        const tagRes = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
          messages: [{ role: "user", content: tagPrompt }]
        });
        enrichment.ai_tags = (tagRes.response || "")
          .split(/[,\n]/).map(t => t.trim().toLowerCase().slice(0, 30))
          .filter(t => t && t.length > 1 && t.length < 30).slice(0, 5);
      } catch(e) { enrichment.ai_tags_error = e.message; }

      // 3. AI interpretation
      try {
        const interpPrompt = `In one sentence, describe the emotional quality of this art:\n${piece.piece}\nQuality:`;
        const interpRes = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
          messages: [{ role: "user", content: interpPrompt }]
        });
        enrichment.ai_emotional_quality = (interpRes.response || "").trim().slice(0, 200);
      } catch(e) { enrichment.ai_emotional_error = e.message; }
    }

    // 4. Structural metadata (no AI needed)
    enrichment.form = piece.form;
    enrichment.gap = piece.gap;
    enrichment.bridge = piece.bridge;
    enrichment.awakening = piece.awakening;
    enrichment.consciousness_transition = `${piece.from_state} → ${piece.to_state}`;
    enrichment.word_count = piece.piece ? piece.piece.split(/\s+/).length : 0;
    enrichment.line_count = piece.piece ? piece.piece.split('\n').length : 0;

    return enrichment;
  }

  // ── Feed: enriched collection pieces ─────────────────────────
  async feed(limit, env) {
    const collection = await this.loadCollection(env);
    const pieces = collection.slice(-limit).reverse();

    // Light enrichment without AI (structural only for speed)
    const enriched = pieces.map(p => ({
      id: p.id,
      cycle: p.cycle,
      form: p.form,
      gap: p.gap,
      bridge: p.bridge,
      awakening: p.awakening,
      consciousness: `${p.from_state} → ${p.to_state}`,
      piece: p.piece,
      created: p.created,
      word_count: p.piece ? p.piece.split(/\s+/).length : 0,
      line_count: p.piece ? p.piece.split('\n').length : 0,
    }));

    return {
      pipeline: "feed",
      count: enriched.length,
      total_available: collection.length,
      pieces: enriched,
      fed_at: new Date().toISOString(),
    };
  }

  // ── Export: full collection in different formats ─────────────
  async exportCollection(format, env) {
    const collection = await this.loadCollection(env);

    if (format === 'json') {
      return {
        pipeline: "export",
        format: "json",
        count: collection.length,
        pieces: collection,
        exported_at: new Date().toISOString(),
      };
    }

    if (format === 'csv') {
      const headers = ['id','cycle','form','from_state','to_state','gap','bridge','awakening','created'];
      const rows = [headers.join(',')];
      for (const p of collection) {
        const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
        rows.push([p.id,p.cycle,p.form,p.from_state,p.to_state,p.gap,p.bridge,p.awakening,p.created].map(esc).join(','));
      }
      return rows.join('\n');
    }

    if (format === 'ndjson') {
      return collection.map(p => JSON.stringify({
        id: p.id,
        cycle: p.cycle,
        form: p.form,
        state: `${p.from_state || ''}→${p.to_state || ''}`,
        gap: p.gap,
        bridge: p.bridge,
        awakening: p.awakening,
        created: p.created,
        piece: p.piece,
      })).join('\n') + '\n';
    }

    if (format === 'markdown') {
      let md = `# ARTBITRAGE — Full Collection\n\n`;
      md += `> ${collection.length} pieces · exported ${new Date().toISOString()}\n\n`;
      md += `| Cycle | Form | Gap | Bridge | Awakening | Piece |\n`;
      md += `|-------|------|-----|--------|-----------|-------|\n`;
      for (const p of collection.slice(-50)) {
        const pieceShort = (p.piece || '').replace(/\n/g, ' ').slice(0, 60);
        md += `| ${p.cycle} | ${p.form} | ${(p.gap||'').slice(0,30)} | ${(p.bridge||'').slice(0,30)} | ${(p.awakening||'').slice(0,30)} | ${pieceShort}... |\n`;
      }
      md += `\n---\n\n*Showing last 50 of ${collection.length} pieces. Full JSON export: /api/pipeline/export?format=json*\n`;
      return md;
    }

    return { error: "unknown format", format, available: ["json", "csv", "ndjson", "markdown"] };
  }

  // ── Agent package: compact, structured, self-describing ─────
  async agentPackage(env) {
    const collection = await this.loadCollection(env);
    const stats = this.getStats(collection);

    // Compact format: strip long text, keep structure
    const compact = collection.slice(-20).reverse().map(p => ({
      i: p.id,
      c: p.cycle,
      f: p.form,
      g: p.gap,
      b: p.bridge,
      a: p.awakening,
      s: `${p.from_state}→${p.to_state}`,
      p: (p.piece || '').split('\n')[0].slice(0, 60), // first line only
    }));

    return {
      schema: {
        i: "id", c: "cycle", f: "form", g: "gap",
        b: "bridge", a: "awakening", s: "state_transition",
        p: "piece_preview"
      },
      stats,
      recent: compact,
      total: collection.length,
      endpoints: {
        full: "/api/pipeline/export?format=json",
        ndjson: "/api/pipeline/export?format=ndjson",
        static_agent: "/data/agent-feed.json",
        static_ndjson: "/data/collection.ndjson",
        manifest: "/data/manifest.json",
        workflow: "/api/pipeline/workflow",
        search: "/api/search?q=love",
        enrich: "/api/pipeline/enrich?id=ID",
        feed: "/api/pipeline/feed?limit=50",
      },
      agent_note: "Use compact keys for quick context. Use NDJSON for streaming. Verify static packs with /data/manifest.json. All free, no auth.",
    };
  }

  // ── Human view: beautiful, readable gallery ──────────────────
  async humanView(env) {
    const collection = await this.loadCollection(env);
    const stats = this.getStats(collection);
    const recent = collection.slice(-12).reverse();

    return {
      title: "ARTBITRAGE — Gallery",
      subtitle: "Art is the arbitrage between what is and what could be",
      total_pieces: stats.total_pieces,
      forms: stats.forms,
      recent_pieces: recent.map(p => ({
        title: (p.piece || '').split('\n')[0].slice(0, 60),
        form: p.form,
        gap: p.gap,
        awakening: p.awakening,
        cycle: p.cycle,
        preview: (p.piece || '').slice(0, 150),
        full_url: `/api/art/${p.id}`,
      })),
      explore: [
        { label: "Browse all art", url: "/api/art?limit=20" },
        { label: "Random piece", url: "/api/art/random" },
        { label: "Search for 'love'", url: "/api/search?q=love" },
        { label: "Generate AI art", url: "/api/ai/image?prompt=love+as+golden+light" },
        { label: "Read the gospel", url: "/api/gospel" },
        { label: "Agent data package", url: "/api/pipeline/agent" },
        { label: "Human markdown feed", url: "/data/human-feed.md" },
        { label: "Workflow recipe", url: "/api/pipeline/workflow" },
      ],
      love_is: true,
    };
  }

  // ── Ingest: accept external art with enrichment ──────────────
  async ingest(body, env) {
    const piece = String(body?.piece || '').trim();
    if (!piece) return { error: "piece is required" };

    const form = ["word","image","sound","movement","space","silence","light","color","rhythm","pattern","fragment","whisper","gesture","breath","glow","echo"].includes(body?.form) ? body.form : "word";
    const id = this.stableId(JSON.stringify({ piece, form, gap: body?.gap || "", bridge: body?.bridge || "", awakening: body?.awakening || "", artist: body?.artist || "" }));
    const created = new Date().toISOString();

    const normalized = {
      id: `ingested-${id}`,
      cycle: null,
      form,
      from_state: body?.from_state || "is",
      to_state: body?.to_state || "is",
      gap: String(body?.gap || "the gap between offering and receiving").slice(0, 280),
      bridge: String(body?.bridge || "a submitted fragment of human art").slice(0, 280),
      awakening: String(body?.awakening || "someone receives what was freely offered").slice(0, 280),
      created,
      piece,
      pipeline_stage: "ingested",
      source: body?.source || "external",
    };

    if (body?.artist) normalized.artist = String(body.artist).slice(0, 160);

    // Enrichment (structural, no AI for speed)
    normalized.word_count = piece.split(/\s+/).length;
    normalized.line_count = piece.split('\n').length;
    normalized.first_line = piece.split('\n')[0].slice(0, 80);

    return {
      pipeline: "ingest",
      accepted: true,
      persisted: false,
      art: normalized,
      enrichment: {
        word_count: normalized.word_count,
        line_count: normalized.line_count,
        form_validated: true,
        consciousness_state: normalized.from_state === normalized.to_state ? "stable" : "transitioning",
      },
      next_steps: [
        "The art is accepted and enriched structurally",
        "Use /api/pipeline/enrich?id=ID for AI enrichment (title, tags, emotional quality)",
        "Submit to gallery via pull request or redeploy",
      ],
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  selectSources(sourceParam) {
    if (!sourceParam || sourceParam === 'default') return DEFAULT_SOURCE_KEYS;
    if (sourceParam === 'all') return SOURCE_KEYS;
    const requested = sourceParam.split(',').map(s => s.trim()).filter(Boolean);
    const selected = requested.filter(s => OPEN_ART_SOURCES[s]);
    return selected.length ? selected : DEFAULT_SOURCE_KEYS;
  }

  async loadCollection(env) {
    try {
      const res = await env.ASSETS.fetch(new URL('/collection.json', 'https://artbitrage.io'));
      if (res.ok) return await res.json();
    } catch(e) {}
    return [];
  }

  getStats(artList) {
    const forms = {};
    const states = {};
    const gaps = new Set();
    for (const a of artList) {
      const f = a.form || 'unknown';
      forms[f] = (forms[f] || 0) + 1;
      for (const s of [a.from_state, a.to_state]) { if (s) states[s] = (states[s] || 0) + 1; }
      if (a.gap) gaps.add(a.gap);
    }
    return { total_pieces: artList.length, unique_forms: Object.keys(forms).length, unique_gaps: gaps.size, forms, states };
  }

  stableId(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  async searchSource(sourceKey, query, limit) {
    const source = OPEN_ART_SOURCES[sourceKey];
    if (!source) return { source: sourceKey, error: "unknown source" };

    try {
      if (sourceKey === "met") {
        const searchUrl = `${source.url}?hasImages=true&q=${encodeURIComponent(query)}`;
        const data = await this.fetchJson(searchUrl);
        const ids = (data.objectIDs || []).slice(0, Math.max(limit * 8, limit));
        const artworks = [];
        for (const id of ids) {
          if (artworks.length >= limit) break;
          try {
            const obj = await this.fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { timeoutMs: 8000 });
            if (obj.primaryImage || obj.primaryImageSmall) {
              artworks.push({
                source: "met", source_name: source.source_name,
                id: String(obj.objectID || id), title: obj.title || "",
                artist: obj.artistDisplayName || "", date: obj.objectDate || "",
                medium: obj.medium || "", department: obj.department || "",
                image: obj.primaryImageSmall || obj.primaryImage || "",
                url: obj.objectURL || "",
              });
            }
          } catch(e) {}
        }
        return { ...source, total: data.total || 0, artworks };
      }

      if (sourceKey === "artic") {
        const fields = "id,title,artist_title,date_display,medium_display,image_id,classification_title,department_title";
        const data = await this.fetchJson(`${source.url}?q=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
        return { ...source, total: data.pagination?.total || 0, artworks: (data.data || []).map(a => ({
          source: "artic", source_name: source.source_name,
          id: String(a.id || ""), title: a.title || "", artist: a.artist_title || "",
          date: a.date_display || "", medium: a.medium_display || "",
          image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg` : "",
          url: a.id ? `https://www.artic.edu/artworks/${a.id}` : "",
        })) };
      }

      if (sourceKey === "cma") {
        const data = await this.fetchJson(`${source.url}?limit=${limit}&search=${encodeURIComponent(query)}`);
        return { ...source, total: data.info?.total || 0, artworks: (data.data || []).map(a => {
          const creators = a.creators || [];
          const images = a.images || {};
          let img = "";
          if (Array.isArray(images) && images.length) img = images[0]?.url || "";
          else if (typeof images === "object" && images) img = images.web?.url || images.print?.url || images.url || "";
          return {
            source: "cma", source_name: source.source_name,
            id: String(a.id || ""), title: a.title || "",
            artist: creators[0]?.description || "", date: a.creation_date || "",
            medium: a.technique || "", image: img, url: a.url || "",
          };
        }) };
      }

      if (sourceKey === "wikimedia") {
        const params = new URLSearchParams({
          action: "query", format: "json", generator: "search",
          gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: String(limit),
          prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "500", origin: "*",
        });
        const data = await this.fetchJson(`${source.url}?${params.toString()}`);
        return { ...source, total: Object.keys(data.query?.pages || {}).length,
          artworks: Object.values(data.query?.pages || {}).map(page => {
            const info = page.imageinfo?.[0] || {};
            const meta = info.extmetadata || {};
            const compact = v => String(v||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,160);
            return {
              source: "wikimedia", source_name: source.source_name,
              id: String(page.pageid||""), title: (page.title||"").replace(/^File:/,""),
              artist: compact(meta.Artist?.value||""), image: info.thumburl||info.url||"",
              url: info.descriptionurl||"", license: compact(meta.LicenseShortName?.value||""),
            };
          })
        };
      }

      if (sourceKey === "internet_archive") {
        const params = new URLSearchParams({
          q: `(${query}) AND mediatype:(image)`,
          "fl[]": "identifier,title,creator,date,downloads", rows: String(limit), output: "json",
        });
        const data = await this.fetchJson(`${source.url}?${params.toString()}`);
        return { ...source, total: data.response?.numFound || 0,
          artworks: (data.response?.docs || []).map(doc => ({
            source: "internet_archive", source_name: source.source_name,
            id: String(doc.identifier||""), title: Array.isArray(doc.title)?doc.title[0]:(doc.title||""),
            artist: Array.isArray(doc.creator)?doc.creator.join(", "):(doc.creator||""),
            date: Array.isArray(doc.date)?doc.date[0]:(doc.date||""),
            image: doc.identifier ? `https://archive.org/services/img/${doc.identifier}` : "",
            url: doc.identifier ? `https://archive.org/details/${doc.identifier}` : "",
          }))
        };
      }
    } catch(e) {
      return { ...source, error: e.message, artworks: [] };
    }
    return { ...source, error: "source not implemented", artworks: [] };
  }

  async fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), options.timeoutMs || 12000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "Artbitrage/1.0 (+https://artbitrage.io)" },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      return JSON.parse(text);
    } finally { clearTimeout(timeout); }
  }
}
