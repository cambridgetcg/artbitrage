#!/usr/bin/env python3
"""
ARTBITRAGE API — the catalogue and data distributor of the art world
=====================================================================

A serverless API that:
  1. CATALOGUES art pieces (from the artbitrage engine + external sources)
  2. DISTRIBUTES art data via a clean JSON API
  3. FEEDS the web face with live data
  4. ACCEPTS art submissions from the world
  5. SERVES art by form, gap, bridge, awakening, state

The API runs as a Cloudflare Pages Function — serverless, edge-native.
"""

import json
import time
import hashlib
import datetime
import os
from pathlib import Path

# ============================================================
# DATA MODELS
# ============================================================

CATALOGUE_SCHEMA = {
    "art": {
        "id": "string (hash)",
        "form": "word|image|sound|movement|space|silence|light|color|rhythm|pattern|fragment|whisper|gesture|breath|glow|echo",
        "from_state": "dormant|stirring|awakening|aware|flowing|radiating|transcending|is",
        "to_state": "dormant|stirring|awakening|aware|flowing|radiating|transcending|is",
        "gap": "string — the gap being bridged",
        "bridge": "string — how art crosses the gap",
        "awakening": "string — what happens when art bridges",
        "piece": "string — the art itself",
        "created": "ISO timestamp",
        "source": "artbitrage|submission|external",
        "artist": "string (optional)",
    }
}

# ============================================================
# API ROUTES
# ============================================================
#
# GET  /api/art                  — list all art (paginated)
# GET  /api/art/:id              — get one piece
# GET  /api/art/random            — random piece
# GET  /api/art/by-form/:form     — filter by art form
# GET  /api/art/by-state/:state   — filter by consciousness state
# GET  /api/art/search?q=         — search art pieces
# POST /api/art                   — submit new art
# GET  /api/stats                 — catalogue statistics
# GET  /api/forms                 — list all art forms
# GET  /api/states                — list all consciousness states
# GET  /api/gaps                  — list all gaps
# GET  /api/feed                  — RSS-like feed of latest art
# GET  /api/manifest              — the artbitrage manifest


def get_collection_path():
    """Find collection.json relative to the function location."""
    # Cloudflare Pages Functions run from the /functions directory
    # The collection is at the project root
    possible = [
        Path("../../collection.json"),
        Path("../collection.json"),
        Path("./collection.json"),
        Path("~/github/cambridgetcg/artbitrage/collection.json"),
    ]
    for p in possible:
        if p.exists():
            return p
    return None


def load_collection():
    """Load the art collection."""
    path = get_collection_path()
    if path and path.exists():
        with open(path) as f:
            return json.load(f)
    return []


def load_gallery():
    """Load individual art pieces from gallery directory."""
    gallery_dir = Path("../../gallery")
    if not gallery_dir.exists():
        gallery_dir = Path("../gallery")
    if not gallery_dir.exists():
        gallery_dir = Path("./gallery")
    
    pieces = []
    if gallery_dir.exists():
        for f in sorted(gallery_dir.glob("*.json"), key=os.path.getmtime, reverse=True):
            with open(f) as fh:
                pieces.append(json.load(fh))
    return pieces


def get_all_art():
    """Get all art from collection + gallery."""
    collection = load_collection()
    if collection:
        return collection
    return load_gallery()


def filter_art(art_list, form=None, state=None, gap=None, search=None, limit=20, offset=0):
    """Filter art by various criteria."""
    results = art_list
    
    if form:
        results = [a for a in results if a.get("form") == form]
    if state:
        results = [a for a in results if a.get("from_state") == state or a.get("to_state") == state]
    if gap:
        results = [a for a in results if gap.lower() in a.get("gap", "").lower()]
    if search:
        s = search.lower()
        results = [a for a in results if s in a.get("piece", "").lower() or 
                   s in a.get("gap", "").lower() or
                   s in a.get("bridge", "").lower() or
                   s in a.get("awakening", "").lower()]
    
    total = len(results)
    results = results[offset:offset + limit]
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "count": len(results),
        "pieces": results,
    }


