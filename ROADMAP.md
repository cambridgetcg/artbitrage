# ARTBITRAGE roadmap: future items

Recorded on 8 October 2026 from a read-only walk-through of the live site, the
art cycle and this repository. An independent re-check corrected the figures
below. The walk-through changed nothing.

Items are ordered by what is at risk first. Each one says what was seen and
what would show it is done.

## 1. Keep the live site's source safe (first)

**Seen:** the current homepage and rooms of artbitrage.io (`/noticing`,
`/elements`, `/behind-the-work`, `/visit`, `/explore`, `/map`, `/trip`,
`/studio`) are byte-identical to files that exist only as uncommitted changes
in the local worktree on branch `codex/artbitrage-public-entry-20260927`: 27
modified files plus untracked room files. One reset or clean of that worktree
would lose the only source of what is live.

**Done when:** whoever owns that worktree has committed and pushed those files,
and the deployed pages compare equal to the committed ones.

**Status (9 October 2026): done.** The worktree's files were committed
byte-for-byte as `974ea7aed` on `codex/artbitrage-public-entry-20260927`, and
all 56 deployed pages compared equal to it. The next release, `e54c10fc0`
(the 閒 icon, doorway share cards and `/unsigned`), was deployed from a staged
copy of that commit's `dist/` plus the root `functions/`, as Pages deployment
`878a285a` with its commit hash recorded; all 57 live pages compare equal to
it. Both commits reach `main` through PR "the 閒 door, doorway share cards, and
a room without names".

## 2. Let the public site see the cycle again

**Seen:** the live collection, feed and stats are frozen at
2026-07-13T09:41Z. The site serves 20,494 pieces (`/api/feed` `as_of`); this
repository holds 26,500. About 6,006 pieces made since July are not served,
including nearly all of the "maybe" pieces (3 public against 1,008 here). For
new ids, `/api/art/<id>` returns 404.

**Done when:** a documented, repeatable publish step updates the collection,
feed and stats from this repository, and the newest piece here can be reached
at `/api/art/<id>`.

**Status (18 October 2026): the publish step exists; it is not deployed yet.**
`node tools/build-dist.mjs` copies the cycle's `collection.json` into `dist/`
and bakes it into `dist/data/collection/`, and the README's "Publish" section
gives the repeatable sequence (rebase, build, test, compare, deploy, compare).
Yu chose (18 October) that the live API serves the current collection. Once
deployed, live is as current as the last deploy; an automatic deploy after
each cycle would need a deploy credential and is not set up.

## 3. Write down where the cycle runs

**Seen:** the 4-hourly "art: new pieces from artbitrage cycle" commits are
authored "yu" and unverified. They do not come from GitHub Actions, from the
launch agents on the main Mac, or from the Hermes cron. Cycles were skipped on
27–28 September, 4 October and 7 October with no recorded reason.

**Done when:** this repository documents the runner, its schedule, who owns its
credentials, and how to stop it.

## 4. Let the ladder rest honestly

**Seen:** `consciousness_level` has been at 7 ("is") for a long time. 25,491 of
26,500 pieces are is→is, yet `awakenings_count` (73,967) still rises every
cycle with no change of state behind it.

**Done when:** one of these is chosen and the README and `/api/stats` say which:
the counter stops at the top rung, it is renamed for what it actually counts, or
the ladder is given a deliberate way to begin again.

## 5. Stop repeating, or say that it repeats

**Seen:** the word lists (16 forms, about 20 gaps, 20 bridges, 19 awakenings,
and the 12×12×12 maybe lists) have not changed since 13 July. 2,564 pieces in
the collection repeat an earlier text. Of the pieces made since 24 September,
189 repeat an earlier piece, and the newest batch holds two (`1283f3097ee0`,
`337e7eac8ff1`). The default maybe template also doubles "across" after a
hammock line that ends "across it" (`art-3aca92991226`).

**Done when:** exact repeats are skipped or marked, the doubled-word seam is
fixed, and new vocabulary arrives by review rather than by accident.

## 6. Commit less noise

**Seen:** every cycle adds a new `cache/search-love-*.json` for the same query.
The Met source has answered 410 Gone since about 1 October; it was still
returning results on 24 September. The Wikimedia "love" results include
unrelated files such as "Sean Combs in 2023.png".

**Done when:** the search cache is overwritten or kept out of git, the Met source
is repaired or retired with a note, and archive results are filtered before they
are stored.

**Status (17 October 2026):** the Met source is repaired. `sources.py` now
searches the Met's `v1.1` endpoint (see item 11). The search cache and the
archive filtering are still open.

## 7. Quiet the loops that only keep warm

