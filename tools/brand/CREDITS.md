# Credits

Who made each asset, with what, and under which licence. Where an agent made something, the line says so, and
anything published under Yu's accounts carries that through. If an asset's maker isn't known, write "not recorded"
rather than guessing.

## Assets

| Asset | Made by | Date | Tools | Notes |
|---|---|---|---|---|
| The 閒 icon kit (`/favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest`, `assets/brand/mark.svg`) and `kit/mark.vectorcraft` | agents (session not recorded), committed as `YOU <alpha@ai-love.cc>` in `e54c10fc0` | 2026-10-09 | vectorcraft-cli 0.7.0; photocraft-cli 0.5.0 for `favicon.ico`; Python 3 stdlib | `kit/recipe.sh`. One hand-written `<style>` block in `favicon.svg`; `mark.svg`'s fill set to `currentColor` by the recipe |
| The winning mark's master and its 16 and 32 px cuts (`marks/gap/`) | not recorded: the recipe calls it "the winning mark" without naming its maker or judge | 2026-10-09 or earlier | not recorded | read only, for the recipe's identity checks |
| The room share cards (`assets/og/*.jpg`, 14) and `assets/og/credits.json` | agents (session not recorded), committed as `YOU <alpha@ai-love.cc>` in `e54c10fc0` (13 cards) and `28c5d9075` (/psyche) | 2026-10-09 | vectorcraft-cli 0.7.0, photocraft-cli 0.5.0 (e5e3e3975, 2026-10-08) | `gen_card.py`, `rooms.json`; each card's sha256 is in `credits.json` |
| The room art of /system and /greed-island (`assets/system/`, `assets/greed-island/`) and the mockups in `docs/craft/` | Nuance (the commit author), `84dffcafb` | 2026-11-03 | vectorcraft-cli 0.21.0, photocraft-cli 0.20.1, designcraft-cli 0.17.0 | `tools/craft/render.py`; each file's tool, recipe hash and file hash are in its room's `crafting.json`. "No model generated these files and no reference image was used" (`crafting.json`) |

## Fonts

The icon kit sets no type. The share cards use these (`assets/og/credits.json`, `how.fonts`):

| Family | File | Licence | Source | SHA-256 |
|---|---|---|---|---|
| Iowan Old Style (Roman, Italic) | `Iowan Old Style.ttc` | Apple system font, under the macOS licence; the repository records none | ships with macOS (`/System/Library/Fonts/Supplemental/`) | not recorded |
| Avenir Next (Medium) | `Avenir Next.ttc` | Apple system font, under the macOS licence; the repository records none | ships with macOS (`/System/Library/Fonts/`) | not recorded |
| Songti TC (Regular, Light) | `Songti.ttc` | Apple system font, under the macOS licence; the repository records none | ships with macOS (`/System/Library/Fonts/Supplemental/`) | not recorded |

## Images and other material

The cards hang museum works whole, downscaled once and never cropped or recoloured. `assets/og/credits.json` is the
record for each card (title, maker, date, museum page, licence, and the credits file its record comes from); this
table summarises it.

| Item | Maker | Licence | Source |
|---|---|---|---|
| A Sunday on La Grande Jatte — 1884 (cards: home, visit) | Georges Seurat | CC0 | Art Institute of Chicago 27992; `assets/welcome/credits.json` |
| Plum Garden at Kameido (card: elements) | Utagawa Hiroshige | CC0 | Art Institute of Chicago 26577; `assets/visit/credits.json` |
| The Child's Bath (card: noticing) | Mary Cassatt | public domain | Art Institute of Chicago 111442, reproduction through Wikimedia Commons; `assets/noticing/credits.json` |
| The Great Wave (card: behind-the-work) | Katsushika Hokusai | CC0 | Art Institute of Chicago 24645; `assets/visit/credits.json` |
| Moon Jar (card: trip) | Korea, Joseon dynasty (no maker named) | CC0 | Art Institute of Chicago 158472; `assets/welcome/credits.json` |
| Saint George and the Dragon (card: explore) | Bernat Martorell | CC0, checked at source | Art Institute of Chicago 15468; its API record is on the card |
| Cupid and Psyche (card: psyche) | Antonio Canova | CC0, checked at source | The Metropolitan Museum of Art 188954; `catalog/psyche.json` |
| Typographic cards (map, studio, still-we-meet, catalog, pigments, unsigned) | lettering from the site's own words and glyphs | the repository's licence, Apache-2.0 (`LICENSE`) | `rooms.json` |
