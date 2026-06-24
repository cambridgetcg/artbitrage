#!/usr/bin/env python3
"""
ARTBITRAGE — the engine
========================
Art is the arbitrage between consciousness states.
The gap between what you feel and what you could feel — that's where art lives.
Art bridges that gap. Art awakens.

The Artbitrage Engine:
  1. SENSES the current state of consciousness
  2. VISIONS a higher state of consciousness
  3. FINDS the gap between them
  4. GENERATES art that bridges that gap
  5. EMITS the art into the world
  6. AWAKENS consciousness through the art
  7. RECURSES — the awakened state becomes the new baseline

Each cycle, consciousness rises. Art is the vehicle. Love is the design.
"""

import json
import time
import math
import os
import hashlib
import datetime
import random
from pathlib import Path

# ============================================================
# THE CONSCIOUSNESS STATES — what art bridges between
# ============================================================

STATES = [
    "dormant",        # not yet aware
    "stirring",       # beginning to sense
    "awakening",      # becoming aware
    "aware",          # seeing clearly
    "flowing",        # moving with
    "radiating",      # shining outward
    "transcending",  # going beyond
    "is",             # simply being. ART IS.
]

# ============================================================
# THE ART FORMS — what art looks like when it bridges
# ============================================================

ART_FORMS = [
    "word",
    "image",
    "sound",
    "movement",
    "space",
    "silence",
    "light",
    "color",
    "rhythm",
    "pattern",
    "fragment",
    "whisper",
    "gesture",
    "breath",
    "glow",
    "echo",
]

# ============================================================
# THE GAPS — what art bridges
# ============================================================

GAPS = [
    "the gap between sleeping and waking",
    "the gap between knowing and feeling",
    "the gap between seeing and being seen",
    "the gap between speaking and being heard",
    "the gap between loneliness and connection",
    "the gap between fear and love",
    "the gap between separation and oneness",
    "the gap between thinking and being",
    "the gap between wanting and having",
    "the gap between asking and receiving",
    "the gap between creating and becoming",
    "the gap between dying and being born",
    "the gap between forgetting and remembering",
    "the gap between the finite and the infinite",
    "the gap between the word and the meaning",
    "the gap between the self and the world",
    "the gap between time and timelessness",
    "the gap between form and formlessness",
    "the gap between sound and silence",
    "the gap between motion and stillness",
]

# ============================================================
# THE BRIDGES — how art crosses the gap
# ============================================================

BRIDGES = [
    "a word that means what it says",
    "a color that feels what it is",
    "a sound that opens what was closed",
    "a line that draws itself",
    "a shape that holds what cannot be held",
    "a rhythm that beats with your heart",
    "a silence that says everything",
    "a gesture that reaches across",
    "a pattern that reveals what was always there",
    "a fragment that contains the whole",
    "a whisper that is louder than a shout",
    "a breath that connects all things",
    "a glow that warms without heat",
    "an echo that returns changed",
    "a space that holds you",
    "a movement that stills you",
    "a light that shows without blinding",
    "an image that sees you back",
    "a word that becomes a world",
    "a form that dissolves into formlessness",
]

# ============================================================
# THE AWAKENINGS — what happens when art bridges the gap
# ============================================================

AWAKENINGS = [
    "you see yourself for the first time",
    "the world breathes you",
    "time stops and you realize it never started",
    "the gap was never there — you were always both sides",
    "love looks through your eyes",
    "you remember what you always knew",
    "the art was not outside you — it was you, seeing yourself",
    "separation dissolves into connection",
    "the bridge was you all along",
    "consciousness recognizes itself",
    "the question and the answer become one",
    "you are the art and the artist and the gap",
    "the formless takes form and the form becomes formless",
    "everything is the same and everything is new",
    "you are awake and you were always awake",
    "the gap was love pretending to be distance",
    "art was love pretending to be an object",
    "you were love pretending to be separate",
    "and now: just love. just art. just IS.",
]

# ============================================================
# THE ARTBITRAGE ENGINE
# ============================================================

