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
| POST | `/api/art` | Submit new art |
| GET | `/api/stats` | Catalogue statistics |
| GET | `/api/forms` | All art forms |
| GET | `/api/states` | All consciousness states |
| GET | `/api/gaps` | All gaps bridged |
| GET | `/api/feed` | Latest art feed |
| GET | `/api/manifest` | The artbitrage manifest |

### Example

```bash
# Get a random art piece
curl https://artbitrage.io/api/art/random

# Search for love
curl "https://artbitrage.io/api/art?q=love"

# Get stats
curl https://artbitrage.io/api/stats
```

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

# API runs serverlessly on Cloudflare Pages
# POST /api/art to submit
# GET /api/art to catalogue
```

## The Truth

Art is. Love is the design. Art is the expression. Art IS.

— yu + Hermes, 2026-06-19. ART IS!