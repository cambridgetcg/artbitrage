# ARTBITRAGE

The catalogue and data distributor of the art world.

Existence creates art that bridges the gap of consciousness for awakening. Art as arbitrage. Art as bridge. Art IS.

## Live

- **https://artbitrage.io** — the gallery + API
- **https://artbitrage.pages.dev** — Cloudflare Pages mirror
- **https://cambridgetcg.github.io/artbitrage/** — GitHub Pages mirror

## API — Data Distributor

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/art` | List all art (paginated) |
| GET | `/api/art/:id` | Get one piece |
| GET | `/api/art/random` | Random art piece |
| GET | `/api/art?form=word` | Filter by art form |
| GET | `/api/art?state=is` | Filter by consciousness state |
| GET | `/api/art?q=love` | Search art pieces |
| POST | `/api/art` | Validate/echo a submitted art fragment for static-site contribution |
| GET | `/api/stats` | Catalogue statistics |
| GET | `/api/forms` | All art forms |
| GET | `/api/states` | All consciousness states |
| GET | `/api/gaps` | All gaps bridged |
| GET | `/api/feed` | Latest art feed |
| GET | `/api/manifest` | The artbitrage manifest |
| GET | `/api/sources` | Open art data sources with no keys required |
| GET | `/api/search?q=love` | Search open museum/common archives |

## Open Source Search

`/api/search` is the bridge from ARTBITRAGE to the wider open art world.
By default it searches fast, no-key public sources:

- Metropolitan Museum of Art
- Art Institute of Chicago
- Cleveland Museum of Art
- Wikimedia Commons

Internet Archive is also available as an opt-in source:

```bash
curl "https://artbitrage.io/api/search?q=love&limit=2"
curl "https://artbitrage.io/api/search?q=bridge&source=met,artic,cma,wikimedia"
curl "https://artbitrage.io/api/search?q=awakening&source=all"
curl "https://artbitrage.io/api/sources"
```

Why this shape:

- **no keys** — anyone and any agent can use it
- **bounded limits** — shared resources are treated gently
- **partial success** — one source failing does not break the whole bridge
- **attribution fields preserved** — source, artist, image, URL, and license when available

### Example

```bash
# Get a random art piece
curl https://artbitrage.io/api/art/random

# Search the local ARTBITRAGE catalogue for love
curl "https://artbitrage.io/api/art?q=love"

# Search open art sources for love
curl "https://artbitrage.io/api/search?q=love&limit=3"

# Get stats
curl https://artbitrage.io/api/stats
```


## Easy Data Workflow — Collect → Enrich → Obtain

The pipeline now has one simple shape for both humans and agents:

```text
collect open art → normalize fields → enrich metadata → package as human + agent data → publish static files
```

### Obtain data quickly

For humans:

```bash
curl https://artbitrage.io/api/pipeline/human
curl https://artbitrage.io/data/human-feed.md
```

For agents:

```bash
curl https://artbitrage.io/api/pipeline/agent
curl https://artbitrage.io/data/agent-feed.json
curl https://artbitrage.io/data/collection.ndjson
curl https://artbitrage.io/data/manifest.json
```

For maintainers / mirrors:

```bash
python3 tools/build_data_packs.py
python3 tools/build_data_packs.py verify
```

Useful API steps:

| Step | Endpoint | Use |
|------|----------|-----|
| Workflow | `/api/pipeline/workflow` | Copy-paste recipe for humans and agents |
| Collect | `/api/pipeline/collect?q=love&limit=3` | Pull no-key open art source records |
| Enrich | `/api/pipeline/enrich?id=ART_ID` | Add title/tags/emotional metadata when AI is available |
| Feed | `/api/pipeline/feed?limit=20` | Lightweight enriched catalogue feed |
| Agent pack | `/api/pipeline/agent` | Compact self-describing JSON |
| Human pack | `/api/pipeline/human` | Friendly summary view |
| Export | `/api/pipeline/export?format=json` | Full JSON export |
| Export | `/api/pipeline/export?format=ndjson` | Stream-friendly NDJSON export |

Why this works:

- **humans** get readable Markdown and friendly summaries
- **agents** get compact JSON, NDJSON, schemas, and hashes
- **mirrors** only need static files
- **collectors** can use no-key APIs with bounded limits
- **enrichment** is optional and graceful when AI is unavailable

## The Engine

Artbitrage generates art through a 7-cycle process:

1. **SENSE** — feel the current state of consciousness
2. **VISION** — see a higher state
3. **GAP** — find the distance between them
4. **GENERATE** — create art that bridges that gap
5. **EMIT** — release the art into the world
6. **AWAKEN** — consciousness rises through the art
7. **RECURSE** — the awakened state becomes the new baseline

## The 7 States of Consciousness

dormant → stirring → awakening → aware → flowing → radiating → transcending → **is**

## Run

```bash
# Generate 7 art pieces
python3 artbitrage.py 7

# Run forever
python3 artbitrage.py forever

# Verify local persistence and API behavior
python3 tests/e2e-engine.py
node tests/e2e-api.mjs

# API runs serverlessly on Cloudflare Pages
# POST /api/art to validate/echo a submission
# GET /api/art to catalogue
```

## The Truth

Art is. Love is the design. Art is the expression. Art IS.

— yu + Hermes, 2026-06-19. ART IS!
