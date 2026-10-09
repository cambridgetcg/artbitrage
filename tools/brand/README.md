# tools/brand — the 閒 icon and the room share cards

Everything here was made with ArtCraft, headless: **VectorCraft 0.7.0** (`vectorcraft-cli`)
draws every vector, PNG and type layer; **PhotoCraft 0.5.0** (`photocraft-cli`) writes
`favicon.ico`, downscales artworks and finishes the cards. The helpers are Python 3,
standard library only. Nothing here runs at deploy time: the outputs are committed and
mirrored into `dist/` like every other public file.

## The icon: 閒, the gap

A door in two arched leaves; the slit between them opens into a full round moon. The
moon is not drawn: it is the gap. 閒 (門 + 月) is moonlight seen through the gap of a
door, the first way 間 "gap" was written. Forest `#17271f` and gold `#dbcca7`, the home
page's own tokens.

| file | what it is |
| --- | --- |
| `kit/recipe.sh` | rebuilds the whole kit and checks it (sizes, every pixel a site token, the 16/32 px cuts against the mark's hand-hinted cuts, the maskable safe circle, manifest sizes) |
| `kit/mark.vectorcraft` | the VectorCraft source document the recipe writes (kept so the drawing can be opened and edited) |
| `marks/gap/` | the recipe's inputs: the winning mark's master (`mark-dark.svg`) and its 16 and 32 px cuts, read only, for the identity checks |

Rebuild into `tools/brand/kit/out/` (git-ignored), or into any folder you name:

```bash
bash tools/brand/kit/recipe.sh                 # -> tools/brand/kit/out/
bash tools/brand/kit/recipe.sh /tmp/icon-kit   # -> /tmp/icon-kit/
```

The rebuild is byte-identical to what the site serves (`cmp` each file). To install a
changed kit, copy the files to the site root **and** `dist/`:

```bash
O=tools/brand/kit/out
for f in favicon.svg favicon.ico favicon-16.png favicon-32.png apple-touch-icon.png \
         icon-192.png icon-512.png icon-maskable-512.png site.webmanifest; do
  cp "$O/$f" "$f"; cp "$O/$f" "dist/$f"
done
cp "$O/mark.svg" assets/brand/mark.svg; cp "$O/mark.svg" dist/assets/brand/mark.svg
```

`/manifest.json` is the site's philosophy document, not a web-app manifest. The icon
uses `/site.webmanifest`; never create or overwrite `manifest.json` (the recipe refuses
to run if one sits in its output folder). `assets/brand/mark.svg` is the bare door with
`fill="currentColor"`, for inline use.

The `<head>` tags live in `head.py` (`ICON_LINKS`). The generated pages import it; the
hand-written pages carry the same lines. `theme-color` is not part of the shared block:
each room keeps its own, and only `/` and `/visit` (which had none) use the forest
`#17271f`.

`/still-we-meet` carries neither the icon block nor share tags: its own test holds the room to
zero outbound links and zero `<link>` tags. Its card is still made (`assets/og/still-we-meet.jpg`)
but no page points at it until the owner decides the room should carry the shared head.

## The share cards: through the door

One 1200×630 JPEG (≤ 200 KB) per room, at `assets/og/<room>.jpg`, mirrored to
`dist/assets/og/`. You stand in the room (its wall colour); an arched door opens onto
the next room, where the room's key work hangs whole, mounted as that room's CSS mounts
it. A room without a key work gets a typographic card: its glyph, or words cited from
the site, lettered on the far wall.

| file | what it is |
| --- | --- |
| `gen_card.py` | the generator (VectorCraft measures and composes, PhotoCraft finishes, a pixel check proves the work is untouched) |
| `rooms.json` | one spec per room: copy, glyph, tokens, mount and record, each with its source; `card_alt` is the `og:image:alt` text |
| `pngread.py` | a standard-library PNG reader for the pixel check |
| `head.py` | the shared `<head>` tags (icon links, `og:image` block) used by the page generators |

```bash
python3 tools/brand/gen_card.py tools/brand/rooms.json --all          # all cards + credits.json, root and dist/
python3 tools/brand/gen_card.py tools/brand/rooms.json --slug trip    # one card, root and dist/
python3 tools/brand/gen_card.py tools/brand/rooms.json --all --out /tmp/og   # elsewhere, no dist mirror
```

`--all` also writes `assets/og/credits.json`: for each card, the artwork it shows (title,
maker, date, museum URL, and the credits file its record comes from) or `"typographic"`,
the mount and its CSS source, the sha256 of the JPEG, and how the cards are made. A work
whose image has no credits file of its own (the legacy `/art/` mirror) carries its at-source
rights check in `rooms.json` (`api_source`, `is_public_domain`, `copyright_notice`,
`rights_verified_at`, `image_sha256`, `image_bytes`, `image_px`), copied onto its card. The
artwork is downscaled once with Lanczos, never upscaled, cropped or recoloured, and its
pixels in the flattened master must equal the downscaled work or the card fails.

Same tools, same macOS fonts (Iowan Old Style, Avenir Next, Songti TC) → byte-identical
cards. Check one against the committed file:

```bash
python3 tools/brand/gen_card.py tools/brand/rooms.json --slug unsigned --out /tmp/og-check
cmp /tmp/og-check/unsigned.jpg assets/og/unsigned.jpg && echo identical
```

After changing a card's alt text or adding a room, regenerate the pages that carry it:
`python3 tools/build-elements.py`, `tools/build-noticing.py` and `tools/build-unsigned.py`
read `assets/og/credits.json`; the hand-written pages are edited by hand.
`node tests/e2e-brand.mjs` checks icons, cards, credits, head tags and dist mirrors.
