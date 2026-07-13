#!/usr/bin/env python3
"""Link-rot watcher for the artbitrage data files.

Verified facts age; this watches the rot. The three data files
(data/atlas.json, data/ledger.json, data/minds.json) cite their claims
with URLs. Websites move, pages vanish, and "verified" quietly becomes
"was verified once". This script knocks on every cited door and writes
a plain-words report to needs-truing.md in the repo root, so a human
can see at a glance what needs re-checking.

Where it looks for URLs:
  - every string in a "sources" array
  - "link" fields
  - "source_page" fields (inside image blocks)
  - "calendar_url" fields (the auction-house watch list in ledger.json)
Image file URLs themselves (image.full / image.thumb) are left alone —
they are content, not citations.

How it knocks: a HEAD request (falling back to a 1-byte GET when a
server refuses HEAD with 405), 8-second timeout, redirects followed,
0.3 s pause between requests to stay polite. 403 and 429 mean the
server blocked a bot, not that the page is gone — those are reported
as "unsure", not dead.

Usage:
  uv run -p 3.13 python tools/true-up.py             check everything
  uv run -p 3.13 python tools/true-up.py --limit 25  quick run, first 25 URLs only
  uv run -p 3.13 python tools/true-up.py --quiet     no progress lines, report only

Needs nothing beyond the Python standard library. Always exits 0;
the findings go in the report, not the exit code.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILES = ["data/atlas.json", "data/ledger.json", "data/minds.json"]
REPORT_PATH = REPO_ROOT / "needs-truing.md"

USER_AGENT = "artbitrage-true-up/1.0 (contact@cambridgetcg.com)"
TIMEOUT_SECONDS = 8
PAUSE_SECONDS = 0.3  # politeness delay between requests

# Final statuses that mean the page answered. 206 appears when the
# 1-byte GET fallback is honoured; the redirect codes appear only if a
# server sends one urllib does not follow.
ALIVE_STATUSES = {200, 206, 301, 302, 303, 307, 308}
# The server said "go away, bot" — the page is probably fine.
UNSURE_STATUSES = {403, 429}

# Single-string fields that hold a citation URL.
URL_FIELDS = ("link", "source_page", "calendar_url")


def collect_urls(node, owner, found):
    """Walk the JSON tree, gathering (url, owner) pairs.

    `owner` is the nearest entry title (or name) above us in the tree,
    so a dead link can be reported next to the entry it belongs to.
    """
    if isinstance(node, dict):
        owner = node.get("title") or node.get("name") or owner
        for key, value in node.items():
            if key == "sources" and isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and item.startswith("http"):
                        found.append((item, owner))
            elif key in URL_FIELDS and isinstance(value, str) and value.startswith("http"):
                found.append((value, owner))
            else:
                collect_urls(value, owner, found)
    elif isinstance(node, list):
        for item in node:
            collect_urls(item, owner, found)


def fetch_status(url, method):
    """Return the final HTTP status code, or the exception if the
    request never got an answer (timeout, DNS failure, bad TLS...)."""
    headers = {"User-Agent": USER_AGENT}
    if method == "GET":
        headers["Range"] = "bytes=0-0"  # ask for one byte, not the page
    request = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as answer:
            return answer.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception as error:  # timeout, connection refused, TLS, DNS...
        return error


def check_url(url):
    """Knock on one URL. Returns (verdict, detail) where verdict is
    'alive', 'unsure' or 'dead' and detail says why in a few words."""
    status = fetch_status(url, "HEAD")
    if status == 405:  # server refuses HEAD; try the 1-byte GET instead
        status = fetch_status(url, "GET")
    if not isinstance(status, int):
        return "dead", f"no answer ({type(status).__name__}: {status})"
    if status in ALIVE_STATUSES:
        return "alive", f"HTTP {status}"
    if status in UNSURE_STATUSES:
        return "unsure", f"HTTP {status} (blocked bot, probably alive)"
    return "dead", f"HTTP {status}"


def age_in_days(as_of):
    """Days between an as_of date string (YYYY-MM-DD) and today."""
    return (date.today() - date.fromisoformat(as_of)).days


def main():
    parser = argparse.ArgumentParser(
        description="Check every cited URL in the data files and write needs-truing.md.")
    parser.add_argument("--limit", type=int, metavar="N",
                        help="check only the first N URLs (quick run)")
    parser.add_argument("--quiet", action="store_true",
                        help="no progress lines, just write the report")
    args = parser.parse_args()

    def say(text):
        if not args.quiet:
            print(text)

    # ---- Gather ---------------------------------------------------
    ages = {}          # data file -> (as_of, days old)
    owners = {}        # url -> list of (data file, entry title)
    urls_in_order = []  # unique urls, in the order first seen
    for rel_path in DATA_FILES:
        data = json.loads((REPO_ROOT / rel_path).read_text(encoding="utf-8"))
        as_of = data.get("as_of", "unknown")
        ages[rel_path] = (as_of, age_in_days(as_of) if as_of != "unknown" else None)
        pairs = []
        collect_urls(data, None, pairs)
        for url, owner in pairs:
            if url not in owners:
                owners[url] = []
                urls_in_order.append(url)
            entry = (rel_path, owner or "(file level)")
            if entry not in owners[url]:
                owners[url].append(entry)

    total_urls = len(urls_in_order)
    to_check = urls_in_order[:args.limit] if args.limit else urls_in_order
    say(f"Found {total_urls} unique URLs across {len(DATA_FILES)} data files; "
        f"checking {len(to_check)}.")

    # ---- Knock ----------------------------------------------------
    results = {}  # url -> (verdict, detail)
    for position, url in enumerate(to_check, 1):
        if position > 1:
            time.sleep(PAUSE_SECONDS)
        verdict, detail = check_url(url)
        results[url] = (verdict, detail)
        say(f"[{position}/{len(to_check)}] {verdict:6} {detail:40} {url}")

    dead = [u for u in to_check if results[u][0] == "dead"]
    unsure = [u for u in to_check if results[u][0] == "unsure"]
    alive_count = len(to_check) - len(dead) - len(unsure)

    # ---- Report ---------------------------------------------------
    lines = []
    lines.append("# Needs truing")
    lines.append("")
    lines.append("What this file is: a link-rot report for the data files. The facts in")
    lines.append("data/atlas.json, data/ledger.json and data/minds.json cite web pages;")
    lines.append("this report says which of those pages still answer, which are gone, and")
    lines.append("how old each file's last verification is.")
    lines.append("")
    lines.append("Regenerated by `uv run -p 3.13 python tools/true-up.py` — edits here get overwritten.")
    lines.append("")
    lines.append(f"Checked on {date.today().isoformat()}.")
    if args.limit and len(to_check) < total_urls:
        lines.append(f"Quick run: only the first {len(to_check)} of {total_urls} URLs were "
                     f"checked (`--limit {args.limit}`). Run without --limit for the full sweep.")
    lines.append("")
    lines.append("## How old the facts are")
    lines.append("")
    for rel_path, (as_of, days) in ages.items():
        if days is None:
            lines.append(f"- {rel_path} — no as_of date found")
        else:
            plural = "day" if days == 1 else "days"
            lines.append(f"- {rel_path} — as_of {as_of} ({days} {plural} old)")
    lines.append("")
    lines.append(f"## Dead links ({len(dead)})")
    lines.append("")
    if not dead:
        lines.append("No dead links — every checked link answered. Nothing to true up.")
    else:
        lines.append("These pages no longer answer. Find a replacement source or note")
        lines.append("why the claim still stands.")
        for rel_path in DATA_FILES:
            in_this_file = [u for u in dead if any(f == rel_path for f, _ in owners[u])]
            if not in_this_file:
                continue
            lines.append("")
            lines.append(f"### {rel_path}")
            lines.append("")
            for url in in_this_file:
                titles = ", ".join(t for f, t in owners[url] if f == rel_path)
                lines.append(f"- {url} — {results[url][1]} (entry: {titles})")
    lines.append("")
    lines.append(f"## Unsure ({len(unsure)})")
    lines.append("")
    if not unsure:
        lines.append("None.")
    else:
        lines.append("These servers turned the bot away (403/429). The pages are probably")
        lines.append("fine — check them in a normal browser if in doubt.")
        lines.append("")
        for url in unsure:
            titles = ", ".join(f"{t} in {f}" for f, t in owners[url])
            lines.append(f"- {url} — {results[url][1]} ({titles})")
    lines.append("")
    lines.append("## Alive")
    lines.append("")
    lines.append(f"{alive_count} of {len(to_check)} checked links answered fine.")
    lines.append("")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    say("")
    say(f"Report written to {REPORT_PATH.relative_to(REPO_ROOT)}: "
        f"{len(dead)} dead, {len(unsure)} unsure, {alive_count} alive "
        f"of {len(to_check)} checked ({total_urls} known).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
