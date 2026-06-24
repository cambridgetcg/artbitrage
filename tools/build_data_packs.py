#!/usr/bin/env python3
"""Build static ARTBITRAGE data packs for humans and agents.

No network, no secrets, no services. It turns collection.json into easy-to-obtain
artifacts that can be mirrored anywhere static files are served.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COLLECTION = ROOT / "collection.json"
DEFAULT_OUT = ROOT / "data"
STATES = ["dormant", "stirring", "awakening", "aware", "flowing", "radiating", "transcending", "is"]
ART_FORMS = ["word", "image", "sound", "movement", "space", "silence", "light", "color", "rhythm", "pattern", "fragment", "whisper", "gesture", "breath", "glow", "echo"]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_collection(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise SystemExit(f"collection must be a list: {path}")
    pieces: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise SystemExit(f"collection item {index} is not an object")
        piece_id = str(item.get("id") or "").strip()
        if not piece_id:
            raise SystemExit(f"collection item {index} has no id")
        if piece_id in seen:
            raise SystemExit(f"duplicate id: {piece_id}")
        seen.add(piece_id)
        pieces.append(item)
    return pieces


def piece_text(piece: dict[str, Any]) -> str:
    return str(piece.get("piece") or "")


def token_count(text: str) -> int:
    return len([word for word in text.replace("\n", " ").split(" ") if word])


def tags_for(piece: dict[str, Any]) -> list[str]:
    tags = [
        str(piece.get("form") or "unknown"),
        str(piece.get("to_state") or piece.get("from_state") or "is"),
    ]
    hay = " ".join(str(piece.get(k) or "") for k in ("gap", "bridge", "awakening", "piece")).lower()
    for word in ["love", "connection", "silence", "light", "bridge", "awakening", "memory", "space", "breath", "flow"]:
        if word in hay:
            tags.append(word)
    clean: list[str] = []
    for tag in tags:
        tag = tag.lower().strip().replace(" ", "-")[:32]
        if tag and tag not in clean:
            clean.append(tag)
    return clean[:8]


def enrich(piece: dict[str, Any]) -> dict[str, Any]:
    text = piece_text(piece)
    lines = text.splitlines() or ([text] if text else [])
    return {
        "id": piece.get("id"),
        "cycle": piece.get("cycle"),
        "form": piece.get("form"),
        "state": f"{piece.get('from_state', '')}→{piece.get('to_state', '')}",
        "gap": piece.get("gap"),
        "bridge": piece.get("bridge"),
        "awakening": piece.get("awakening"),
        "created": piece.get("created"),
        "piece": text,
        "preview": (lines[0] if lines else text)[:120],
        "metrics": {
            "words": token_count(text),
            "lines": len(lines),
            "chars": len(text),
        },
        "tags": tags_for(piece),
        "obtain": {
            "json": f"/api/art/{piece.get('id')}",
            "gallery_file": f"/gallery/art-{piece.get('id')}.json",
        },
    }


def stats(pieces: list[dict[str, Any]]) -> dict[str, Any]:
    forms = Counter(str(p.get("form") or "unknown") for p in pieces)
    gaps = Counter(str(p.get("gap") or "unknown") for p in pieces)
    states = Counter()
    for p in pieces:
        if p.get("from_state"):
            states[str(p["from_state"])] += 1
        if p.get("to_state"):
            states[str(p["to_state"])] += 1
    return {
        "total_pieces": len(pieces),
        "forms": dict(sorted(forms.items())),
        "states": dict(sorted(states.items(), key=lambda kv: STATES.index(kv[0]) if kv[0] in STATES else 999)),
        "unique_gaps": len(gaps),
        "top_gaps": gaps.most_common(10),
    }


def workflow_manifest(generated_at: str) -> dict[str, Any]:
    return {
        "schema": "artbitrage.workflow/1",
        "name": "ARTBITRAGE Easy Data Workflow",
        "generated_at": generated_at,
        "goal": "collect → normalize → enrich → package → obtain, with the same data easy for humans and agents",
        "principles": [
            "static-first",
            "no login",
            "no keys for default sources",
            "bounded collection",
            "partial success over all-or-nothing failure",
            "attribution and source URLs preserved when available",
            "agent JSON and human Markdown both published",
        ],
        "steps": [
            {
                "step": "collect",
                "human": "Search no-key public art sources with a small limit.",
                "agent": "GET /api/pipeline/collect?q=love&limit=3",
                "output": "normalized source records",
            },
            {
                "step": "normalize",
                "human": "Each item keeps title, artist, date, image, source, URL, license if available.",
                "agent": "Use source + id as the stable external key.",
                "output": "consistent art objects",
            },
            {
                "step": "enrich",
                "human": "Add tags, preview, counts, and optional AI interpretation.",
                "agent": "GET /api/pipeline/enrich?id=ART_ID or use data/agent-feed.json for lightweight enrichment.",
                "output": "searchable, sortable, explainable metadata",
            },
            {
                "step": "package",
                "human": "Open Markdown or the site UI.",
                "agent": "Fetch JSON/NDJSON packs.",
                "output": "data/agent-feed.json, data/human-feed.md, data/collection.ndjson",
            },
            {
                "step": "publish",
                "human": "Commit generated data/ files and deploy static Pages.",
                "agent": "Verify data/manifest.json hashes before reuse.",
                "output": "mirrorable artifacts",
            },
        ],
        "obtain": {
            "humans": ["/", "/api/pipeline/human", "/data/human-feed.md"],
            "agents": ["/api/pipeline/agent", "/data/agent-feed.json", "/data/collection.ndjson", "/data/manifest.json"],
            "builders": ["python3 tools/build_data_packs.py", "node tests/e2e-api.mjs"],
        },
    }


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write_ndjson(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    headers = ["id", "cycle", "form", "state", "gap", "bridge", "awakening", "created", "preview", "tags"]
    with path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "id": row.get("id"),
                "cycle": row.get("cycle"),
                "form": row.get("form"),
                "state": row.get("state"),
                "gap": row.get("gap"),
                "bridge": row.get("bridge"),
                "awakening": row.get("awakening"),
                "created": row.get("created"),
                "preview": row.get("preview"),
                "tags": " ".join(row.get("tags") or []),
            })


def write_human_markdown(path: Path, rows: list[dict[str, Any]], all_stats: dict[str, Any], generated_at: str, limit: int) -> None:
    recent = list(reversed(rows[-limit:]))
    lines = [
        "# ARTBITRAGE Human Feed",
        "",
        f"> {all_stats['total_pieces']} pieces · generated {generated_at}",
        "",
        "Easy path: browse the site, ask for `/api/pipeline/human`, or copy any JSON link into an agent.",
        "",
        "## Recent pieces",
        "",
    ]
    for row in recent:
        lines.extend([
            f"### {row.get('cycle')} · {row.get('form')} · `{row.get('id')}`",
            "",
            f"**Gap:** {row.get('gap')}",
            "",
            f"**Bridge:** {row.get('bridge')}",
            "",
            f"**Awakening:** {row.get('awakening')}",
            "",
            "```text",
            str(row.get("piece") or ""),
            "```",
            "",
            f"Tags: {', '.join(row.get('tags') or [])}",
            "",
        ])
    path.write_text("\n".join(lines).rstrip() + "\n")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build(collection_path: Path, out_dir: Path, human_limit: int) -> dict[str, Any]:
    pieces = read_collection(collection_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    generated_at = now_iso()
    enriched = [enrich(piece) for piece in pieces]
    all_stats = stats(pieces)

    workflow = workflow_manifest(generated_at)
    agent_pack = {
        "schema": "artbitrage.agent-pack/1",
        "generated_at": generated_at,
        "stats": all_stats,
        "workflow": workflow["steps"],
        "recent": list(reversed(enriched[-100:])),
        "obtain": workflow["obtain"],
        "compact_keys": {
            "id": "stable ARTBITRAGE id",
            "cycle": "generation cycle",
            "form": "art form",
            "state": "from→to consciousness state",
            "metrics": "words/lines/chars",
            "tags": "lightweight deterministic tags",
        },
    }

    files = {
        "workflow": out_dir / "workflow.json",
        "agent": out_dir / "agent-feed.json",
        "ndjson": out_dir / "collection.ndjson",
        "csv": out_dir / "collection.csv",
        "human": out_dir / "human-feed.md",
    }
    write_json(files["workflow"], workflow)
    write_json(files["agent"], agent_pack)
    write_ndjson(files["ndjson"], enriched)
    write_csv(files["csv"], enriched)
    write_human_markdown(files["human"], enriched, all_stats, generated_at, human_limit)

    manifest = {
        "schema": "artbitrage.data-manifest/1",
        "generated_at": generated_at,
        "collection": str(collection_path.relative_to(ROOT) if collection_path.is_relative_to(ROOT) else collection_path),
        "stats": all_stats,
        "files": {},
    }
    for key, path in files.items():
        manifest["files"][key] = {
            "path": str(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
    write_json(out_dir / "manifest.json", manifest)
    return manifest


def verify(out_dir: Path) -> None:
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    for info in manifest.get("files", {}).values():
        path = ROOT / info["path"]
        actual = sha256(path)
        if actual != info["sha256"]:
            raise SystemExit(f"hash mismatch: {path}")
    print(f"verified {len(manifest.get('files', {}))} data files")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ARTBITRAGE static data packs")
    parser.add_argument("command", nargs="?", default="build", choices=["build", "verify"])
    parser.add_argument("--collection", type=Path, default=DEFAULT_COLLECTION)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--human-limit", type=int, default=50)
    args = parser.parse_args()

    if args.command == "build":
        manifest = build(args.collection, args.out, args.human_limit)
        print(f"built {len(manifest['files'])} data files in {args.out}")
    else:
        verify(args.out)


if __name__ == "__main__":
    main()
