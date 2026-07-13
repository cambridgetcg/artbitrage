# Where the images live (since 2026-07-13)

Every picture the static pages show is served from **this site itself**, at
`/art/<name>.jpg` — the files sit in `dist/art/` and deploy with everything
else (`wrangler pages deploy dist`). Cloudflare's edge caches them worldwide;
no outside host can break the walls.

## The naming

- `<slug>.jpg` — full-size, `<slug>-t.jpg` — its thumbnail (when one exists).
- `artic-*.jpg` — public-domain works once hotlinked from the Art Institute
  of Chicago (their bot wall 403s non-browsers, so we brought the pixels home).
- Everything else came from the original S3 upload (mona-lisa.jpg, the-kiss.jpg, …).

## To add a new image

Drop the .jpg into `dist/art/`, reference it as `/art/<name>.jpg`, deploy.
That's the whole pipeline.

## What still hotlinks (on purpose)

- **index.html** keeps 15 images from the Met and Cleveland Museum CDNs —
  both serve everyone without challenges, so no need to copy them.
- **catalog/*.json + functions/api** still carry artic.edu IIIF URLs. That's
  the art engine's living output (hermes regenerates it); freezing a snapshot
  here would just drift. If artic.edu ever blocks browsers too, revisit.
- Museum **credit links** (the "source" lines under artworks) always point at
  the museums. Those are attributions, not image loads.

## Backups (three copies now)

1. `dist/art/` in this repo (committed),
2. the original S3 bucket `artbitrage-art` (kept as-is, unused by the site),
3. `~/backups/artbitrage-art-s3-2026-07-13/` on this Mac.

The data feeds (`data/*.json`) use absolute `https://artbitrage.io/art/…`
URLs so agents reading them from anywhere get working links.