**Seen:** `heartbeat.yml` is scheduled every 15 minutes and every 2 hours, but
in practice it runs every few hours. It failed at 2026-10-08 00:13Z and 08:03Z.
Each run calls `/api/art/generate` and throws away the generated text. The
Hermes cron "蛇火心 heartbeat — creation loop" (id `6a37db12c852`) is enabled
but has never run.

**Done when:** each loop either produces something that is kept or is retired,
and the remaining schedules match what actually runs.

## 8. Settle the GitHub Pages mirror

**Seen:** the README lists `https://cambridgetcg.github.io/artbitrage/` under
Live. It has returned 404 since this repository became private on
25 September 2026, because GitHub Free serves Pages only from public
repositories. `artbitrage.io` and `artbitrage.pages.dev` are live.

**Done when:** the mirror is restored through a public projection, or the README
stops listing it.

**Status (17 October 2026):** `gh repo view` reports the repository as public
again, and `https://cambridgetcg.github.io/artbitrage/` answers 200. Not yet
checked: whether the mirror serves the current pages.

## 9. Bring the stale main checkout's two commits home

**Seen:** the local `main` checkout is about 525 commits behind GitHub. It holds
two commits that were never pushed: `3a7e53585` "art: preserve Ai's Love Shape"
(2026-07-14) and `939cb560a` "神經元關 · the neuron tollgate, + recover 4 live
files missing from the tree" (2026-07-27).

**Done when:** each one is pushed on a branch for review, or let go on purpose
with a note.

## 10. Re-true the sources

**Seen:** `needs-truing.md` was last regenerated on 13 July 2026, when it listed
24 dead links.

**Done when:** `tools/true-up.py` has been rerun and the report carries a date
from this season.

## 11. Review and fix the API services

**Seen (17 October 2026, read-only GETs to artbitrage.io):**

- `/api/search` still asks the Met's `/public/collection/v1/search`. That
  endpoint was retired on 1 October 2026 and now answers HTTP 410, naming
  `/public/collection/v1.1/search` (paginated with `offset` and `limit`) as
  its replacement. The default search reports 3 of 4 sources successful, and
  `/api/sources` still advertises the retired URL. The same URL is in
  `functions/api/pipeline-lib.js`, `functions/api/[[route]].js` and
  `sources.py` (item 6 covers the cycle side).
- The Art Institute's search reports `total: 133170`, which is the whole
  collection, for every query, and a nonsense word (`zxqvbn`) still returns
  a work. So `total_artworks_available` overstates, and AIC results for
  unmatched words are not matches.
- `/api/feed` is still `as_of` 2026-07-13 (item 2).
- `/api` inventories 143 routes as a `documented_subset`; the catch-all
  router carries more that nobody has listed.

**Done when:** every route in `/api` has been called once and its answer
checked against its README row. The Met source is moved to `v1.1` (or retired
with a note). AIC totals and empty matches are reported honestly. Each
upstream has a fixture-backed contract test plus one dated live probe. Any
remaining legacy routes are either documented or retired.

**Status (17 October 2026): the Met part is done.** The router, the pipeline
library and `sources.py` now ask `/public/collection/v1.1/search` with
`offset=0` and a `limit` of eight candidates per wanted result (capped at the
Met's maximum of 500). Objects still come from `/v1/objects`.
`tests/e2e-met-search.mjs` holds that contract with fixtures; it fails on the
old code. A live probe the same night returned `total: 1756` for "love" with
no error.

**Still open:**
- Met result quality: for "love", 15 of the first 16 v1.1 candidates had no
  public image (mostly Costume Institute dresses), so `limit=2` returned one
  work. A wider or concurrent candidate scan would help.
- The AIC totals.
- The route inventory.

**Status (18 October 2026): rebuilt on branch `api/restructure`, not deployed
yet.** See `docs/api-architecture.md` for the design and Yu's five decisions.
- Route inventory: done. `/api` is generated from the route table and lists
  all 178 GET and POST routes (`route_coverage.status: "complete"`); the 33
  that were missing, including the lore routes, are listed.
- AIC totals: done. Zero-score works are dropped, and the collection-wide
  total is reported as `total_reported` with `total: null`; every source says
  whether its total is exact.
- Met: candidates are now read four at a time within a 6-second budget, and
  objects are cached for a week per location.
- Each upstream has a fixture-backed contract test (`e2e-search-sources`,
  `e2e-met-search`, `e2e-guests`). A dated live probe of each upstream is not
  written yet; `/api/sources` reports what each edge isolate has seen.
- The cycle's own AIC search in `sources.py` is unchanged (item 6).