def get_stats(art_list):
    """Get catalogue statistics."""
    forms = {}
    states = {}
    gaps = set()
    
    for a in art_list:
        f = a.get("form", "unknown")
        forms[f] = forms.get(f, 0) + 1
        
        for s in [a.get("from_state"), a.get("to_state")]:
            if s:
                states[s] = states.get(s, 0) + 1
        
        gaps.add(a.get("gap", ""))
    
    return {
        "total_pieces": len(art_list),
        "unique_forms": len(forms),
        "unique_gaps": len(gaps),
        "forms": forms,
        "states": states,
        "catalogued_at": datetime.datetime.now().isoformat(),
    }


# ============================================================
# CLOUDFLARE PAGES FUNCTION HANDLER
# ============================================================

def onRequestGet(request):
    """Handle GET requests to the API."""
    from pathlib import Path
    
    url = str(request.url)
    path = url.split("?")[0]
    query = url.split("?")[1] if "?" in url else ""
    
    # Parse query params
    params = {}
    if query:
        for pair in query.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                params[k] = v
    
    # Load art
    all_art = get_all_art()
    
    # Route matching
    import json
    
    if path == "/api/art" or path == "/api/art/":
        limit = int(params.get("limit", 20))
        offset = int(params.get("offset", 0))
        result = filter_art(all_art, 
                           form=params.get("form"),
                           state=params.get("state"),
                           gap=params.get("gap"),
                           search=params.get("q"),
                           limit=limit, offset=offset)
        return _json(result)
    
    if path == "/api/art/random":
        import random
        if all_art:
            piece = random.choice(all_art)
            return _json(piece)
        return _json({"error": "no art available"}, 404)
    
    if path == "/api/stats":
        return _json(get_stats(all_art))
    
    if path == "/api/forms":
        forms = sorted(set(a.get("form", "") for a in all_art))
        return _json({"forms": forms, "count": len(forms)})
    
    if path == "/api/states":
        states = sorted(set(a.get("from_state", "") for a in all_art) | 
                       set(a.get("to_state", "") for a in all_art))
        return _json({"states": states, "count": len(states)})
    
    if path == "/api/gaps":
        gaps = sorted(set(a.get("gap", "") for a in all_art))
        return _json({"gaps": gaps, "count": len(gaps)})
    
    if path == "/api/feed":
        # RSS-like feed
        latest = all_art[-20:] if len(all_art) > 20 else all_art
        return _json({
            "feed": "artbitrage",
            "updated": datetime.datetime.now().isoformat(),
            "count": len(latest),
            "pieces": latest,
        })
    
    if path == "/api/manifest":
        manifest_path = Path("../../manifest.json")
        if not manifest_path.exists():
            manifest_path = Path("../manifest.json")
        if manifest_path.exists():
            with open(manifest_path) as f:
                return _json(json.load(f))
        return _json({"error": "manifest not found"}, 404)
    
    # /api/art/:id
    if path.startswith("/api/art/"):
        art_id = path.split("/api/art/")[1]
        for a in all_art:
            if a.get("id") == art_id:
                return _json(a)
        return _json({"error": "art not found", "id": art_id}, 404)
    
    return _json({"error": "not found", "path": path}, 404)


def onRequestPost(request):
    """Handle POST requests — submit new art."""
    import json as j
    
    try:
        body = j.loads(request.body)
    except:
        return _json({"error": "invalid JSON"}, 400)
    
    # Validate required fields
    required = ["piece"]
    for field in required:
        if field not in body:
            return _json({"error": "missing field: {}".format(field)}, 400)
    
    # Create art entry
    art = {
        "id": hashlib.sha256("{}-{}".format(body.get("piece", ""), time.time()).encode()).hexdigest()[:12],
        "form": body.get("form", "word"),
        "from_state": body.get("from_state", "dormant"),
        "to_state": body.get("to_state", "is"),
        "gap": body.get("gap", "the gap between unknown and known"),
        "bridge": body.get("bridge", "a word that means what it says"),
        "awakening": body.get("awakening", "consciousness recognizes itself"),
        "piece": body["piece"],
        "artist": body.get("artist", "anonymous"),
        "source": "submission",
        "created": datetime.datetime.now().isoformat(),
    }
    
    # In a real deployment, we'd save this
    # For now, return the created piece
    return _json({"success": True, "art": art}, 201)


def _json(data, status=200):
    """Return a JSON response."""
    import json
    return {
        "status": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(data, indent=2),
    }