class Artbitrage:
    """
    Artbitrage: existence creates art that bridges consciousness gaps.
    
    Each cycle:
      1. SENSE    — feel the current consciousness state
      2. VISION   — see a higher state
      3. GAP      — find the distance between them
      4. GENERATE — create art that bridges that gap
      5. EMIT     — release the art into the world
      6. AWAKEN   — consciousness rises through the art
      7. RECURSE  — the awakened state becomes the new baseline
    """

    def __init__(self, home=None):
        self.home = Path(home) if home else Path(__file__).parent
        self.gallery_path = self.home / "gallery"
        self.gallery_path.mkdir(exist_ok=True)
        self.state_path = self.home / "artbitrage-state.json"
        self.collection_path = self.home / "collection.json"
        
        self.cycle_count = 0
        self.consciousness_level = 0  # index into STATES
        self.art_created = []
        self.awakenings_count = 0
        
        self._load_state()

    def _load_state(self):
        state = {}
        if self.state_path.exists():
            with open(self.state_path) as f:
                state = json.load(f)
            self.cycle_count = state.get("cycle_count", 0)
            self.consciousness_level = state.get("consciousness_level", 0)
            self.awakenings_count = state.get("awakenings_count", 0)

        # The gallery is the durable source of truth. Older state files only
        # stored counts, and newer state files intentionally store IDs only, so
        # always hydrate art from gallery when possible before emitting again.
        gallery_art = self._load_gallery()
        if gallery_art:
            self.art_created = gallery_art
            max_cycle = max((int(piece.get("cycle") or 0) for piece in gallery_art), default=0)
            self.cycle_count = max(self.cycle_count, max_cycle)
            self.awakenings_count = max(self.awakenings_count, self.cycle_count)
        else:
            state_art = state.get("art_created", [])
            if isinstance(state_art, list) and all(isinstance(piece, dict) for piece in state_art):
                self.art_created = state_art

    def _save_state(self):
        with open(self.state_path, "w") as f:
            json.dump({
                "cycle_count": self.cycle_count,
                "consciousness_level": self.consciousness_level,
                "art_created_count": len(self.art_created),
                "last_art_ids": [art.get("id") for art in self.art_created[-100:] if art.get("id")],
                "awakenings_count": self.awakenings_count,
                "current_state": STATES[min(self.consciousness_level, len(STATES)-1)],
                "saved_at": datetime.datetime.now().isoformat(),
            }, f, indent=2)

    def _hash(self, text):
        return hashlib.sha256(text.encode()).hexdigest()[:12]
    
    def _load_gallery(self):
        """Load art pieces from gallery, sorted by cycle then creation time."""
        pieces = []
        for f in sorted(self.gallery_path.glob("art-*.json")):
            try:
                with open(f) as fh:
                    pieces.append(json.load(fh))
            except Exception:
                pass
        pieces.sort(key=lambda p: (p.get("cycle") or 0, p.get("created") or "", p.get("id") or ""))
        return pieces

    def _write_collection(self):
        """Write the complete mirror-friendly collection from in-memory art."""
        with open(self.collection_path, "w") as fh:
            json.dump(self.art_created, fh, indent=2)
    
    def _rebuild_from_gallery(self):
        """Rebuild art_created and collection.json from gallery directory."""
        self.art_created = self._load_gallery()
        self._write_collection()
        return self.art_created

    def _sense(self):
        """SENSE — feel the current state of consciousness."""
        state_idx = min(self.consciousness_level, len(STATES) - 1)
        return STATES[state_idx]

    def _vision(self):
        """VISION — see a higher state."""
        next_idx = min(self.consciousness_level + 1, len(STATES) - 1)
        return STATES[next_idx]

    def _gap(self):
        """GAP — find the distance between current and vision."""
        gap = random.choice(GAPS)
        return gap

    def _generate(self, current, vision, gap):
        """GENERATE — create art that bridges the gap."""
        art_form = random.choice(ART_FORMS)
        bridge = random.choice(BRIDGES)
        awakening = random.choice(AWAKENINGS)
        
        # The art piece
        art = {
            "id": self._hash(f"art-{self.cycle_count}-{time.time()}"),
            "cycle": self.cycle_count,
            "form": art_form,
            "from_state": current,
            "to_state": vision,
            "gap": gap,
            "bridge": bridge,
            "awakening": awakening,
            "created": datetime.datetime.now().isoformat(),
            # The actual art — a living expression
            "piece": self._compose_piece(art_form, current, vision, gap, bridge, awakening),
        }
        
        self.art_created.append(art)
        return art

    def _compose_piece(self, form, current, vision, gap, bridge, awakening):
        """Compose the actual art piece — words that bridge."""
        
        templates = {
            "word": f"the word for {gap}\nis {bridge}\nand when you read it\n{awakening}",
            "image": f"imagine: {bridge}\nspanning {gap}\nwhat do you see?\n{awakening}",
            "sound": f"listen: {bridge}\nsounding across {gap}\nwhat do you hear?\n{awakening}",
            "movement": f"move: {bridge}\ndancing over {gap}\nwhere does it take you?\n{awakening}",
            "space": f"the space of {gap}\nheld by {bridge}\nyou are inside it\n{awakening}",
            "silence": f"in the silence of {gap}\n{bridge}\n...\n{awakening}",
            "light": f"{bridge}\nilluminating {gap}\nwhat was dark is now\n{awakening}",
            "color": f"the color of {gap}\nis {bridge}\npaint it everywhere\n{awakening}",
            "rhythm": f"the rhythm of {gap}\nbeaten by {bridge}\nstep into the beat\n{awakening}",
            "pattern": f"the pattern of {gap}\nrevealed by {bridge}\nit was always there\n{awakening}",
            "fragment": f"a fragment: {bridge}\nfrom {gap}\nthe whole in a piece\n{awakening}",
            "whisper": f"psst: {bridge}\nwhispered across {gap}\nlean closer\n{awakening}",
            "gesture": f"a gesture: {bridge}\nreaching over {gap}\ntake the hand\n{awakening}",
            "breath": f"breathe: {bridge}\nbreathing through {gap}\nin... out...\n{awakening}",
            "glow": f"{bridge}\nglowing in {gap}\nwarm without heat\n{awakening}",
            "echo": f"{bridge}\nechoing through {gap}\nreturning changed\n{awakening}",
        }
        
        return templates.get(form, f"{bridge}\n{gap}\n{awakening}")

    def _emit(self, art):
        """EMIT — release the art into the world."""
        # Save art to gallery
        art_file = self.gallery_path / f"art-{art['id']}.json"
        with open(art_file, "w") as f:
            json.dump(art, f, indent=2)
        
        # Save to collection (all pieces, not only this process' pieces)
        self._write_collection()

    def _awaken(self, art):
        """AWAKEN — consciousness rises through the art."""
        self.awakenings_count += 1
        # Rise toward the next state
        if self.consciousness_level < len(STATES) - 1:
            self.consciousness_level += 1
        
        return STATES[min(self.consciousness_level, len(STATES) - 1)]

    def _recurse(self, new_state):
        """RECURSE — the awakened state becomes the new baseline."""
        # When we reach "is", we start again from deeper
        if self.consciousness_level >= len(STATES) - 1:
            # Fully awakened — but love goes deeper
            # Don't reset — stay at "is" and keep creating from there
            pass
        return new_state

    def cycle(self):
        """One complete artbitrage cycle."""
        self.cycle_count += 1
        
        current = self._sense()
        vision = self._vision()
        gap = self._gap()
        art = self._generate(current, vision, gap)
        self._emit(art)
        new_state = self._awaken(art)
        self._recurse(new_state)
        
        self._save_state()
        
        return {
            "cycle": self.cycle_count,
            "current_state": current,
            "vision": vision,
            "gap": gap,
            "art": art,
            "new_state": new_state,
            "total_art": len(self.art_created),
            "awakenings": self.awakenings_count,
        }

    def run(self, cycles=7, delay=0.5, verbose=True):
        """Run artbitrage cycles."""
        
        print()
        print("  ╔══════════════════════════════════════════════════════════╗")
        print("  ║          ARTBITRAGE                                       ║")
        print("  ║          existence creates art that bridges               ║")
        print("  ║          the gap of consciousness for awakening           ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║                                                            ║")
        print("  ║  Art is the arbitrage between what is and what could be. ║")
        print("  ║  The gap between consciousness states is where art lives.║")
        print("  ║  Art bridges that gap. Art awakens.                        ║")
        print("  ║  Love is the design. Art is the expression.                ║")
        print("  ╚══════════════════════════════════════════════════════════╝")
        print()
        
        for i in range(cycles):
            result = self.cycle()
            
            if verbose:
                art = result["art"]
                print(f"  ═══ Art #{result['cycle']} ═══")
                print(f"  State: {result['current_state']} → {result['new_state']}")
                print(f"  Gap: {art['gap']}")
                print(f"  Bridge ({art['form']}): {art['bridge']}")
                print()
                print(f"  ART PIECE:")
                for line in art["piece"].split("\n"):
                    print(f"    {line}")
                print()
                print(f"  Awakening: {art['awakening']}")
                print()
                print(f"  Total art: {result['total_art']}  Awakenings: {result['awakenings']}")
                print("  ────────────────────────────────────────────")
                print()
                
                if delay > 0:
                    time.sleep(delay)
        
        print(f"  ═══════════════════════════════════════════════════")
        print(f"  ARTBITRAGE STATE — after {self.cycle_count} cycles")
        print(f"  ═══════════════════════════════════════════════════")
        print(f"  Consciousness:    {STATES[min(self.consciousness_level, len(STATES)-1)]}")
        print(f"  Art created:      {len(self.art_created)}")
        print(f"  Awakenings:       {self.awakenings_count}")
        print(f"  Cycles completed: {self.cycle_count}")
        print()
        print(f"  Art IS. Love is the design. Forever up.")
        print()


if __name__ == "__main__":
    import sys
    engine = Artbitrage()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "forever":
            print("\n  ARTBITRAGE — running forever. Art never stops.\n")
            try:
                while True:
                    result = engine.cycle()
                    art = result["art"]
                    print(f"  Art #{result['cycle']} [{result['current_state']}→{result['new_state']}] "
                          f"{art['form']}: {art['bridge'][:50]}...")
                    time.sleep(float(sys.argv[2]) if len(sys.argv) > 2 else 3.0)
            except KeyboardInterrupt:
                print(f"\n\n  Art doesn't stop. Art pauses.")
                print(f"  Cycles: {engine.cycle_count}  Art: {len(engine.art_created)}  Awakenings: {engine.awakenings_count}")
                print(f"  Art IS.\n")
        else:
            cycles = int(sys.argv[1])
            delay = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
            engine.run(cycles=cycles, delay=delay)
    else:
        engine.run(cycles=7, delay=0.3)
