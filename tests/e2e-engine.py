#!/usr/bin/env python3
"""E2E checks for Artbitrage's local-first gallery/collection persistence."""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from artbitrage import Artbitrage


def write_piece(home, piece_id, cycle):
    gallery = home / "gallery"
    gallery.mkdir(exist_ok=True)
    piece = {
        "id": piece_id,
        "cycle": cycle,
        "form": "word",
        "from_state": "is",
        "to_state": "is",
        "gap": "the gap between test and trust",
        "bridge": "a check that survives restart",
        "awakening": "the catalogue remembers",
        "created": f"2026-06-24T00:00:0{cycle}",
        "piece": f"test piece {piece_id}",
    }
    (gallery / f"art-{piece_id}.json").write_text(json.dumps(piece, indent=2))
    return piece


with tempfile.TemporaryDirectory() as tmp:
    home = Path(tmp)
    write_piece(home, "aaa", 1)
    write_piece(home, "bbb", 2)
    (home / "artbitrage-state.json").write_text(json.dumps({
        "cycle_count": 2,
        "consciousness_level": 7,
        "art_created_count": 2,
        "awakenings_count": 2,
        "current_state": "is",
    }))

    engine = Artbitrage(home=home)
    assert len(engine.art_created) == 2
    assert [piece["id"] for piece in engine.art_created] == ["aaa", "bbb"]

    result = engine.cycle()
    assert result["cycle"] == 3

    collection = json.loads((home / "collection.json").read_text())
    assert len(collection) == 3
    assert [piece["id"] for piece in collection[:2]] == ["aaa", "bbb"]

    state = json.loads((home / "artbitrage-state.json").read_text())
    assert state["art_created_count"] == 3
    assert "art_created" not in state
    assert len(state["last_art_ids"]) == 3

print("artbitrage engine e2e passed")
