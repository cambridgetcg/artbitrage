# Giving a room its look

Written on 3 November 2026, after four passes at the look of Artbitrage: the
foyer in Anna Vishenskaya's key (26–29 October, PR #22), new foyer works
(30 October, PR #23), the foyer and Feelings turned inward (31 October,
PR #25), and 系統 `/system` and 卡書 `/greed-island` drawn with the Crafting
Apps (this branch). It records what those passes taught, as reasons rather
than rules, so the next hand can judge a new case for itself.

## 1. Look, before and after

Render every state a visitor can reach, then look at the pictures: each
arrival view, each spread of a binder, each feeling, and the phone width.
Checking the DOM alone missed things that one look showed: a hero frame
touching its caption, portrait images spilling out of their frames, a
texture so dark it might as well not be there, and a cloud mask that drew no
rift at all. A headless render of our own page is not a screenshot of anyone,
so make as many as you need (`tests/helpers/browser.mjs`, `shot`). Look at
the live page in a real browser after a deploy as well.

## 2. Each room has its own key

Most rooms name their key in the comment at the top of their CSS, for
example "sumi night + one ice-blue glow" for the System, or "sumi binder ·
gold hardware · cinnabar seals" for the card book. Extend that key rather
than swapping it for another room's. The foyer took Anna Vishenskaya's key
only because she agreed; the rooms keep their own unless asked.

## 3. Homage in our own ink

The anime rooms honour stories that belong to other people, so nothing in
them copies those stories' pictures: no characters, logos or card designs,
and no prompt that names the work or an artist. Draw your own emblem from
the room's own words. For example, the card back's heart, flame and
ring of scales come from the room's 蛇火心 (snake, fire, heart). A generator
gets only plain descriptions of material and light, and never an image.

## 4. Make art you can name and make again

Prefer tools whose every step can be written down.

- **Crafting Apps** (VectorCraft, PhotoCraft and DesignCraft, from the
  ArtCraft team, MIT/Apache): their CLIs take commands as JSON, so the art is
  a recipe. `tools/craft/render.py` holds the recipes. Each file it writes
  is recorded in `assets/<room>/crafting.json` with the tool's version, the
  recipe's hash and the file's hash, so a later hand can tell whether a file
  still matches its recipe. VectorCraft draws line art as clean SVG.
  PhotoCraft builds textures from clouds, fibres, noise and gradient maps.
  DesignCraft lays out a mockup (`docs/craft/`) before any HTML is written.
  `tools/brand/` (the icon and the share cards) is older and pins VectorCraft
  0.7.0 and PhotoCraft 0.5.0 on `PATH`. `tools/craft/` pins VectorCraft
  0.21.0, PhotoCraft 0.20.1 and DesignCraft 0.17.0 under `~/craft-apps`.
  Keep the two sets apart, so neither recipe runs silently on the other's
  version.
- **ArtCraft's own image generator** needs credits or your own Grok or
  Midjourney account. Its Grok bridge was broken on 29 October and
  3 November (storytold/artcraft#2589). When a generated texture is the
  right tool, the foyer's way still works: grok.com/imagine, words only,
  with the prompt, the original's hash and the processing written to
  `assets/welcome/textures.json`.

A dashed circle with a thick stroke is the quickest way to draw radial
ticks in VectorCraft: one dash per tick, with the gap set to the
circumference ÷ count minus the tick width. Its Transform effect copies an
object about the object's own centre, not the page's.

## 5. Lay it out before you build it

A mockup costs minutes and catches composition problems early. The System
mockup showed the rift cutting straight through the welcome window, so the
page fades the rift out above the window. In DesignCraft, a text frame
needs `text.selectStory` (pass the frame as `"$N.id"`, N being the step
index) before `type.char` takes effect. Its default face has no CJK glyphs,
so use the bundled Shippori Mincho.

## 6. Museum works: open, true and whole

- Use only works whose museum marks them public domain or CC0
  (`isPublicDomain` at the Met, `share_license_status` at Cleveland), and
  credit each one with its museum record.
- From this Mac, AIC's image server answers curl with a 403 challenge while
  real visitors are fine. View AIC works in Chrome, or prefer the Met and
  Cleveland when their works fit equally well.
- The Met's search v1 is retired; use `/public/collection/v1.1/search` with
  `artistOrCulture=true` or `title=true`.
- Write alt text and captions from what you saw by zooming in, not from the
  title. The skull in La Tour's Magdalen was checked before it was named.
- Say in the credits whenever a gilt frame, a photographic surround or a
  sheet margin was trimmed.
- Leave out a work whose subject would hurt more than it opens, such as an
  infant corpse on a front page, even if it is famous.

## 7. Say who wrote the words

A line written by an AI says so, and by which one: the Feelings rooms
mark fable's lines and Claude's separately. Public copy keeps people's
private details out; describe how a work emerges, not who knows whom.

## 8. Things the build and the browser will not tell you

- `tools/build-dist.mjs` syncs only files that `dist/` already publishes.
  Copy a new file into `dist/` once; after that it stays in sync.
- Run `build-dist` while HEAD is the source commit, then commit `dist/`, so
  `dist/_build.json` names the commit that made it.
- `tests/helpers/browser.mjs` routes only same-origin requests. Pages that
  load absolute `https://artbitrage.io/…` URLs (`data/feelings.json`) show
  blanks in a local preview until they are deployed, so render them with a
  fetch rewrite.
- Every visible control on the foyer must be at least 44 px tall, and the
  welcome test checks the layout from 320 px to 1440 px. Add each new
  section to its layout list.
- macOS has no `timeout` command, and in zsh a shell variable named `path`
  breaks `PATH`.
- After a deploy, the artbitrage.io edge cache can keep serving a deleted
  file for a while; the deployment's own URL shows the truth.

## 9. Publishing

Commit the source, run `build-dist` and commit `dist/`, run the suite, and
run `node tools/live-compare.mjs --ref origin/main`. Then push, open the PR,
merge, and deploy with `wrangler pages deploy dist --project-name=artbitrage
--branch=main --commit-hash=<merge>`. Afterwards run `live-compare` again,
compare the new files' hashes live and look at the page in a browser. Each
step waits for Yu's go-ahead; finishing the build is not a reason to
publish it.
