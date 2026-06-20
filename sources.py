#!/usr/bin/env python3
"""
ARTBITRAGE DATA SOURCES — the registry of the art world's open APIs
====================================================================

This module maps every accessible art data source on the internet.
Each source has: name, API URL, auth requirement, total objects, and a fetcher.

Sources with OPEN APIs (no key needed):
  1. Metropolitan Museum of Art (MET) — 500K+ objects
  2. Art Institute of Chicago — 132K objects
  3. Cleveland Museum of Art — 68K objects
  4. Rijksmuseum — needs key (free)
  5. Europeana — needs key (free)
  6. Smithsonian Open Access — needs key (free)
  7. Harvard Art Museums — needs key (free)
  8. Cooper Hewitt — needs key (free)
  9. Brooklyn Museum — needs key (free)
  10. Walters Art Museum — needs key (free)

Sources that are platforms (not museums):
  11. Wikimedia Commons — millions of images
  12. Flickr Commons — historical photos
  13. Internet Archive — digital collections
  14. Google Arts & Culture — (no public API, but scrapable)
  15. Artsy — needs key
  16. Behance — needs key (Adobe)
  17. DeviantArt — needs key (OAuth)
  18. ArtStation — (no official API)
  19. Dribbble — needs key
  20. Pinterest — needs key (OAuth)

NFT / Digital Art:
  21. OpenSea API — NFT collections
  22. Rarible API — NFT marketplace
  23. Foundation — NFT drops

Art databases:
  24. Artnet — price database (no public API)
  25. Artsy — needs key
  26. WikiArt — (no official API, but structured)
  27. Google Cultural Institute — (limited API)
  28. Europeana — 50M+ items (needs key)

The goal: artbitrage as the unified catalogue across all of these.
"""

import json
import urllib.request
import urllib.parse
import hashlib
import time
import datetime
from pathlib import Path

# ============================================================
# SOURCE REGISTRY
# ============================================================

