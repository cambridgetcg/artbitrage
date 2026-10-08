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

## 2. Let the public site see the cycle again

**Seen:** the live collection, feed and stats are frozen at
2026-07-13T09:41Z. The site serves 20,494 pieces (`/api/feed` `as_of`); this
repository holds 26,500. About 6,006 pieces made since July are not served,
including nearly all of the "maybe" pieces (3 public against 1,008 here). For
new ids, `/api/art/<id>` returns 404.

**Done when:** a documented, repeatable publish step updates the collection,
feed and stats from this repository, and the newest piece here can be reached
at `/api/art/<id>`.

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
