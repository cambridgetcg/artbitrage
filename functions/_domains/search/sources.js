// The open-search bridge: five keyless museum and archive sources, each
// normalised into one record shape with rights carried on every item.
import { buildRights } from '../../_kernel/rights.js';
import { compactText } from '../../_kernel/params.js';
import { fetchJson } from '../../_kernel/upstream.js';

export const MAX_SEARCH_LIMIT = 10;
export const SOURCE_KEYS = ["met", "artic", "cma", "wikimedia", "internet_archive"];
export const DEFAULT_SOURCE_KEYS = ["met", "artic", "cma", "wikimedia"];

// The Met retired /v1/search on 2026-10-01; /v1.1/search pages by offset+limit (default 100, max 500).
const MET_SEARCH_PAGE_MAX = 500;
export const OPEN_ART_SOURCES = {
  met: {
    source: "met",
    source_name: "Metropolitan Museum of Art",
    url: "https://collectionapi.metmuseum.org/public/collection/v1.1/search",
    open_access: true,
    auth: "none",
  },
  artic: {
    source: "artic",
    source_name: "Art Institute of Chicago",
    url: "https://api.artic.edu/api/v1/artworks/search",
    open_access: true,
    auth: "none",
  },
  cma: {
    source: "cma",
    source_name: "Cleveland Museum of Art",
    url: "https://openaccess-api.clevelandart.org/api/artworks/",
    open_access: true,
    auth: "none",
  },
  wikimedia: {
    source: "wikimedia",
    source_name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/api.php",
    open_access: true,
    auth: "none",
  },
  internet_archive: {
    source: "internet_archive",
    source_name: "Internet Archive",
    url: "https://archive.org/advancedsearch.php",
    open_access: true,
    auth: "none",
  },
};

function normalizeArtic(data) {
  return (data.data || []).map(a => ({
    source: "artic",
    source_name: "Art Institute of Chicago",
    id: String(a.id || ""),
    title: a.title || "",
    artist: a.artist_title || "",
    date: a.date_display || "",
    medium: a.medium_display || "",
    department: a.department_title || "",
    image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg` : "",
    url: a.id ? `https://www.artic.edu/artworks/${a.id}` : "",
    rights: buildRights({
      publicDomain: typeof a.is_public_domain === "boolean" ? a.is_public_domain : null,
      credit: a.credit_line || "",
    }),
  }));
}

function normalizeCma(data) {
  return (data.data || []).map(a => {
    const creators = a.creators || [];
    const images = a.images || {};
    let img = "";
    if (Array.isArray(images) && images.length) img = images[0]?.url || "";
    else if (typeof images === "object" && images) img = images.web?.url || images.print?.url || images.url || "";
    return {
      source: "cma",
      source_name: "Cleveland Museum of Art",
      id: String(a.id || ""),
      title: a.title || "",
      artist: creators[0]?.description || "",
      date: a.creation_date || "",
      medium: a.technique || "",
      department: a.department || "",
      image: img,
      url: a.url || "",
      rights: buildRights({
        publicDomain: /^cc0/i.test(a.share_license_status || "") ? true : null,
        license: a.share_license_status || "",
        credit: a.creditline || "",
      }),
    };
  });
}

function normalizeWikimedia(data) {
  return Object.values(data.query?.pages || {}).map(page => {
    const info = page.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    return {
      source: "wikimedia",
      source_name: "Wikimedia Commons",
      id: String(page.pageid || ""),
      title: (page.title || "").replace(/^File:/, ""),
      artist: compactText(meta.Artist?.value || ""),
      date: compactText(meta.DateTimeOriginal?.value || meta.DateTime?.value || ""),
      medium: compactText(meta.MimeType?.value || ""),
      department: "",
      image: info.thumburl || info.url || "",
      url: info.descriptionurl || "",
      license: compactText(meta.LicenseShortName?.value || ""),
      rights: buildRights({
        license: meta.LicenseShortName?.value || "",
        credit: meta.Credit?.value || "",
        statement: meta.UsageTerms?.value || "",
      }),
    };
  });
}