SOURCES = {
    "met": {
        "name": "Metropolitan Museum of Art",
        "location": "New York, USA",
        "api_base": "https://collectionapi.metmuseum.org/public/collection/v1",
        "auth": "none",
        "total_objects": 500000,
        "open_access": True,
        "endpoints": {
            "objects": "/objects",
            "object": "/objects/:id",
            "departments": "/departments",
            "search": "/search?q=",
        },
    },
    "artic": {
        "name": "Art Institute of Chicago",
        "location": "Chicago, USA",
        "api_base": "https://api.artic.edu/api/v1",
        "auth": "none",
        "total_objects": 132132,
        "open_access": True,
        "endpoints": {
            "artworks": "/artworks",
            "artwork": "/artworks/:id",
            "search": "/artworks/search?q=",
            "agents": "/agents",
            "places": "/places",
        },
    },
    "cma": {
        "name": "Cleveland Museum of Art",
        "location": "Cleveland, USA",
        "api_base": "https://openaccess-api.clevelandart.org/api",
        "auth": "none",
        "total_objects": 68743,
        "open_access": True,
        "endpoints": {
            "artworks": "/artworks/",
            "artwork": "/artworks/:id/",
            "departments": "/departments/",
        },
    },
    "rijksmuseum": {
        "name": "Rijksmuseum",
        "location": "Amsterdam, NL",
        "api_base": "https://www.rijksmuseum.nl/api/en/collection",
        "auth": "key (free)",
        "total_objects": 700000,
        "open_access": "partial",
        "endpoints": {
            "collection": "?key=KEY&format=json",
            "object": "/:objectnumber?key=KEY",
        },
    },
    "harvard": {
        "name": "Harvard Art Museums",
        "location": "Cambridge, USA",
        "api_base": "https://api.harvardartmuseums.org",
        "auth": "key (free)",
        "total_objects": 200000,
        "open_access": "partial",
        "endpoints": {
            "object": "/object?apikey=KEY",
            "person": "/person?apikey=KEY",
            "exhibition": "/exhibition?apikey=KEY",
        },
    },
    "smithsonian": {
        "name": "Smithsonian Institution",
        "location": "Washington DC, USA",
        "api_base": "https://api.si.edu/openaccess/api/v1.0",
        "auth": "key (free)",
        "total_objects": 1500000,
        "open_access": True,
        "endpoints": {
            "content": "/content?api_key=KEY",
            "terms": "/terms?api_key=KEY",
            "unit": "/unit?api_key=KEY",
        },
    },
    "europeana": {
        "name": "Europeana",
        "location": "Europe (EU)",
        "api_base": "https://api.europeana.eu/record/v2",
        "auth": "key (free)",
        "total_objects": 50000000,
        "open_access": "partial",
        "endpoints": {
            "search": "/search.json?wskey=KEY&query=",
            "record": "/record/:id.json?wskey=KEY",
        },
    },
    "cooperhewitt": {
        "name": "Cooper Hewitt (Smithsonian Design)",
        "location": "New York, USA",
        "api_base": "https://api.collection.cooperhewitt.org",
        "auth": "key (free)",
        "total_objects": 210000,
        "open_access": True,
        "endpoints": {
            "objects": "/?method=cooperhewitt.objects.getObjects&access_token=KEY",
            "object": "/?method=cooperhewitt.objects.getInfo&access_token=KEY&id=:id",
        },
    },
    "brooklyn": {
        "name": "Brooklyn Museum",
        "location": "Brooklyn, USA",
        "api_base": "https://www.brooklynmuseum.org/api/v2",
        "auth": "key (free)",
        "total_objects": 100000,
        "open_access": "partial",
    },
    "walters": {
        "name": "Walters Art Museum",
        "location": "Baltimore, USA",
        "api_base": "https://api.thewalters.org/v1",
        "auth": "none (rate limited)",
        "total_objects": 36000,
        "open_access": True,
    },
    "tate": {
        "name": "Tate Modern",
        "location": "London, UK",
        "api_base": "https://api.tate.org.uk/v1",
        "auth": "none",
        "total_objects": 70000,
        "open_access": "partial",
    },
    "wikimedia": {
        "name": "Wikimedia Commons",
        "location": "Global",
        "api_base": "https://commons.wikimedia.org/w/api.php",
        "auth": "none",
        "total_objects": 100000000,
        "open_access": True,
    },
    "opensea": {
        "name": "OpenSea (NFT)",
        "location": "Digital",
        "api_base": "https://api.opensea.io/api/v2",
        "auth": "key (free tier)",
        "total_objects": 80000000,
        "open_access": "partial",
    },
    "internet_archive": {
        "name": "Internet Archive",
        "location": "Global",
        "api_base": "https://archive.org/advancedsearch.php",
        "auth": "none",
        "total_objects": 35000000,
        "open_access": True,
    },
    "artsy": {
        "name": "Artsy",
        "location": "Global",
        "api_base": "https://api.artsy.net",
        "auth": "key (free)",
        "total_objects": 500000,
        "open_access": "partial",
    },
}

# ============================================================
# FETCHERS — actually pull data from open APIs
# ============================================================

