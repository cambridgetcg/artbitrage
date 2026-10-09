#!/usr/bin/env python3
"""gen_card.py: THROUGH THE DOOR. One 1200x630 Open Graph card (JPEG <= 200 KB) per artbitrage.io room.

    python3 tools/brand/gen_card.py tools/brand/rooms.json --all          # every room -> assets/og/ + dist/assets/og/
    python3 tools/brand/gen_card.py tools/brand/rooms.json --slug trip    # one room, same place
    python3 tools/brand/gen_card.py tools/brand/rooms.json --all --out /tmp/og   # somewhere else (no dist mirror)
    python3 tools/brand/gen_card.py one-room.json --out /tmp/og           # a single spec (a JSON object)

The card is a view through a doorway. You stand in the room: its wall colour is the
card. To the right an arched door (the 閒 door's head: a full semicircle on the
opening's width) stands open onto the next room, and the room's key work hangs
there whole, at its own aspect, never cropped or recoloured, mounted the way that
room's own CSS mounts it (a frame, a mat, or bare with a shadow). The door is sized
to the work and never touches it. The room's glyph, its eyebrow and its name (with
the italic accent word its h1 uses), the museum record (title · maker · date ·
museum · licence) and the "a | ARTBITRAGE" signature are set in Iowan Old Style,
Avenir Next and Songti TC. A room with no key work gets a typographic card: its
glyph (or a line cited from the site) is lettered on the far wall instead, and its
name is set larger.

Pipeline (python3 stdlib only; every pixel is made by ArtCraft):
  1. VectorCraft measures the type (the app is the ruler: area type -> point type,
     line breaks read back from document.inspect). CJK is broken only after 。，！？、；：.
  2. VectorCraft composes three layers, ground (the wall, the door, the next room,
     the far-wall lettering), mount (the room's frame or mat, or a backing exactly
     under the work) and type, saves card.vectorcraft and exports each layer alone.
  3. PhotoCraft downscales the work once (Lanczos, never above 100%) to integer
     pixels, keeping its aspect.
  4. PhotoCraft opens the ground, grains it, places the mount with its drop shadow
     (a layer style: drawn behind the mount), places the work at 100% on integer
     pixels (file.placeEmbedded) with no style at all, places the type, flattens it
     and writes master.png.
  5. The work's pixels in master.png are checked against the downscaled work. They
     must be identical, or the card fails. Then a JPEG of 200 KB or less is written,
     stepping quality down from 92.

Rebuilding with the same tool versions (vectorcraft-cli 0.7.0, photocraft-cli 0.5.0)
and the same macOS fonts gives byte-identical JPEGs. A full --all run also writes
credits.json beside the cards: what each card shows, where its record comes from,
and how it was made.
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent                       # tools/brand
ROOT = HERE.parents[1]                                      # the repo
sys.path.insert(0, str(HERE))
import pngread                                              # noqa: E402  (stdlib PNG reader for the check)

VC = shutil.which("vectorcraft-cli") or os.path.expanduser("~/.local/bin/vectorcraft-cli")
PC = shutil.which("photocraft-cli") or os.path.expanduser("~/.local/bin/photocraft-cli")
SITE = "https://artbitrage.io"
OG_DIR = "assets/og"

W, H = 1200, 630
JPEG_LIMIT = 200 * 1024
JPEG_START_Q = 92

# ── the room and the door ───────────────────────────────────────────────
FLOOR = 600            # this room's floor line: the threshold
FAR_FLOOR = 566        # where the next room's far wall meets its floor
DOOR_CX = 866          # the door's axis (fixed, so every card hangs its door in the same place)
APEX = 22              # the top of the arch (its casing stands 13 px above)
MX = 28                # air between the work (with its mount) and the jambs
CLEAR = 16             # the least air between the work and the arch
BELOW = 20             # far wall left showing under the work
REVEAL = 12            # the wall's thickness, seen on the left jamb and soffit
CASING = 13            # the hairline casing stands this far outside the opening
DOOR_SPARE = 1.7       # a portrait work may widen its door to this many times its width (the head rises with it)
DOOR_MIN, DOOR_MAX = 372, 600
TYPO_DOOR = 404        # door width on a card with no work
ART_MAX_W, ART_MAX_H = 620, 520
ART_MIN_W = 40         # a tall hanging scroll may hang this narrow before the solver gives up

# ── the column ──────────────────────────────────────────────────────────
X = 72
DISPLAY, BODY, CAPS, CJK = "Iowan Old Style", "Iowan Old Style", "Avenir Next", "Songti TC"
CAPS_STYLE = "Medium"
NAME_SIZES = (58, 54, 50, 46, 42)
TYPO_NAME_SIZES = (72, 66, 60, 54, 48)
TITLE_SIZES = (27, 25, 23)
EYEBROW_SIZE, EYEBROW_TRACK = 15, 180
LABEL_SIZE, LABEL_TRACK = 13, 220
CJK_BREAKS = "。，！？、；："

STOP = set("a an the and or nor but of to in on at by for from with into as is are was its your our my this that".split())


def is_cjk(s):
    return any("㐀" <= c <= "鿿" for c in s)


def log(msg):
    print(f"[gen_card] {msg}", file=sys.stderr, flush=True)


def repo_path(p):
    p = Path(p)
    return p if p.is_absolute() else ROOT / p


# ── colour ──────────────────────────────────────────────────────────────
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return hexc([a[i] + (b[i] - a[i]) * t for i in range(3)])


def solid(c, under):
    """'#rrggbbaa' (a CSS colour with alpha) -> the opaque colour it shows over `under`."""
    c = c.strip().lower()
    if len(c) == 9:
        a = int(c[7:9], 16) / 255
        top, bot = rgb(c[:7]), rgb(under)
        return hexc([top[i] * a + bot[i] * (1 - a) for i in range(3)])
    return c


def luma(h):
    r, g, b = [v / 255 for v in rgb(h)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def palette(spec):
    wall, ink, muted, accent = spec["wall"], spec["ink"], spec["muted"], spec["accent"]
    dark = luma(wall) < 0.45
    p = {"dark": dark, "wall": wall, "ink": ink, "muted": muted, "accent": accent}
    if dark:
        warm = lambda c: mix(c, accent, 0.07)          # gallery light is a little warm
        p["next"] = warm(mix(wall, ink, 0.17))
        p["next_top"] = warm(mix(wall, ink, 0.25))
        p["next_low"] = warm(mix(wall, ink, 0.115))
        p["floor2_far"] = mix(p["next_low"], "#000000", 0.18)
        p["floor2_near"] = mix(p["next_low"], "#000000", 0.42)
        p["floor"] = mix(wall, "#000000", 0.28)
        p["reveal"] = mix(wall, ink, 0.085)
        p["casing"] = mix(wall, accent, 0.34)
        p["rule"] = mix(wall, muted, 0.42)
        p["shadow"] = ("#000000", 52)
    else:
        p["next"] = mix(wall, muted, 0.15)
        p["next_top"] = mix(wall, muted, 0.09)
        p["next_low"] = mix(wall, muted, 0.21)
        p["floor2_far"] = mix(wall, muted, 0.30)
        p["floor2_near"] = mix(wall, muted, 0.40)
        p["floor"] = mix(wall, muted, 0.055)
        p["reveal"] = mix(wall, muted, 0.26)
        p["casing"] = mix(wall, accent, 0.42)
        p["rule"] = mix(wall, muted, 0.45)
        p["shadow"] = (mix(muted, "#000000", 0.6), 34)
    p["body"] = mix(wall, ink, 0.86)            # maker · date
    p["faint"] = mix(wall, muted, 0.82)         # museum · licence, address
    return p


# ── image facts (stdlib) ────────────────────────────────────────────────
def jpeg_size(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] != b"\xff\xd8":
        raise ValueError(f"{path} is not a JPEG")
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        m = data[i + 1]
        if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        seg = struct.unpack(">H", data[i + 2:i + 4])[0]
        if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + seg
    raise ValueError(f"no frame header in {path}")


# ── geometry ────────────────────────────────────────────────────────────
def arc(cx, cy, r, a0, a1):
    """Cubic segments for a circular arc, angles in degrees, y down, 0 = east, 90 = north.
    Returns a 'C ...' string continuing from the point at a0."""
    out = []
    n = max(1, int(math.ceil(abs(a1 - a0) / 90.0 - 1e-9)))
    step = (a1 - a0) / n
    for i in range(n):
        t0 = math.radians(a0 + i * step)
        t1 = math.radians(a0 + (i + 1) * step)
        k = 4 / 3 * math.tan((t1 - t0) / 4)
        p0 = (cx + r * math.cos(t0), cy - r * math.sin(t0))
        p3 = (cx + r * math.cos(t1), cy - r * math.sin(t1))
        c1 = (p0[0] - k * r * math.sin(t0), p0[1] - k * r * math.cos(t0))
        c2 = (p3[0] + k * r * math.sin(t1), p3[1] + k * r * math.cos(t1))
        out.append("C%.2f,%.2f %.2f,%.2f %.2f,%.2f" % (c1 + c2 + p3))
    return " ".join(out)


def door_path(cx, ys, r, floor, dx=0.0):
    """The opening: two jambs and a full semicircular head (the 閒 door's head)."""
    x0, x1 = cx - r + dx, cx + r + dx
    return (f"M{x0:.2f},{floor:.2f} L{x0:.2f},{ys:.2f} " + arc(cx + dx, ys, r, 180, 0)
            + f" L{x1:.2f},{floor:.2f} Z")


def visible_path(cx, ys, r, floor, rv):
    """What shows of the next room: the opening less the left reveal. The reveal is the
    opening shifted right by rv; the two heads cross at x = cx + rv/2."""
    yi = ys - math.sqrt(r * r - rv * rv / 4)
    ang_shift = math.degrees(math.atan2(ys - yi, (cx + rv / 2) - (cx + rv)))   # on the shifted circle
    ang_orig = math.degrees(math.atan2(ys - yi, (cx + rv / 2) - cx))           # on the opening's circle
    x0 = cx - r + rv
    x1 = cx + r
    return (f"M{x0:.2f},{floor:.2f} L{x0:.2f},{ys:.2f} " + arc(cx + rv, ys, r, 180, ang_shift)
            + " " + arc(cx, ys, r, ang_orig, 0) + f" L{x1:.2f},{floor:.2f} Z")


def casing_path(cx, ys, r, floor, off):
    x0, x1 = cx - r - off, cx + r + off
    return (f"M{x0:.2f},{floor:.2f} L{x0:.2f},{ys:.2f} " + arc(cx, ys, r + off, 180, 0)
            + f" L{x1:.2f},{floor:.2f}")


def mount_dims(mount):
    """-> (top, right, bottom, left padding, border) in px, from a room's cited mount spec."""
    mount = mount or {}
    pad = mount.get("pad") or 0
    if isinstance(pad, (int, float)):
        pad = [pad] * 4
    pt, pr, pb, pl = [int(v) for v in pad]
    return pt, pr, pb, pl, (1 if mount.get("border") else 0)


def fit_work(nw, nh, mount=None):
    """The largest whole-work size (never above 100%) whose mounted box hangs inside the
    door with CLEAR of air under the arch, MX at the jambs and BELOW above the far floor.
    A tall scroll that cannot keep ART_MAX_H simply hangs narrower (down to ART_MIN_W).
    Returns dict(w, h, x, y [the work], ox, oy, ow, oh [the mounted box], door_w, r, ys)."""
    pt, pr, pb, pl, b = mount_dims(mount)
    aspect = nw / nh
    best = None
    for w in range(min(nw, ART_MAX_W), ART_MIN_W - 1, -1):
        h = round(w / aspect)
        if h < 1 or h > nh or h > ART_MAX_H:
            continue
        ow, oh = w + pl + pr + 2 * b, h + pt + pb + 2 * b
        lo = max(ow + 2 * MX, DOOR_MIN)
        hi = min(DOOR_MAX, max(lo, int(DOOR_SPARE * ow)))
        for dw in range(lo, hi + 1, 2):          # the narrowest door that holds this size
            r = dw / 2
            ys = APEX + r
            dx = ow / 2 + REVEAL / 2             # the box is centred on what shows (the reveal is left)
            if r - CLEAR <= dx:
                continue
            top_limit = ys - math.sqrt((r - CLEAR) ** 2 - dx ** 2)
            bottom_limit = FAR_FLOOR - BELOW
            if bottom_limit - top_limit < oh:
                continue
            slack = (bottom_limit - top_limit) - oh
            top = top_limit + slack * 0.62       # hang a little low: the far wall breathes above
            ox = int(round(DOOR_CX + REVEAL / 2 - ow / 2))
            oy = int(round(top))
            best = {"w": w, "h": h, "ow": ow, "oh": oh, "ox": ox, "oy": oy, "x": ox + b + pl, "y": oy + b + pt,
                    "door_w": dw, "r": r, "ys": ys, "pad": [pt, pr, pb, pl], "border": b}
            break
        if best:
            break
    if best is None:
        raise RuntimeError(f"no size of a {nw}x{nh} work fits the door")
    # integer placement: the mounted box, checked against the opening with real numbers
    x, y, w, h, r, ys = best["ox"], best["oy"], best["ow"], best["oh"], best["r"], best["ys"]
    for (px, py), (ccx, label) in zip(((x, y), (x + w, y)), ((DOOR_CX + REVEAL, "left"), (DOOR_CX, "right"))):
        d = math.hypot(px - ccx, py - ys) if py < ys else abs(px - ccx)
        if d > r - CLEAR + 0.75:
            raise RuntimeError(f"work's top {label} corner is {d - (r - CLEAR):.1f}px into the arch's air")
    if x < DOOR_CX - r + REVEAL + CLEAR - 1 or x + w > DOOR_CX + r - CLEAR + 1 or y + h > FAR_FLOOR - BELOW + 1:
        raise RuntimeError("work leaves the door's air")
    best["scale"] = round(best["w"] / nw, 4)
    best["aspect_error"] = round(abs((best["w"] / best["h"]) - aspect) / aspect, 5)
    return best


# ── VectorCraft driver ──────────────────────────────────────────────────
class VCError(RuntimeError):
    pass


def vc_run(steps, outputs=(), cwd=None, pre=()):
    argv = [VC, "run", *pre]
    for cid, params in steps:
        argv += ["-c", cid]
        if params is not None:
            argv += ["-p", json.dumps(params, ensure_ascii=False)]
    for o in outputs:
        argv += ["-o", str(o)]
    p = subprocess.run(argv, capture_output=True, text=True, cwd=cwd, timeout=180)
    results = []
    for line in p.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    if p.returncode != 0:
        n = len([r for r in results if r.get("step") == "cmd"])
        bad = steps[n][0] if n < len(steps) else "export"
        raise VCError(f"vectorcraft-cli exit {p.returncode} at step {n} ({bad}): {(p.stderr or p.stdout).strip()[-600:]}")
    return results


def cmd_results(results):
    return [r.get("result") for r in results if r.get("step") == "cmd"]


def no_stroke():
    return ("paint.setStroke", {"none": True})


def fill(color):
    return ("paint.setFill", {"color": color})


def stop(offset, color, opacity=1.0):
    return {"offset": offset, "color": color, "opacity": opacity}


def lgrad(stops, start, end):
    return ("paint.setFill", {"gradient": {"kind": "linear", "stops": stops, "start": list(start), "end": list(end)}})


def rgrad(stops, aspect=None):
    g = {"kind": "radial", "stops": stops}
    if aspect:
        g["aspect"] = round(aspect, 2)
    return ("paint.setFill", {"gradient": g})


def blur(r):
    return ("effect.apply", {"effect": "blur.gaussian", "params": {"radius": r}})


def rect(x, y, w, h, color):
    return [("shape.rectangle", {"x": x, "y": y, "width": w, "height": h}), no_stroke(), fill(color)]


def text(x, y, s, size, font, style, color, **st):
    steps = [("text.create", {"x": round(x, 2), "y": round(y, 2), "text": s, "size": size, "font": font,
                              "style": style, "color": color})]
    if st:
        steps.append(("text.setStyle", st))
    return steps


def accent_range(s, word):
    """Byte offsets of the last `word` in s (VectorCraft ranges count UTF-8 bytes), or None."""
    if not word:
        return None
    i = s.rfind(word)
    if i < 0:
        return None
    a = len(s[:i].encode("utf-8"))
    return a, a + len(word.encode("utf-8"))


def face(s, style="Roman"):
    """Route CJK to Songti TC (Iowan has no CJK glyphs); everything else keeps its Latin face."""
    return (CJK, "Regular") if is_cjk(s) else (DISPLAY, style)


def cjk_segments(s):
    """CJK text broken only after its own punctuation: '未必同感，仍可相遇' -> ['未必同感，', '仍可相遇']."""
    out, cur = [], ""
    for ch in s:
        cur += ch
        if ch in CJK_BREAKS:
            out.append(cur)
            cur = ""
    if cur:
        out.append(cur)
    return out


def pack(segments, widths, limit):
    """Greedy: whole segments per line while they fit (a lone over-wide segment keeps its own line).
    -> (lines, the width of each line)"""
    lines, lws, cur, cw = [], [], "", 0.0
    for s, w in zip(segments, widths):
        if cur and cw + w > limit:
            lines.append(cur)
            lws.append(cw)
            cur, cw = "", 0.0
        cur += s
        cw += w
    if cur:
        lines.append(cur)
        lws.append(cw)
    return lines, lws


# ── measuring: the app is the ruler ─────────────────────────────────────
def measure(specs, work):
    """specs: [{text, size, font, style, width?, tracking?, leading?, accent?}] -> [{text, lines, w, h}], fonts.
    A CJK text with a width is never broken by the app: it is measured segment by segment
    and packed at its punctuation."""
    steps = [("file.new", {"width": 4000, "height": 1000, "units": "Pixels", "backgroundContents": "transparent"})]
    plan, area = [], []
    tid = 2
    for sp in specs:
        cjk_wrap = bool(sp.get("width")) and is_cjk(sp["text"])
        pieces = cjk_segments(sp["text"]) if cjk_wrap else [sp["text"]]
        ids = []
        for piece in pieces:
            p = {"x": 10, "y": 200, "text": piece, "size": sp["size"], "font": sp["font"],
                 "style": sp["style"], "color": "#000000"}
            if sp.get("width") and not cjk_wrap:
                p["area"] = {"width": sp["width"], "height": 3000}
                area.append(tid)
            steps.append(("text.create", p))
            st = {k2: sp[k2] for k2 in ("leading", "tracking") if sp.get(k2)}
            if st:
                steps.append(("text.setStyle", st))
            rng = accent_range(piece, sp.get("accent"))
            if rng:
                steps.append(("text.setRangeStyle", {"id": tid, "start": rng[0], "end": rng[1], "style": "Italic"}))
            ids.append(tid)
            tid += 1
        plan.append((sp, pieces, ids, cjk_wrap))
    if area:
        steps.append(("type.convertToPointType", {"ids": area}))
    steps += [("document.inspect", {"depth": 2, "childLimit": 100000}), ("text.fonts", {})]
    cr = cmd_results(vc_run(steps, [], cwd=work))
    got = [r["id"] for (cid, _), r in zip(steps, cr) if cid == "text.create"]
    want = [i for _, _, ids, _ in plan for i in ids]
    if got != want:
        raise VCError(f"measure: text ids drifted (expected {want[:3]}, got {got[:3]})")
    by_id = {}
    for layer in cr[-2]["layers"]:
        for ch in layer.get("children", []):
            by_id[ch.get("id")] = ch
    out = []
    for sp, pieces, ids, cjk_wrap in plan:
        if cjk_wrap:
            ws = [by_id[i]["bounds"]["width"] for i in ids]
            lines, lws = pack(pieces, ws, sp["width"])
            out.append({"text": "\n".join(lines), "lines": lines, "w": max(lws),
                        "h": max(by_id[i]["bounds"]["height"] for i in ids)})
        else:
            ch = by_id[ids[0]]
            t = ch.get("text", "")
            out.append({"text": t, "lines": t.split("\n"), "w": ch["bounds"]["width"], "h": ch["bounds"]["height"]})
    return out, cr[-1]


# ── build ───────────────────────────────────────────────────────────────
def build(spec, work, art):
    p = palette(spec)
    has_work = art is not None
    if has_work:
        r, ys, dw = art["r"], art["ys"], art["door_w"]
    else:
        dw = TYPO_DOOR
        r = dw / 2
        ys = APEX + r
    x0 = DOOR_CX - r
    col_w = int(x0 - CASING - X - 44)

    glyph = (spec.get("glyph") or "").strip()
    eyebrow = (spec.get("eyebrow") or "").upper()
    title = spec.get("title") or ""
    maker_date = " · ".join(s for s in (spec.get("maker"), spec.get("date")) if s)
    src_line = " · ".join(s for s in (spec.get("source"), spec.get("license")) if s)
    address = "artbitrage.io" + ("" if spec["path"] == "/" else spec["path"])
    accent_word = spec.get("accent_word") or ""
    name_font = face(spec["room"])
    title_font = face(title, "Italic")
    name_sizes = NAME_SIZES if has_work else TYPO_NAME_SIZES

    # measure everything in one run
    specs = [dict(text="a", size=50, font=DISPLAY, style="Italic"),
             dict(text="ARTBITRAGE", size=16, font=CAPS, style=CAPS_STYLE, tracking=240),
             dict(text=eyebrow or " ", size=EYEBROW_SIZE, font=CAPS, style=CAPS_STYLE, tracking=EYEBROW_TRACK),
             dict(text=glyph or "門", size=34, font=CJK, style="Regular")]
    name_i = len(specs)
    for s in name_sizes:
        specs.append(dict(text=spec["room"], size=s, font=name_font[0], style=name_font[1], width=col_w,
                          accent=accent_word if name_font[0] != CJK else ""))
    title_i = md_i = None
    if has_work:
        title_i = len(specs)
        for s in TITLE_SIZES:
            specs.append(dict(text=title, size=s, font=title_font[0], style=title_font[1], width=col_w))
        md_i = len(specs)
        specs.append(dict(text=maker_date, size=19, font=BODY, style="Roman"))
        specs.append(dict(text=src_line, size=15, font=BODY, style="Roman"))
    line_i = len(specs)
    line = spec.get("line") or ""
    line_ws = [col_w, int(col_w * 0.86), int(col_w * 0.74), int(col_w * 0.64)]
    line_font = face(line, "Italic")
    if not has_work and line:
        for lw in line_ws:
            specs.append(dict(text=line, size=23, font=line_font[0], style=line_font[1], width=lw))
    ms, fonts = measure(specs, work)
    for f in fonts or []:
        if f.get("status") != "exact" or f.get("missingGlyphs"):
            log(f"{spec['slug']}: font {f['family']} {f['style']}: {f.get('status')}, missing glyphs {f.get('missingGlyphs')}")

    a_w, art_w_caps, eb_w, g_w = ms[0]["w"], ms[1]["w"], ms[2]["w"], ms[3]["w"]
    one_line_min = 50 if has_work else 66
    name = None
    for k, s in enumerate(name_sizes):              # one line, as long as it stays large
        m = ms[name_i + k]
        if len(m["lines"]) == 1 and s >= one_line_min:
            name = (s, m)
            break
    if name is None:
        for k, s in enumerate(name_sizes):
            m = ms[name_i + k]
            if len(m["lines"]) <= 2:
                name = (s, m)
                break
    if name is None:
        name = (name_sizes[-1], ms[name_i + len(name_sizes) - 1])
        log(f"{spec['slug']}: room name needs {len(name[1]['lines'])} lines even at {name[0]}px")

    ground, mnt, ty = [], [], []
    dark = p["dark"]

    # ── ground: this room ──
    ground += [("shape.rectangle", {"x": 0, "y": 0, "width": W, "height": H}), no_stroke(),
               lgrad([stop(0, mix(p["wall"], "#000000", 0.10) if dark else mix(p["wall"], "#ffffff", 0.25)),
                      stop(0.55, p["wall"]), stop(1, p["wall"])], (0, 0), (W, 0))]
    if dark:     # the next room's light on this wall, around the door
        gw, gh = dw * 2.6, 720
        ground += [("shape.ellipse", {"x": DOOR_CX - gw / 2, "y": ys + 10 - gh / 2, "width": gw, "height": gh}),
                   no_stroke(), rgrad([stop(0, p["next_top"], 0.15), stop(0.3, p["next_top"], 0.10),
                                       stop(0.62, p["next_top"], 0.035), stop(1, p["next_top"], 0.0)],
                                      100 * gh / gw), blur(60)]
    # this room's floor
    ground += [("shape.rectangle", {"x": 0, "y": FLOOR, "width": W, "height": H - FLOOR}), no_stroke(),
               lgrad([stop(0, p["floor"]), stop(1, mix(p["floor"], "#000000", 0.18) if dark else p["floor"])],
                     (0, FLOOR), (0, H)),
               ("shape.rectangle", {"x": 0, "y": FLOOR - 1, "width": W, "height": 1.5}), no_stroke(),
               fill(mix(p["wall"], "#000000", 0.35) if dark else mix(p["wall"], p["muted"], 0.24))]
    # ── ground: the door ──
    # the reveal fills the opening; the next room is drawn over all of it but the left reveal
    ground += [("path.create", {"d": door_path(DOOR_CX, ys, r, FLOOR)}), no_stroke(),
               lgrad([stop(0, mix(p["reveal"], p["next_top"], 0.35)), stop(1, p["reveal"])], (0, APEX), (0, FLOOR))]
    vis = visible_path(DOOR_CX, ys, r, FLOOR, REVEAL)
    ground += [("path.create", {"d": vis}), no_stroke(),
               lgrad([stop(0, p["next_top"]), stop(0.55, p["next"]), stop(1, p["next_low"])], (0, APEX), (0, FAR_FLOOR))]
    # the gallery light pooled on the far wall, behind the work (or the lettering)
    if has_work:
        cxw, cyw, sw, sh = art["ox"] + art["ow"] / 2, art["oy"] + art["oh"] / 2, art["ow"] + 230, art["oh"] + 200
    else:
        cxw, cyw, sw, sh = DOOR_CX + REVEAL / 2, (APEX + r * 0.9 + FAR_FLOOR) / 2, dw * 0.95, 380
    pool = mix(p["next_top"], "#ffffff", 0.10) if dark else mix(p["wall"], "#ffffff", 0.35)
    pool_i = len(ground)
    ground += [("shape.ellipse", {"x": cxw - sw / 2, "y": cyw - sh / 2, "width": sw, "height": sh}), no_stroke(),
               rgrad([stop(0, pool, 0.40 if dark else 0.55), stop(1, pool, 0.0)], 100 * sh / sw)]
    clip_i = len(ground)              # the light stays in the next room: the opening clips it (compose)
    ground += [("path.create", {"d": vis}), no_stroke(), fill("#000000")]
    # the next room's floor, and the skirting where it meets the far wall
    fx0, fx1 = DOOR_CX - r + REVEAL, DOOR_CX + r
    ground += [("shape.rectangle", {"x": fx0, "y": FAR_FLOOR, "width": fx1 - fx0, "height": FLOOR - FAR_FLOOR}),
               no_stroke(), lgrad([stop(0, p["floor2_far"]), stop(1, p["floor2_near"])], (0, FAR_FLOOR), (0, FLOOR)),
               ("shape.rectangle", {"x": fx0, "y": FAR_FLOOR - 1.5, "width": fx1 - fx0, "height": 2}), no_stroke(),
               fill(mix(p["next_low"], "#000000", 0.30 if dark else 0.12))]
    # the reveal's foot on the floor, and the threshold
    ground += [("shape.rectangle", {"x": DOOR_CX - r, "y": FAR_FLOOR + 6, "width": REVEAL, "height": FLOOR - FAR_FLOOR - 6}),
               no_stroke(), fill(mix(p["reveal"], "#000000", 0.25 if dark else 0.08))]
    if dark:     # the light falling out of the door onto this room's floor
        sp = (f"M{fx0:.1f},{FLOOR} L{fx1:.1f},{FLOOR} L{fx1 + 90:.1f},{H + 2} L{fx0 - 90:.1f},{H + 2} Z")
        ground += [("path.create", {"d": sp}), no_stroke(),
                   lgrad([stop(0, p["next_top"], 0.55), stop(1, p["next_top"], 0.10)], (0, FLOOR), (0, H)), blur(6)]
    # the casing: one hairline standing off the opening
    ground += [("path.create", {"d": casing_path(DOOR_CX, ys, r, FLOOR - 1, CASING)}),
               ("paint.setFill", {"none": True}), ("paint.setStroke", {"color": p["casing"]}),
               ("stroke.set", {"weight": 1.3, "cap": "butt", "join": "miter"})]
    # a room with no work: its glyph (or a line cited from the site) lettered on the far wall
    letter = mix(p["next"], p["accent"], 0.88 if dark else 0.92)
    wall_text = [t for t in (spec.get("wall_text") or []) if t]
    if not has_work and glyph:
        chars = list(glyph)
        size = 168 if len(chars) == 1 else 132
        lead = size * 1.06
        total = size * 0.88 + (len(chars) - 1) * lead
        cy_mid = (APEX + r * 0.55 + FAR_FLOOR - BELOW) / 2
        base0 = cy_mid - total / 2 + size * 0.88
        for i, ch in enumerate(chars):
            ground += text(DOOR_CX + REVEAL / 2, base0 + i * lead, ch, size, CJK, "Light", letter, justify="center")
    elif not has_work and wall_text:
        size = 66
        lead = round(size * 1.18)
        total = size * 0.70 + (len(wall_text) - 1) * lead
        cy_mid = (APEX + r * 0.55 + FAR_FLOOR - BELOW) / 2
        base0 = cy_mid - total / 2 + size * 0.70
        for i, t in enumerate(wall_text):
            f, st = face(t, "Italic")
            ground += text(DOOR_CX + REVEAL / 2, base0 + i * lead, t, size, f, st, letter, justify="center")

    # ── mount: the room's frame or mat, or a backing exactly under the work (it carries the shadow) ──
    if has_work:
        mount = spec.get("mount") or {}
        if art["border"]:
            mnt += rect(art["ox"], art["oy"], art["ow"], art["oh"], solid(mount["border"], p["next"]))
        if any(art["pad"]):
            b = art["border"]
            mnt += rect(art["ox"] + b, art["oy"] + b, art["ow"] - 2 * b, art["oh"] - 2 * b,
                        solid(mount.get("color") or p["next"], p["next"]))
        if not mnt:
            mnt += rect(art["x"], art["y"], art["w"], art["h"], mix(p["next"], "#000000", 0.5))

    # ── type: the signature ──
    a_base = 92
    ty += text(X, a_base, "a", 50, DISPLAY, "Italic", p["accent"])
    rule_x = X + a_w + 15
    ty += [("shape.rectangle", {"x": rule_x, "y": a_base - 40, "width": 1.2, "height": 46}), no_stroke(), fill(p["rule"])]
    caps_x = rule_x + 17
    ty += text(caps_x, a_base - 12, "ARTBITRAGE", 16, CAPS, CAPS_STYLE, p["ink"], tracking=240)

    # ── type: the room ──
    eb_base = 210
    gx = X
    if has_work and glyph:
        ty += text(gx, eb_base, glyph, 34, CJK, "Regular", p["accent"])
        gx += g_w + 16
    if eyebrow:
        ty += text(gx, eb_base - 7, eyebrow, EYEBROW_SIZE, CAPS, CAPS_STYLE, p["muted"], tracking=EYEBROW_TRACK)
    eb_right = gx + (eb_w if eyebrow else 0)

    ns, nm = name
    lead = round(ns * 1.08)
    name_base = eb_base + 30 + round(ns * 0.78)
    name_text = "\n".join(nm["lines"])
    name_step = len(ty)
    ty += text(X, name_base, name_text, ns, name_font[0], name_font[1], p["ink"], leading=lead)
    name_bottom = name_base + (len(nm["lines"]) - 1) * lead + ns * 0.25
    accent = None
    rng = accent_range(name_text, accent_word) if name_font[0] != CJK else None
    if accent_word and not rng:
        log(f"{spec['slug']}: accent word {accent_word!r} is not in the room name")
    if rng:
        accent = (name_step, rng[0], rng[1], spec.get("accent_word_color") or p["accent"])

    # ── type: the record (or the room's line) and the address ──
    addr_base = 588
    ty += text(X, addr_base, address, 16, BODY, "Roman", p["faint"])
    rec = {}
    if has_work:
        tsz, tm = None, None
        for k, s in enumerate(TITLE_SIZES):
            if len(ms[title_i + k]["lines"]) <= 2:
                tsz, tm = s, ms[title_i + k]
                break
        if tm is None:
            tsz, tm = TITLE_SIZES[-1], ms[title_i + len(TITLE_SIZES) - 1]
            log(f"{spec['slug']}: title needs {len(tm['lines'])} lines")
        md_w, src_w = ms[md_i]["w"], ms[md_i + 1]["w"]
        src_base = addr_base - 44
        if md_w <= col_w or not spec.get("maker"):
            md_lines = [maker_date]
        else:
            md_lines = [spec.get("maker") or "", spec.get("date") or ""]
        md_base = src_base - 27 - (len(md_lines) - 1) * 24
        tlead = round(tsz * 1.2)
        t_base = md_base - 31 - (len(tm["lines"]) - 1) * tlead
        lab_base = t_base - tsz - 16
        ty += text(X, lab_base, "IN THE NEXT ROOM", LABEL_SIZE, CAPS, CAPS_STYLE, p["accent"], tracking=LABEL_TRACK)
        ty += text(X, t_base, "\n".join(tm["lines"]), tsz, title_font[0], title_font[1], p["ink"], leading=tlead)
        ty += text(X, md_base, "\n".join(md_lines), 19, BODY, "Roman", p["body"], leading=24)
        ty += text(X, src_base, src_line, 15, BODY, "Roman", p["faint"])
        rec = {"title_size": tsz, "title_lines": len(tm["lines"]), "label_base": lab_base,
               "maker_date_lines": len(md_lines), "widest": max(tm["w"], md_w if len(md_lines) == 1 else 0, src_w)}
        if lab_base - LABEL_SIZE < name_bottom + 24:
            raise RuntimeError(f"{spec['slug']}: the record crowds the room name ({lab_base - LABEL_SIZE:.0f} vs {name_bottom:.0f})")
    elif line:
        cands = ms[line_i:line_i + len(line_ws)]
        fewest = min(len(c["lines"]) for c in cands)

        def ragged(c):
            ls = [len(l) for l in c["lines"]]
            bad = sum(1 for l in c["lines"][:-1] if l.split() and l.split()[-1].lower().strip(",;:") in STOP)
            return bad + (0 if len(ls) < 2 else abs(ls[-1] - sum(ls[:-1]) / (len(ls) - 1)) / max(ls))
        lm = min((c for c in cands if len(c["lines"]) <= fewest + 0), key=ragged)
        if fewest > 1:                              # one more line is fine if it cures a widow
            alt = min((c for c in cands if len(c["lines"]) == fewest + 1), key=ragged, default=None)
            if alt and ragged(lm) > 0.45 and ragged(alt) < ragged(lm):
                lm = alt
        n = len(lm["lines"])
        last = addr_base - 54
        top_base = last - (n - 1) * 32
        ty += text(X, top_base, "\n".join(lm["lines"]), 23, line_font[0], line_font[1], p["body"], leading=32)
        rec = {"line_lines": n, "line_width": round(lm["w"])}
        if top_base - 23 < name_bottom + 24:
            raise RuntimeError(f"{spec['slug']}: the line crowds the room name ({top_base - 23:.0f} vs {name_bottom:.0f})")

    widest = max(a_w + 32 + art_w_caps, eb_right - X, nm["w"], rec.get("widest", 0))
    info = {"_clip": (pool_i, clip_i), "_accent": accent, "door_w": dw, "door_r": r, "spring": ys, "col_w": col_w,
            "column_right": round(X + widest, 1), "door_left": x0 - CASING, "name_size": ns,
            "name_lines": len(nm["lines"]), "accent_word": bool(accent), **rec}
    if X + widest > x0 - CASING - 20:
        raise RuntimeError(f"{spec['slug']}: the column ({X + widest:.0f}px) runs into the door ({x0 - CASING:.0f}px)")
    return {"ground": ground, "mount": mnt, "type": ty}, info, p


# ── compose (VectorCraft) ───────────────────────────────────────────────
def compose(layers, work, clip=None, accent=None):
    work = Path(work)
    master = work / "card.vectorcraft"
    steps = [("file.new", {"width": W, "height": H, "units": "Pixels", "backgroundContents": "transparent",
                           "name": "through-the-door"}),
             ("layer.setProps", {"name": "ground"})]
    steps += layers["ground"]
    names = ["ground"]
    starts = {"ground": 2}
    marks = {}
    for k in ("mount", "type"):
        if not layers.get(k):
            continue
        marks[k] = len(steps)
        steps += [("layer.new", {"name": k, "top": True})]
        starts[k] = len(steps)
        steps += layers[k]
        names.append(k)
    cr = cmd_results(vc_run(steps, [master], cwd=work))
    ids = {"ground": 1, **{k: cr[marks[k]]["id"] for k in marks}}
    outs = {k: work / f"{k}.png" for k in names}
    exp = []
    if clip:                          # ids come back from the first run
        pool_id, clip_id = cr[starts["ground"] + clip[0]]["id"], cr[starts["ground"] + clip[1]]["id"]
        exp += [("select.set", {"ids": [pool_id, clip_id]}), ("object.clippingMask.make", {}), ("select.none", {})]
    if accent:                        # the room name's italic accent word, styled by range on the set text
        step, a, b, color = accent
        tid = cr[starts["type"] + step]["id"]
        exp += [("text.setRangeStyle", {"id": tid, "start": a, "end": b, "style": "Italic", "fill": color})]
    if exp:
        exp += [("file.save", {"path": str(master)})]
    exp += [("document.export", {"path": str(work / "card.svg")}),
            ("layer.setProps", {"ids": [ids[k] for k in names], "visible": False})]
    for k in names:
        exp += [("layer.setProps", {"id": ids[k], "visible": True}),
                ("document.export", {"path": str(outs[k])}),
                ("layer.setProps", {"id": ids[k], "visible": False})]
    vc_run(exp, [], cwd=work, pre=["--in", str(master)])
    return outs


# ── finish (PhotoCraft) ─────────────────────────────────────────────────
def pc_run(src, cmds, out):
    argv = [PC, "run", str(src)]
    for cid, params in cmds:
        argv += ["--cmd", cid]
        if params is not None:
            argv += ["--params", json.dumps(params)]
    argv += ["--out", str(out)]
    p = subprocess.run(argv, capture_output=True, text=True, timeout=180)
    if p.returncode != 0:
        raise RuntimeError(f"photocraft-cli exit {p.returncode}: {(p.stderr or p.stdout).strip()[-600:]}")
    return p


def downscale(src, w, h, out):
    """The work at w x h: one Lanczos downscale (never up), nothing else."""
    nw, nh = jpeg_size(src)
    if w > nw or h > nh:
        raise RuntimeError(f"refusing to upscale {nw}x{nh} to {w}x{h}")
    if (w, h) == (nw, nh):
        pc_run(src, [], out)
    else:
        pc_run(src, [("image.imageSize", {"width": w, "height": h, "resample": "lanczos"})], out)
    got = pngread.read(str(out))
    if got[:2] != (w, h):
        raise RuntimeError(f"downscale gave {got[:2]}, wanted {(w, h)}")
    return got


def finish(outs, p, art, art_png, out_jpg, work):
    master = Path(work) / "master.png"
    cmds = [("filter.noise.addNoise", {"amount": 1.6 if p["dark"] else 1.2, "distribution": "gaussian",
                                       "monochromatic": True, "seed": 7})]          # the rooms only
    if art:
        color, opacity = p["shadow"]
        cmds += [("file.placeEmbedded", {"path": str(outs["mount"]), "scale": 100, "fit": False, "center": [W / 2, H / 2]}),
                 ("layer.setProps", {"name": "mount"}),
                 ("layer.layerStyle.dropShadow", {"color": color, "opacity": opacity, "angle": 90, "distance": 7,
                                                  "spread": 0, "size": 20, "blend": "multiply"}),
                 ("layer.layerStyle.dropShadow", {"color": color, "opacity": min(90, opacity + 20), "angle": 90,
                                                  "distance": 1, "spread": 0, "size": 3, "blend": "multiply",
                                                  "add": True}),
                 ("file.placeEmbedded", {"path": str(art_png), "scale": 100, "fit": False,
                                         "center": [art["x"] + art["w"] / 2, art["y"] + art["h"] / 2]}),
                 ("layer.setProps", {"name": "work"})]
    cmds += [("file.placeEmbedded", {"path": str(outs["type"]), "scale": 100, "fit": False, "center": [W / 2, H / 2]}),
             ("layer.setProps", {"name": "type"}),
             ("layer.flattenImage", {})]
    pc_run(outs["ground"], cmds, master)
    check = None
    if art:
        big = pngread.read(str(master))
        small = pngread.read(str(art_png))
        same, maxd, nd = pngread.region_equal(big, small, art["x"], art["y"])
        check = {"work_pixels_identical": same, "max_diff": maxd, "diff_values": nd}
        if not same:
            raise RuntimeError(f"the work's pixels changed in the master (max diff {maxd}, {nd} values)")
    q = JPEG_START_Q
    while True:
        r = subprocess.run([PC, "convert", str(master), str(out_jpg), "--quality", str(q)],
                           capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            raise RuntimeError(f"photocraft-cli convert exit {r.returncode}: {r.stderr.strip()[-400:]}")
        size = out_jpg.stat().st_size
        if size <= JPEG_LIMIT or q <= 60:
            break
        q -= 4
    if size > JPEG_LIMIT:
        raise RuntimeError(f"{out_jpg.name} is {size} bytes even at q{q}")
    if jpeg_size(out_jpg) != (W, H):
        raise RuntimeError(f"{out_jpg.name} is {jpeg_size(out_jpg)}, not {W}x{H}")
    return master, q, size, check


# ── one card ────────────────────────────────────────────────────────────
def make_card(spec, out_dir, keep=False, tag=None):
    for k in ("slug", "path", "room", "wall", "ink", "muted", "accent"):
        if not spec.get(k):
            raise ValueError(f"room spec lacks {k!r}")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = spec["slug"] + (f"--{tag}" if tag else "")
    work = Path(tempfile.mkdtemp(prefix=f"og-{name}-"))
    t0 = time.time()
    try:
        img = (spec.get("image") or "").strip()
        art, art_png, natural = None, None, None
        if img:
            src = repo_path(img)
            if not src.is_file():
                raise FileNotFoundError(src)
            for k in ("title", "date", "source"):        # an unnamed maker is fine; a missing record is not
                if not spec.get(k):
                    raise ValueError(f"{spec['slug']}: a card with a work must carry its record ({k} is empty)")
            natural = jpeg_size(src)
            art = fit_work(*natural, spec.get("mount"))
            art_png = work / "work.png"
            downscale(src, art["w"], art["h"], art_png)
        layers, info, p = build(spec, work, art)
        outs = compose(layers, work, info.pop("_clip", None), info.pop("_accent", None))
        out = out_dir / f"{name}.jpg"
        _, q, size, check = finish(outs, p, art, art_png, out, work)
    except Exception:
        if not keep:
            shutil.rmtree(work, ignore_errors=True)
        raise
    if not keep:
        shutil.rmtree(work, ignore_errors=True)
    row = {"slug": spec["slug"], "path": spec["path"], "file": str(out), "bytes": size, "quality": q,
           "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
           "work": ({"image": img, "natural": list(natural), "placed": [art["x"], art["y"], art["w"], art["h"]],
                     "mounted_box": [art["ox"], art["oy"], art["ow"], art["oh"]],
                     "scale": art["scale"], "aspect_error": art["aspect_error"],
                     "share_of_card": round(art["w"] * art["h"] / (W * H), 3), **(check or {})} if art else None),
           "typographic": art is None, **info, "seconds": round(time.time() - t0, 2),
           "workdir": str(work) if keep else None}
    print(json.dumps(row, ensure_ascii=False), flush=True)
    return row


# ── credits.json: what each card shows, and how it was made ─────────────
def tool_version(exe):
    try:
        return subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
    except OSError:
        return None


def credits(specs, rows):
    cards = []
    by_slug = {r["slug"]: r for r in rows}
    for s in specs:
        r = by_slug[s["slug"]]
        card = {"slug": s["slug"], "page": s["path"], "card": f"/{OG_DIR}/{s['slug']}.jpg",
                "og_image": f"{SITE}/{OG_DIR}/{s['slug']}.jpg", "width": W, "height": H,
                "bytes": r["bytes"], "sha256": r["sha256"], "jpeg_quality": r["quality"],
                "alt": s.get("card_alt", ""), "room_name": s["room"], "glyph": s.get("glyph") or None,
                "eyebrow": s.get("eyebrow") or None}
        if r["work"]:
            w = r["work"]
            card["shows"] = {"artwork": {
                "title": s["title"], "maker": s.get("maker") or None, "date": s["date"],
                "museum": s["source"], "license": s.get("license") or None, "museum_url": s.get("url") or None,
                "image": "/" + s["image"].removeprefix("dist/"), "record_source": s.get("record_source"),
                "maker_note": s.get("maker_note")}}
            # A work whose image has no credits file of its own records its at-source rights check here.
            for key in ("api_source", "is_public_domain", "copyright_notice", "rights_verified_at", "image_sha256", "image_bytes", "image_px"):
                if key in s:
                    card["shows"]["artwork"][key] = s[key]
            card["hanging"] = {"natural_px": w["natural"], "placed_px": w["placed"], "scale": w["scale"],
                               "mounted_box_px": w["mounted_box"], "mount": s.get("mount"),
                               "mount_source": s.get("mount_source"),
                               "work_pixels_identical_in_master": w.get("work_pixels_identical"),
                               "treatment": "whole and uncropped, downscaled once (Lanczos), never upscaled or recoloured"}
        else:
            card["shows"] = "typographic"
            card["far_wall"] = ({"glyph": s["glyph"], "source": s.get("glyph_source")} if s.get("glyph")
                                else {"lettering": s.get("wall_text"), "source": s.get("wall_text_source")})
            if s.get("line"):
                card["line"] = {"text": s["line"], "source": s.get("line_source")}
        card["palette"] = {k: s[k] for k in ("wall", "ink", "muted", "accent")} | {"source": s.get("tokens")}
        if s.get("accent_word"):
            card["accent_word"] = {"word": s["accent_word"], "source": s.get("accent_source")}
        cards.append(card)
    return {
        "about": ("Open Graph share cards for artbitrage.io rooms: one 1200x630 JPEG per room, linked from each "
                  "page's og:image and twitter:image. This file says what each card shows, where its record comes "
                  "from, and how the cards are made."),
        "how": {
            "design": ("THROUGH THE DOOR: you stand in the room (its wall colour); an arched door (the 閒 door's head) "
                       "opens onto the next room, where the room's key work hangs whole, mounted as the room's own CSS "
                       "mounts it. A room without a key work gets a typographic card: its glyph, or a line cited from "
                       "the site, lettered on the far wall."),
            "generator": "tools/brand/gen_card.py",
            "specs": "tools/brand/rooms.json",
            "rebuild": "python3 tools/brand/gen_card.py tools/brand/rooms.json --all",
            "pipeline": [
                "VectorCraft measures every line of type (area type converted to point type gives the app's own line breaks; CJK breaks only after its punctuation).",
                "VectorCraft composes three layers: ground (room, door, next room, far-wall lettering), mount (the room's frame or mat, or a backing under the work) and type.",
                "PhotoCraft downscales the work once with Lanczos, never above 100%, keeping its aspect.",
                "PhotoCraft grains the ground, places the mount with a drop shadow, places the work at 100% on whole pixels with no style, places the type and flattens.",
                "The work's pixels in the flattened master are compared with the downscaled work; any difference fails the card.",
                "PhotoCraft writes the JPEG, stepping quality down from 92 until the file is 200 KB or less."],
            "tools": {"vectorcraft": tool_version(VC), "photocraft": tool_version(PC)},
            "fonts": ["Iowan Old Style (Roman, Italic)", "Avenir Next (Medium)", "Songti TC (Regular, Light)"],
            "reproducible": "Same tool versions and macOS fonts give byte-identical cards (sha256 above).",
        },
        "cards": cards,
    }


def load_specs(path):
    d = json.loads(Path(path).read_text())
    if isinstance(d, dict) and "rooms" in d:
        return d["rooms"]
    if isinstance(d, list):
        return d
    return [d]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("spec", help="a room spec JSON (one object) or rooms.json")
    ap.add_argument("--slug", nargs="*", help="rooms to make (from rooms.json)")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", help=f"output folder (default: {OG_DIR}/ in the repo, mirrored to dist/{OG_DIR}/)")
    ap.add_argument("--tag")
    ap.add_argument("--keep", action="store_true", help="keep each card's work folder (printed in its row)")
    a = ap.parse_args(argv)
    specs = load_specs(a.spec)
    if a.slug:
        want = set(a.slug)
        specs = [s for s in specs if s.get("slug") in want]
        missing = want - {s["slug"] for s in specs}
        if missing:
            log(f"no such room(s): {sorted(missing)}")
    elif not a.all and len(specs) > 1:
        ap.error("rooms.json holds several rooms: pass --slug ... or --all")
    out = Path(a.out) if a.out else ROOT / OG_DIR
    mirror = None if a.out else ROOT / "dist" / OG_DIR
    failed, rows = 0, []
    for s in specs:
        try:
            rows.append(make_card(s, out, keep=a.keep, tag=a.tag))
        except Exception as ex:
            failed += 1
            log(f"{s.get('slug')}: FAILED: {type(ex).__name__}: {ex}")
    if a.all and not failed and not a.tag:
        doc = json.dumps(credits(specs, rows), ensure_ascii=False, indent=1) + "\n"
        (out / "credits.json").write_text(doc, encoding="utf-8")
    if mirror:                         # dist/ is what deploys: keep it byte-identical
        mirror.mkdir(parents=True, exist_ok=True)
        names = [Path(r["file"]).name for r in rows] + (["credits.json"] if (a.all and not failed and not a.tag) else [])
        for n in names:
            shutil.copyfile(out / n, mirror / n)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