function normalizeInternetArchive(data) {
  return (data.response?.docs || []).map(doc => ({
    source: "internet_archive",
    source_name: "Internet Archive",
    id: String(doc.identifier || ""),
    title: Array.isArray(doc.title) ? doc.title[0] : (doc.title || ""),
    artist: Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator || ""),
    date: Array.isArray(doc.date) ? doc.date[0] : (doc.date || ""),
    medium: "image",
    department: "",
    image: doc.identifier ? `https://archive.org/services/img/${doc.identifier}` : "",
    url: doc.identifier ? `https://archive.org/details/${doc.identifier}` : "",
    rights: buildRights({
      credit: Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator || ""),
    }),
  }));
}

export async function searchSource(sourceKey, query, limit) {
  const source = OPEN_ART_SOURCES[sourceKey];
  if (!source) return { source: sourceKey, error: "unknown source" };

  try {
    if (sourceKey === "met") {
      const pageSize = Math.min(MET_SEARCH_PAGE_MAX, Math.max(limit * 8, limit));
      const searchUrl = `${source.url}?hasImages=true&q=${encodeURIComponent(query)}&offset=0&limit=${pageSize}`;
      const data = await fetchJson(searchUrl);
      const ids = (data.objectIDs || []).slice(0, pageSize);
      const artworks = [];
      for (const id of ids) {
        if (artworks.length >= limit) break;
        try {
          const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { timeoutMs: 8000 });
          if (obj.primaryImage || obj.primaryImageSmall) {
            artworks.push({
              source: "met",
              source_name: source.source_name,
              id: String(obj.objectID || id),
            title: obj.title || "",
              artist: obj.artistDisplayName || "",
              date: obj.objectDate || "",
              medium: obj.medium || "",
              department: obj.department || "",
              image: obj.primaryImageSmall || obj.primaryImage || "",
              url: obj.objectURL || "",
              rights: buildRights({
                publicDomain: typeof obj.isPublicDomain === "boolean" ? obj.isPublicDomain : null,
                credit: obj.creditLine || "",
                statement: obj.rightsAndReproduction || "",
              }),
            });
          }
        } catch(e) {
          // One museum object should not poison the whole source.
        }
      }
      return { ...source, total: data.total || 0, artworks };
    }

    if (sourceKey === "artic") {
      const fields = "id,title,artist_title,date_display,medium_display,image_id,classification_title,department_title,is_public_domain,credit_line";
      const data = await fetchJson(`${source.url}?q=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
      return { ...source, total: data.pagination?.total || 0, artworks: normalizeArtic(data) };
    }

    if (sourceKey === "cma") {
      const data = await fetchJson(`${source.url}?limit=${limit}&search=${encodeURIComponent(query)}`);
      return { ...source, total: data.info?.total || 0, artworks: normalizeCma(data) };
    }

    if (sourceKey === "wikimedia") {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: String(limit),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: "500",
        origin: "*",
      });
      const data = await fetchJson(`${source.url}?${params.toString()}`);
      return { ...source, total: Object.keys(data.query?.pages || {}).length, artworks: normalizeWikimedia(data) };
    }

    if (sourceKey === "internet_archive") {
      const params = new URLSearchParams({
        q: `(${query}) AND mediatype:(image)`,
        "fl[]": "identifier,title,creator,date,downloads",
        rows: String(limit),
        output: "json",
      });
      const data = await fetchJson(`${source.url}?${params.toString()}`);
      return { ...source, total: data.response?.numFound || 0, artworks: normalizeInternetArchive(data) };
    }
  } catch(e) {
    return { ...source, error: e.message, artworks: [] };
  }

  return { ...source, error: "source not implemented", artworks: [] };
}

export function selectSources(sourceParam) {
  if (!sourceParam) return DEFAULT_SOURCE_KEYS;
  if (sourceParam === "all") return SOURCE_KEYS;
  const requested = sourceParam.split(",").map(s => s.trim()).filter(Boolean);
  const selected = requested.filter(s => OPEN_ART_SOURCES[s]);
  return selected.length ? selected : DEFAULT_SOURCE_KEYS;
}