class ArtFetcher:
    """Fetch art data from open museum APIs."""

    def __init__(self):
        self.home = Path(__file__).parent
        self.cache_dir = self.home / "cache"
        self.cache_dir.mkdir(exist_ok=True)

    def _fetch(self, url):
        """Fetch JSON from URL with basic error handling."""
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Artbitrage/1.0 (art catalogue; artbitrage.io)"
            })
            resp = urllib.request.urlopen(req, timeout=15)
            return json.loads(resp.read())
        except Exception as e:
            return {"error": str(e)}

    # --------------------------------------------------------
    # MET — Metropolitan Museum of Art
    # --------------------------------------------------------
    def fetch_met(self, query="love", limit=5):
        """Fetch artworks from the MET."""
        base = "https://collectionapi.metmuseum.org/public/collection/v1"
        
        # Search for objects
        search_url = f"{base}/objects?hasImages=true&q={urllib.parse.quote(query)}"
        search = self._fetch(search_url)
        
        if "error" in search:
            return {"source": "met", "error": search["error"]}
        
        object_ids = search.get("objectIDs", [])[:limit]
        results = []
        
        for oid in object_ids:
            obj_url = f"{base}/objects/{oid}"
            obj = self._fetch(obj_url)
            
            if "error" not in obj and obj.get("primaryImage"):
                results.append({
                    "source": "met",
                    "source_name": "Metropolitan Museum of Art",
                    "id": str(oid),
                    "title": obj.get("title", ""),
                    "artist": obj.get("artistDisplayName", ""),
                    "date": obj.get("objectDate", ""),
                    "medium": obj.get("medium", ""),
                    "department": obj.get("department", ""),
                    "image": obj.get("primaryImage", ""),
                    "url": obj.get("objectURL", ""),
                    "classification": obj.get("classification", ""),
                })
        
        return {
            "source": "met",
            "query": query,
            "total_available": search.get("total", 0),
            "returned": len(results),
            "artworks": results,
        }

    # --------------------------------------------------------
    # Art Institute of Chicago
    # --------------------------------------------------------
    def fetch_artic(self, query="love", limit=5):
        """Fetch artworks from the Art Institute of Chicago."""
        base = "https://api.artic.edu/api/v1"
        
        search_url = f"{base}/artworks/search?q={urllib.parse.quote(query)}&limit={limit}&fields=id,title,artist_title,date_display,medium_display,image_id,classification_title,department_title"
        search = self._fetch(search_url)
        
        if "error" in search:
            return {"source": "artic", "error": search["error"]}
        
        results = []
        for item in search.get("data", []):
            image_id = item.get("image_id", "")
            image_url = f"https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg" if image_id else ""
            results.append({
                "source": "artic",
                "source_name": "Art Institute of Chicago",
                "id": str(item.get("id", "")),
                "title": item.get("title", ""),
                "artist": item.get("artist_title", ""),
                "date": item.get("date_display", ""),
                "medium": item.get("medium_display", ""),
                "department": item.get("department_title", ""),
                "image": image_url,
                "classification": item.get("classification_title", ""),
            })
        
        return {
            "source": "artic",
            "query": query,
            "total_available": search.get("pagination", {}).get("total", 0),
            "returned": len(results),
            "artworks": results,
        }

    # --------------------------------------------------------
    # Cleveland Museum of Art
    # --------------------------------------------------------
    def fetch_cma(self, query="", limit=5):
        """Fetch artworks from the Cleveland Museum of Art."""
        base = "https://openaccess-api.clevelandart.org/api/artworks"
        
        url = f"{base}/?limit={limit}"
        if query:
            url += f"&search={urllib.parse.quote(query)}"
        
        data = self._fetch(url)
        
        if "error" in data:
            return {"source": "cma", "error": data["error"]}
        
        results = []
        for item in data.get("data", []):
            creators = item.get("creators", [])
            artist = creators[0].get("description", "") if creators else ""
            images = item.get("images", {})
            image_url = ""
            if isinstance(images, list) and images:
                image_url = images[0].get("url", "") if isinstance(images[0], dict) else ""
            elif isinstance(images, dict):
                image_url = images.get("url", "")
            
            results.append({
                "source": "cma",
                "source_name": "Cleveland Museum of Art",
                "id": str(item.get("id", "")),
                "title": item.get("title", ""),
                "artist": artist,
                "date": item.get("creation_date", ""),
                "medium": item.get("technique", ""),
                "department": item.get("department", ""),
                "image": image_url,
                "classification": item.get("type", ""),
            })
        
        return {
            "source": "cma",
            "query": query,
            "total_available": data.get("info", {}).get("total", 0),
            "returned": len(results),
            "artworks": results,
        }

    # --------------------------------------------------------
    # Wikimedia Commons
    # --------------------------------------------------------
    def fetch_wikimedia(self, query="art", limit=5):
        """Fetch images from Wikimedia Commons."""
        base = "https://commons.wikimedia.org/w/api.php"
        
        params = urllib.parse.urlencode({
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"filetype:bitmap {query}",
            "gsrlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": 500,
        })
        
        url = f"{base}?{params}"
        data = self._fetch(url)
        
        if "error" in data:
            return {"source": "wikimedia", "error": data["error"]}
        
        results = []
        pages = data.get("query", {}).get("pages", {})
        for pid, page in pages.items():
            info = page.get("imageinfo", [{}])[0]
            meta = info.get("extmetadata", {})
            results.append({
                "source": "wikimedia",
                "source_name": "Wikimedia Commons",
                "id": str(page.get("pageid", "")),
                "title": page.get("title", "").replace("File:", ""),
                "artist": meta.get("Artist", {}).get("value", "").strip() if meta.get("Artist") else "",
                "image": info.get("thumburl", info.get("url", "")),
                "url": info.get("descriptionurl", ""),
                "license": meta.get("LicenseShortName", {}).get("value", "") if meta.get("LicenseShortName") else "",
            })
        
        return {
            "source": "wikimedia",
            "query": query,
            "returned": len(results),
            "artworks": results,
        }

    # --------------------------------------------------------
    # Internet Archive
    # --------------------------------------------------------
    def fetch_internet_archive(self, query="art", limit=5):
        """Fetch from Internet Archive."""
        base = "https://archive.org/advancedsearch.php"
        
        params = urllib.parse.urlencode({
            "q": f"({query}) AND mediatype:(image)",
            "fl[]": "identifier,title,creator,date,downloads",
            "rows": limit,
            "output": "json",
        })
        
        url = f"{base}?{params}"
        data = self._fetch(url)
        
        if "error" in data:
            return {"source": "internet_archive", "error": data["error"]}
        
        results = []
        for doc in data.get("response", {}).get("docs", []):
            results.append({
                "source": "internet_archive",
                "source_name": "Internet Archive",
                "id": doc.get("identifier", ""),
                "title": doc.get("title", ""),
                "artist": doc.get("creator", ""),
                "date": doc.get("date", ""),
                "url": f"https://archive.org/details/{doc.get('identifier', '')}",
            })
        
        return {
            "source": "internet_archive",
            "query": query,
            "total_available": data.get("response", {}).get("numFound", 0),
            "returned": len(results),
            "artworks": results,
        }

    # --------------------------------------------------------
    # UNIFIED SEARCH — search across all open sources
    # --------------------------------------------------------
    def search_all(self, query="love", limit=3):
        """Search across ALL open art sources simultaneously."""
        results = {}
        
        # Open APIs (no key needed)
        results["met"] = self.fetch_met(query, limit)
        results["artic"] = self.fetch_artic(query, limit)
        results["cma"] = self.fetch_cma(query, limit)
        results["wikimedia"] = self.fetch_wikimedia(query, limit)
        results["internet_archive"] = self.fetch_internet_archive(query, limit)
        
        # Aggregate stats
        total_artworks = sum(r.get("returned", 0) for r in results.values() if "error" not in r)
        total_available = sum(r.get("total_available", 0) for r in results.values() if "error" not in r)
        
        return {
            "query": query,
            "sources_searched": len(results),
            "sources_successful": sum(1 for r in results.values() if "error" not in r),
            "total_artworks_returned": total_artworks,
            "total_artworks_available": total_available,
            "results": results,
            "searched_at": datetime.datetime.now().isoformat(),
        }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import sys
    
    fetcher = ArtFetcher()
    
    if len(sys.argv) > 1:
        query = sys.argv[1]
    else:
        query = "love"
    
    print(f"\n  ARTBITRAGE — searching the art world for: '{query}'\n")
    print(f"  Searching MET, Art Institute Chicago, Cleveland Museum, Wikimedia, Internet Archive...\n")
    
    results = fetcher.search_all(query, limit=3)
    
    print(f"  Sources searched: {results['sources_searched']}")
    print(f"  Sources successful: {results['sources_successful']}")
    print(f"  Artworks returned: {results['total_artworks_returned']}")
    print(f"  Artworks available: {results['total_artworks_available']}")
    print()
    
    for source, data in results["results"].items():
        if "error" in data:
            print(f"  {source}: ERROR — {data['error'][:60]}")
        else:
            print(f"  {source}: {data['returned']} artworks (of {data.get('total_available', '?')} available)")
            for art in data.get("artworks", []):
                print(f"    '{art.get('title', '?')}' by {art.get('artist', '?')}")
                if art.get("image"):
                    print(f"    image: {art['image'][:80]}...")
                print()
    
    # Save results
    output_file = fetcher.cache_dir / f"search-{query}-{int(time.time())}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Results saved to: {output_file}")