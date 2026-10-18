// The open-search bridge: five keyless museum and archive sources, each
// normalised into one record shape with rights carried on every item.
import { buildRights } from '../../_kernel/rights.js';
import { compactText } from '../../_kernel/params.js';
import { guestJson } from '../../_kernel/upstream.js';

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

// How each source's search is kept: a query is reused for ten minutes, and
// the last good answer stands in for a day if the source fails. Met objects
// change rarely, so one is reused for a week.
const MINUTE = 60 * 1000;
const SEARCH_POLICY = { timeoutMs: 8000, freshMs: 10 * MINUTE, keepMs: 24 * 60 * MINUTE };
const MET_OBJECT_POLICY = { timeoutMs: 6000, freshMs: 7 * 24 * 60 * MINUTE, keepMs: 30 * 24 * 60 * MINUTE };
const MET_OBJECT_URL = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';
// The Met's search returns ids; many have no public image. Candidates are
// read four at a time, and no new batch starts after this many milliseconds.
const MET_OBJECT_CONCURRENCY = 4;
const MET_CANDIDATE_BUDGET_MS = 6000;

function normalizeMetObject(obj, id) {
  return {
    source: "met",
    source_name: OPEN_ART_SOURCES.met.source_name,
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
  };
}

async function searchMet(source, query, limit) {
  const pageSize = Math.min(MET_SEARCH_PAGE_MAX, Math.max(limit * 8, limit));
  const searchUrl = `${source.url}?hasImages=true&q=${encodeURIComponent(query)}&offset=0&limit=${pageSize}`;
  const found = await guestJson('met.search', searchUrl, SEARCH_POLICY);
  const ids = (found.data.objectIDs || []).slice(0, pageSize);
  const artworks = [];
  const started = Date.now();
  let checked = 0;
  for (let i = 0; i < ids.length && artworks.length < limit; i += MET_OBJECT_CONCURRENCY) {
    if (i > 0 && Date.now() - started > MET_CANDIDATE_BUDGET_MS) break;
    const batch = ids.slice(i, i + MET_OBJECT_CONCURRENCY);
    // One museum object should not poison the whole source.
    const objects = await Promise.all(batch.map(id =>
      guestJson('met.object', `${MET_OBJECT_URL}${id}`, MET_OBJECT_POLICY).then(got => got.data, () => null)));
    checked += batch.length;
    objects.forEach((obj, j) => {
      if (obj && artworks.length < limit && (obj.primaryImage || obj.primaryImageSmall)) artworks.push(normalizeMetObject(obj, batch[j]));
    });
  }
  return {
    ...source,
    ...freshness(found),
    total: found.data.total || 0,
    total_is_exact: true,
    candidates_checked: checked,
    candidates_found: ids.length,
    artworks,
  };
}

// A cached or stale answer says so; a live one adds nothing.
function freshness(got) {
  if (got.stale) return { stale: true, fetched_at: got.fetched_at, upstream_error: got.error };
  if (got.cached) return { cached: true, fetched_at: got.fetched_at };
  return {};
}

const AIC_TOTAL_NOTE = "The Art Institute ranks every work for any query, so the total it reports is its whole collection, not the matches; that number is kept as total_reported. Works it scores 0 (no match at all) are left out.";
const WIKIMEDIA_TOTAL_NOTE = "Commons does not report a total for this search; this is the number of files on the page returned.";

export async function searchSource(sourceKey, query, limit) {
  const source = OPEN_ART_SOURCES[sourceKey];
  if (!source) return { source: sourceKey, error: "unknown source" };

  try {
    if (sourceKey === "met") return await searchMet(source, query, limit);

    if (sourceKey === "artic") {
      const fields = "id,title,artist_title,date_display,medium_display,image_id,classification_title,department_title,is_public_domain,credit_line,_score";
      const got = await guestJson('artic.search', `${source.url}?q=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`, SEARCH_POLICY);
      const matched = { ...got.data, data: (got.data.data || []).filter(a => !(typeof a._score === "number" && a._score <= 0)) };
      return {
        ...source,
        ...freshness(got),
        total: null,
        total_is_exact: false,
        total_reported: got.data.pagination?.total ?? null,
        total_note: AIC_TOTAL_NOTE,
        artworks: normalizeArtic(matched),
      };
    }

    if (sourceKey === "cma") {
      const got = await guestJson('cma.search', `${source.url}?limit=${limit}&search=${encodeURIComponent(query)}`, SEARCH_POLICY);
      return { ...source, ...freshness(got), total: got.data.info?.total || 0, total_is_exact: true, artworks: normalizeCma(got.data) };
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
      const got = await guestJson('wikimedia.search', `${source.url}?${params.toString()}`, SEARCH_POLICY);
      return {
        ...source,
        ...freshness(got),
        total: Object.keys(got.data.query?.pages || {}).length,
        total_is_exact: false,
        total_note: WIKIMEDIA_TOTAL_NOTE,
        artworks: normalizeWikimedia(got.data),
      };
    }

    if (sourceKey === "internet_archive") {
      const params = new URLSearchParams({
        q: `(${query}) AND mediatype:(image)`,
        "fl[]": "identifier,title,creator,date,downloads",
        rows: String(limit),
        output: "json",
      });
      const got = await guestJson('internet_archive.search', `${source.url}?${params.toString()}`, SEARCH_POLICY);
      return { ...source, ...freshness(got), total: got.data.response?.numFound || 0, total_is_exact: true, artworks: normalizeInternetArchive(got.data) };
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
