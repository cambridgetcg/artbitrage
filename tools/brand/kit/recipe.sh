#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────────────────────
#  閒 THE GAP — the artbitrage.io icon kit (tab, home screen, manifest).  Rebuilds every
#  deliverable byte-identically into an output folder (default tools/brand/kit/out/).
#
#    the mark : a door in two arched leaves; the slit between them opens into a full round moon
#               and closes again. The moon is not drawn: it is the gap, so whatever is behind the
#               door shows through. 閒 (門 + 月, 「隙也。从門从月」): moonlight seen through the gap of
#               a door, the first way 間 "gap" was written.
#    module   : u = the slit. door 5u x 7u · arch radius 2.5u · round 3.5u, its top on the arch's
#               spring line · 1u of slit left at the threshold (the gap mark's own module).
#    inputs   : ../marks/gap/{mark-dark.svg, dark-16.png, dark-32.png} — the winning mark's master
#               and its hand-hinted 32/16 px cuts, read only, for the identity checks in step 6.
#    scope    : the ICON only. The site header keeps its typographic italic "a"; no header assets.
#               Forest tile only (#17271f ground, gold #dbcca7 door): the paper tile vanished on
#               light chrome.
#    tools    : vectorcraft-cli 0.7.0   every vector, every PNG, the .vectorcraft source
#               photocraft-cli  0.5.0   favicon.ico (one 32 px frame; 0.5.0 writes no more)
#    helpers  : python3 (stdlib only) writes the VectorCraft command list, adds the ONE hand-written
#               <style> block to favicon.svg, sets mark.svg's fill to currentColor (VectorCraft
#               cannot write it), writes the manifest + head snippet, and runs every check.
#    review   : optional: if OUT/work/browser-check.cjs (Playwright Chromium) or OUT/work/review.py
#               (PIL) exist they draw inspection sheets in OUT/work/; they never touch a deliverable.
#               They are not kept in the repo, so a repo rebuild skips them.
#    run      : bash tools/brand/kit/recipe.sh [OUT]   (writes only inside OUT; see ../README.md
#               for installing the files at the site root and in dist/)
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"           # tools/brand/kit
SRC="$(cd "$HERE/../marks/gap" && pwd)"         # the winning mark: read only, for the identity checks
KIT="${1:-$HERE/out}"                           # every deliverable is written here, nowhere else
mkdir -p "$KIT/work"
KIT="$(cd "$KIT" && pwd)"
cd "$KIT"

OUTS=(mark.vectorcraft mark.svg favicon.svg favicon.ico favicon-16.png favicon-32.png
      apple-touch-icon.png icon-192.png icon-512.png icon-maskable-512.png
      site.webmanifest head-snippet.html)
rm -f "${OUTS[@]}" work/favicon-raw.svg work/mark-raw.svg work/icon-512.svg work/icon-maskable-512.svg

# ── 0. pre-flight: the exact tool builds this recipe was written against ─────────────────────
[ "$(vectorcraft-cli --version)" = "vectorcraft-cli 0.7.0" ] || { echo "need vectorcraft-cli 0.7.0"; exit 1; }
photocraft-cli --version | grep -q '^photocraft-cli 0\.5\.0' || { echo "need photocraft-cli 0.5.0"; exit 1; }
[ ! -e manifest.json ] || { echo "manifest.json must not exist here: /manifest.json is the site's philosophy document"; exit 1; }

# ── 1. VectorCraft: one session, eight artboards, every vector and PNG ──────────────────────
KIT="$KIT" python3 - <<'PY'
import json, math, os, subprocess, sys
KIT = os.environ['KIT']

# site tokens — welcome.css: --forest #17271f; .brand-mark color #dbcca7 (the header's italic a)
FOREST, GOLD = '#17271f', '#dbcca7'

A, CHECKS = [], []            # the VectorCraft argv; (step index of a document.inspect, expected count, label)
def cmd(c, p=None):
    A.extend(['--cmd', c] + (['--params', json.dumps(p, ensure_ascii=False)] if p is not None else []))
def nsteps():   return sum(1 for a in A if a == '--cmd')
def fill(c):    cmd('paint.setFill', {'color': c})
def nostroke(): cmd('paint.setStroke', {'none': True})        # new objects get a 1 pt black stroke
def name(n):    cmd('object.setProps', {'name': n})           # becomes the SVG id
def rect(x, y, w, h, col, r=None, nm=None):
    p = {'x': x, 'y': y, 'width': w, 'height': h}
    if r: p['radius'] = r
    cmd('shape.rectangle', p); fill(col); nostroke()
    if nm: name(nm)
def path(d, col, nm):
    cmd('path.create', {'d': d}); fill(col); nostroke(); name(nm)
def expect_selection(n, label):                                 # select.* returns null: prove it
    CHECKS.append((nsteps(), n, label)); cmd('document.inspect', {'depth': 0})

ab = {}
def artboard(n, x, y, w, h):
    ab[n] = len(ab)
    if ab[n] == 0: cmd('artboard.setProps', {'index': 0, 'name': n, 'x': x, 'y': y, 'width': w, 'height': h})
    else:          cmd('artboard.new', {'x': x, 'y': y, 'width': w, 'height': h, 'name': n})

# ── the door, drawn on its module (identical to ../marks/gap/recipe.sh door_d) ──
def door_d(u, ox, oy):
    """two leaves of an arched door 5u x 7u at (ox, oy); the slit (1u) opens into a round of 3.5u"""
    W, H, R, g, r = 5 * u, 7 * u, 2.5 * u, u, 1.75 * u
    cx, spring = ox + W / 2, oy + R                 # spring line: where the arch begins
    cy = spring + r                                  # the round's top sits on the spring line
    xl, xr = cx - g / 2, cx + g / 2
    ya = spring - math.sqrt(R * R - (g / 2) ** 2)   # arch meets the slit
    yb = math.sqrt(r * r - (g / 2) ** 2)            # round meets the slit
    f = lambda v: f'{v:.4f}'.rstrip('0').rstrip('.')
    left = (f'M{f(ox)} {f(oy + H)} V{f(spring)} A{f(R)} {f(R)} 0 0 1 {f(xl)} {f(ya)} V{f(cy - yb)} '
            f'A{f(r)} {f(r)} 0 0 0 {f(xl)} {f(cy + yb)} V{f(oy + H)} Z')
    right = (f'M{f(ox + W)} {f(oy + H)} V{f(spring)} A{f(R)} {f(R)} 0 0 0 {f(xr)} {f(ya)} V{f(cy - yb)} '
             f'A{f(r)} {f(r)} 0 0 1 {f(xr)} {f(cy + yb)} V{f(oy + H)} Z')
    return left + ' ' + right

# ── the 16 px cut: the hand-hinted pixel map of ../marks/gap (u = 2 px), drawn at k px per pixel ──
# left leaf, one run of pixel columns per row; the right leaf mirrors about x = 8.
# door cols 3..12, rows 1..14 · slit cols 7-8 · round 6 x 6 px, rows 7..12 · threshold rows 13-14
RUNS16 = {1: (5, 6), 2: (4, 6), 3: (3, 6), 4: (3, 6), 5: (3, 6), 6: (3, 6), 7: (3, 5),
          8: (3, 4), 9: (3, 4), 10: (3, 4), 11: (3, 4), 12: (3, 5), 13: (3, 6), 14: (3, 6)}
SHOULDERS16 = [(4, 1), (3, 2)]   # one anti-alias pixel per shoulder step, each side: gold at 45% over the
SHOULDER_OPACITY = 45            # forest tile (the source premixed them; a token at 45% gives the same pixel)
def tidy(pts):
    """drop repeated and collinear vertices of a closed outline (the pixel map stays the same)"""
    out = [p for i, p in enumerate(pts) if p != pts[i - 1]]
    while True:
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            if (b[0] - a[0]) * (c[1] - b[1]) == (b[1] - a[1]) * (c[0] - b[0]):
                del out[i]; break
        else:
            return out
def door16_d(ox, oy, k=1):
    out = []
    for mirror in (False, True):
        left, right = [], []
        for y in sorted(RUNS16):
            a, b = RUNS16[y]; x0, x1 = a, b + 1
            if mirror: x0, x1 = 16 - (b + 1), 16 - a
            left += [(x0, y), (x0, y + 1)]; right += [(x1, y), (x1, y + 1)]
        pts = tidy(left + right[::-1])
        out.append('M' + ' L'.join(f'{ox + k * x} {oy + k * y}' for x, y in pts) + ' Z')
    return ' '.join(out)
def shoulders16_d(ox, oy, k=1):
    sq = [(c, r) for c, r in SHOULDERS16] + [(15 - c, r) for c, r in SHOULDERS16]
    return ' '.join(f'M{ox + k * c} {oy + k * r} L{ox + k * (c + 1)} {oy + k * r} L{ox + k * (c + 1)} {oy + k * (r + 1)} '
                    f'L{ox + k * c} {oy + k * (r + 1)} Z' for c, r in sq)

# ── optical placement (the judges' graft): the door's ink centroid sits 0.1672u below the centre
# of its 5u x 7u box (bottom-heavy: full leaves below the round). The tile centre is put halfway
# between box centre and ink centroid, rounded to whole pixels so every straight edge stays crisp.
DROP = 0.1672
def place(T, u):
    ox, oy = (T - 5 * u) / 2, (T - 7 * u) / 2 - round(DROP * u / 2)
    assert ox == int(ox) and oy == int(oy), (T, u, ox, oy)
    return int(ox), int(oy)

# ── document ──
cmd('file.new', {'width': 512, 'height': 512, 'units': 'Pixels', 'created': None})   # pinned: byte-identical rebuilds
cmd('file.info', {'title': '閒 the gap — artbitrage.io', 'author': 'Yu & Ai',
    'description': 'A door in two leaves. The gap between them opens into a full round moon and closes again: '
                   'the moon is not drawn, it is the gap, and whatever is behind the door shows through. '
                   '閒 (門 + 月, 隙也): moonlight seen through the gap of a door, the first way 間 was written. '
                   'artbitrage.io, a place to meet art.',
    'keywords': ['artbitrage', '閒', '間', 'the gap', 'Yu & Ai']})
cmd('layer.setProps', {'name': 'artbitrage'})

# (a) favicon.svg source: ONE 32-unit board carrying both cuts. The 16 cut is drawn first, alone,
#     at 2 units per pixel, so it can be grouped; then the tile goes behind and the 32 cut on top.
artboard('favicon', 0, 0, 32, 32)
path(door16_d(0, 0, 2), GOLD, 'door-16')
path(shoulders16_d(0, 0, 2), GOLD, 'shoulders-16'); cmd('object.setProps', {'opacity': SHOULDER_OPACITY})
cmd('select.allOnArtboard', {'artboard': ab['favicon']}); expect_selection(2, 'cut-16 parts')
cmd('object.group'); name('cut-16')
rect(0, 0, 32, 32, FOREST, 6, 'tile'); cmd('object.arrange.sendToBack')
path(door_d(4, 6, 2), GOLD, 'cut-32')             # u = 4 px: slit 4 px on the grid, door 20 x 28

# (b) favicon-32.png: the 32 cut alone on its tile
artboard('px32', 100, 0, 32, 32)
rect(100, 0, 32, 32, FOREST, 6, 'tile')
path(door_d(4, 106, 2), GOLD, 'door')

# (c) favicon-16.png: the hinted pixel map on its tile (rx 3, half the 32's)
artboard('px16', 200, 0, 16, 16)
rect(200, 0, 16, 16, FOREST, 3, 'tile')
path(door16_d(200, 0), GOLD, 'door')
path(shoulders16_d(200, 0), GOLD, 'shoulders'); cmd('object.setProps', {'opacity': SHOULDER_OPACITY})

# (d) full-bleed opaque tiles, each drawn on its own whole-pixel module (not downsampled)
FULL = {}
def full_tile(n, x, y, T, u):
    artboard(n, x, y, T, T)
    rect(x, y, T, T, FOREST, None, 'tile')
    ox, oy = place(T, u)
    path(door_d(u, x + ox, y + oy), GOLD, 'door')
    FULL[n] = dict(T=T, u=u, ox=ox, oy=oy)
full_tile('apple', 0, 200, 180, 20)          # apple-touch-icon: door 100 x 140 (iOS rounds the corners itself)
full_tile('app192', 300, 200, 192, 20)       # manifest 192: door 100 x 140
full_tile('app512', 0, 600, 512, 56)         # manifest 512: the master, door 280 x 392 (u = 56, as the mark)
full_tile('maskable', 600, 600, 512, 48)     # maskable: u = 48 (0.857 of the master), every ink pixel in r = 204.8

# (e) mark.svg: the bare door, transparent, with 1u of clear space all round (the gap measures it)
artboard('glyph', 1200, 600, 56, 72)
path(door_d(8, 1208, 608), FOREST, 'door')   # fill becomes currentColor after export (step 3)

cmd('select.none')
cmd('document.inspect', {'depth': 3})

# ── exports ──
def svg(fname, n, expect):
    cmd('select.allOnArtboard', {'artboard': ab[n]}); expect_selection(expect, fname)
    cmd('document.export', {'path': f'{KIT}/{fname}', 'format': 'svg', 'artboard': ab[n], 'selectedOnly': True})
def png(fname, n):
    cmd('document.export', {'path': f'{KIT}/{fname}', 'artboard': ab[n], 'scale': 1})
svg('work/favicon-raw.svg', 'favicon', 3)
svg('work/mark-raw.svg', 'glyph', 1)
svg('work/icon-512.svg', 'app512', 2)
svg('work/icon-maskable-512.svg', 'maskable', 2)
cmd('select.none')
png('favicon-32.png', 'px32')
png('favicon-16.png', 'px16')
png('apple-touch-icon.png', 'apple')
png('icon-192.png', 'app192')
png('icon-512.png', 'app512')
png('icon-maskable-512.png', 'maskable')
A.extend(['--export', f'{KIT}/mark.vectorcraft'])

r = subprocess.run(['vectorcraft-cli', 'run'] + A, capture_output=True, text=True)
open(f'{KIT}/work/vectorcraft-run.log', 'w').write(r.stdout + r.stderr)
if r.returncode != 0:
    sys.exit('vectorcraft failed: ' + r.stderr[-800:])
steps = [json.loads(l) for l in r.stdout.splitlines() if l.startswith('{')]
for i, n, label in CHECKS:
    sel = steps[i]['result']['selection']
    assert len(sel) == n, f'{label}: selection is {sel}, expected {n} objects'
json.dump(FULL, open(f'{KIT}/work/placement.json', 'w'), indent=1, sort_keys=True)
print(f'vectorcraft: {nsteps()} commands, exit 0; selections {[(l, n) for _, n, l in CHECKS]}')
PY

# ── 2. favicon.svg = the VectorCraft export + ONE hand-written <style> block (nothing else) ──
# ── 3. mark.svg    = the VectorCraft export with its one fill set to currentColor ─────────────
python3 - "$KIT" <<'PY'
import sys
K = sys.argv[1]
raw = open(f'{K}/work/favicon-raw.svg', encoding='utf-8').read()
style = ('<style>\n'
         '    /* drawn at 22 px or less (a 16 px tab): the hand-hinted 16 px cut; larger: the 32 px cut */\n'
         '    #cut-16{display:none}\n'
         '    @media (max-width:22px){#cut-32{display:none}#cut-16{display:inline}}\n'
         '  </style>\n  ')
assert raw.count('<g id="artbitrage"') == 1 and raw.count('id="cut-16"') == 1 and raw.count('id="cut-32"') == 1 \
    and raw.count('id="tile"') == 1 and '<style' not in raw, 'unexpected favicon export'
open(f'{K}/favicon.svg', 'w', encoding='utf-8').write(raw.replace('<g id="artbitrage"', style + '<g id="artbitrage"', 1))

raw = open(f'{K}/work/mark-raw.svg', encoding='utf-8').read()
assert raw.count('fill=') == 1 and raw.count('fill="#17271f"') == 1, 'mark export should carry exactly one fill'
open(f'{K}/mark.svg', 'w', encoding='utf-8').write(raw.replace('fill="#17271f"', 'fill="currentColor"'))
print('favicon.svg: style block inserted; mark.svg: fill="currentColor"')
PY

# ── 4. favicon.ico — PhotoCraft (one 32 x 32 frame; v0.5.0 cannot write more) ────────────────
photocraft-cli run "$KIT/favicon-32.png" --out "$KIT/favicon.ico" > work/photocraft-run.log 2>&1

# ── 5. manifest + head snippet (site.webmanifest, never manifest.json) ───────────────────────
cat > site.webmanifest <<'JSON'
{
  "name": "Artbitrage — a place to meet art",
  "short_name": "Artbitrage",
  "start_url": "/",
  "display": "browser",
  "theme_color": "#17271f",
  "background_color": "#17271f",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
JSON
cat > head-snippet.html <<'HTML'
<!-- 閒 the gap: the artbitrage.io icon. Every file sits at the site root. /manifest.json stays the philosophy document. -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#17271f">
HTML

# ── 6. prove it ───────────────────────────────────────────────────────────────────────────────
for f in "${OUTS[@]}"; do [ -s "$f" ] || { echo "MISSING $f"; exit 1; }; done
python3 - "$KIT" "$SRC" <<'PY'
import json, math, re, struct, sys, zlib
K, SRC = sys.argv[1], sys.argv[2]
FOREST, GOLD = (0x17, 0x27, 0x1f), (0xdb, 0xcc, 0xa7)

def png_px(data):
    """stdlib PNG decoder (8-bit RGB/RGBA, not interlaced) -> (w, h, mode, rows of RGBA tuples)"""
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    i, idat = 8, b''
    while i < len(data):
        n, = struct.unpack('>I', data[i:i + 4]); t = data[i + 4:i + 8]; body = data[i + 8:i + 8 + n]; i += 12 + n
        if t == b'IHDR': w, h, depth, ctype, _, _, inter = struct.unpack('>IIBBBBB', body)
        elif t == b'IDAT': idat += body
    assert depth == 8 and inter == 0 and ctype in (2, 6), (depth, ctype, inter)
    bpp = 3 if ctype == 2 else 4; stride = w * bpp
    raw = zlib.decompress(idat); prev = bytearray(stride); p = 0; rows = []
    for _ in range(h):
        f = raw[p]; ln = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        for x in range(stride):
            a = ln[x - bpp] if x >= bpp else 0; up = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1:   ln[x] = (ln[x] + a) & 255
            elif f == 2: ln[x] = (ln[x] + up) & 255
            elif f == 3: ln[x] = (ln[x] + (a + up) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(up - c), abs(a - c), abs(a + up - 2 * c)
                ln[x] = (ln[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        rows.append(ln); prev = ln
    px = [[tuple(r[x * bpp:x * bpp + 3]) + ((r[x * bpp + 3],) if bpp == 4 else (255,)) for x in range(w)] for r in rows]
    return w, h, ('RGB' if ctype == 2 else 'RGBA'), px
def load(p): return png_px(open(p, 'rb').read())
def gold_t(rgb):
    """how far a colour lies from forest toward gold (0..1); None if it is off that line (not a token blend)"""
    t = (rgb[0] - FOREST[0]) / (GOLD[0] - FOREST[0])
    ok = all(abs(rgb[i] - (FOREST[i] + t * (GOLD[i] - FOREST[i]))) <= 2 for i in range(3)) and -0.01 <= t <= 1.01
    return t if ok else None

# 1. sizes, modes, and every pixel a site token (forest, gold, or the anti-aliased line between them)
want = {'favicon-16.png': (16, 'RGBA'), 'favicon-32.png': (32, 'RGBA'), 'apple-touch-icon.png': (180, 'RGB'),
        'icon-192.png': (192, 'RGB'), 'icon-512.png': (512, 'RGB'), 'icon-maskable-512.png': (512, 'RGB')}
IMG = {}
for f, (s, mode) in want.items():
    w, h, m, px = IMG[f] = load(f'{K}/{f}')
    assert (w, h, m) == (s, s, mode), (f, w, h, m)
    # a tile-corner pixel at partial alpha must be forest once premultiplied (VectorCraft writes the
    # colour of an alpha-1 pixel as white; it adds under one level to whatever is behind)
    corner_ok = lambda p: p[3] < 255 and max(abs(p[i] - FOREST[i]) for i in range(3)) * p[3] / 255 <= 1.5
    off = [(x, y, px[y][x]) for y in range(h) for x in range(w)
           if px[y][x][3] and gold_t(px[y][x]) is None and not corner_ok(px[y][x])]
    assert not off, f'{f}: {len(off)} pixels are not forest/gold blends, e.g. {off[:3]}'
    inks = sum(1 for row in px for p in row if p[3] == 255 and gold_t(p) > 0.01)
    print(f'  {f:24s} {w}x{h} {m:4s}  every pixel forest/gold (or their blend); {inks} ink px')

# 2. the 16 and 32 cuts are the winning mark's, pixel for pixel
for kit, src, tol in (('favicon-32.png', 'dark-32.png', 0), ('favicon-16.png', 'dark-16.png', 1)):
    a, b = IMG[kit][3], load(f'{SRC}/{src}')[3]
    d = max(abs(p - q) for ra, rb in zip(a, b) for pa, pb in zip(ra, rb) for p, q in zip(pa, pb))
    assert d <= tol, f'{kit} differs from ../marks/gap/{src} by {d} levels'
    print(f'  {kit:24s} = ../marks/gap/{src} (max channel difference {d})')

# 3. the 512 master is the winning mark's geometry, only lifted by the optical placement
P = json.load(open(f'{K}/work/placement.json'))
def door_nums(svgfile):
    d = re.search(r'id="door" d="([^"]+)"', open(svgfile, encoding='utf-8').read()).group(1)
    return re.sub(r'[-0-9.]+', '#', d), [float(v) for v in re.findall(r'-?[0-9.]+', d)]
shape_k, nk = door_nums(f'{K}/work/icon-512.svg'); shape_s, ns = door_nums(f'{SRC}/mark-dark.svg')
lift = 60 - P['app512']['oy']
assert shape_k == shape_s and len(nk) == len(ns), 'door path structure differs from the source mark'
dev = max(abs(k - (s - (lift if i % 2 else 0))) for i, (k, s) in enumerate(zip(nk, ns)))
assert dev < 0.002, f'512 door deviates from ../marks/gap/mark-dark.svg by {dev}'
print(f'  icon-512 door             = ../marks/gap/mark-dark.svg door, lifted {lift} px (max deviation {dev:.4f})')

# 4. optical placement held: the measured ink centroid is where the module predicts
for f, n in (('icon-512.png', 'app512'), ('icon-maskable-512.png', 'maskable'), ('icon-192.png', 'app192'),
             ('apple-touch-icon.png', 'apple')):
    px = IMG[f][3]; p = P[n]; sw = sy = 0.0
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            t = gold_t(c); sw += t; sy += t * (y + .5)
    cy = sy / sw; box = p['oy'] + 3.5 * p['u']; pred = box + 0.1672 * p['u']
    assert abs(cy - pred) < 0.6, f'{f}: ink centroid y {cy:.2f}, predicted {pred:.2f}'
    print(f'  {f:24s} ink centroid y {cy:.2f} (box centre {box:.1f}, tile centre {p["T"] / 2:.1f}; '
          f'halfway {(box + cy) / 2:.2f})')

# 5. maskable: every ink pixel (any trace of gold) lies wholly inside the 80% safe circle
px = IMG['icon-maskable-512.png'][3]; worst = 0.0
for y, row in enumerate(px):
    for x, c in enumerate(row):
        if gold_t(c) > 0.004:                       # anything not pure forest
            far = max(math.hypot(cx - 256, cy - 256) for cx in (x, x + 1) for cy in (y, y + 1))
            worst = max(worst, far)
assert worst <= 204.8, f'maskable: an ink pixel reaches r = {worst:.2f} > 204.8'
print(f'  icon-maskable-512.png    farthest ink pixel corner r = {worst:.2f} <= 204.8 (80% safe circle)')
for f in ('icon-512.png',):
    px = IMG[f][3]
    far = max(math.hypot(cx - 256, cy - 256) for y, row in enumerate(px) for x, c in enumerate(row) if gold_t(c) > 0.004
              for cx in (x, x + 1) for cy in (y, y + 1))
    print(f'  {f:24s} (purpose any) farthest ink r = {far:.2f}: not maskable-safe, by design')

# 6. vectors: no type, no strokes, only token fills; the adaptive favicon and the currentColor mark
for f in ('favicon.svg', 'mark.svg'):
    s = open(f'{K}/{f}', encoding='utf-8').read()
    assert '<text' not in s and 'stroke=' not in s and 'font-family' not in s, f + ': text or stroke left in'
    fills = set(re.findall(r'fill="([^"]+)"', s))
    assert fills <= {'#17271f', '#dbcca7', 'currentColor'}, (f, fills)
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    print(f'  {f:24s} viewBox {vb}, fills {sorted(fills)}, {len(s.encode())} bytes')
fav = open(f'{K}/favicon.svg', encoding='utf-8').read()
assert fav.count('<style>') == 1 and fav.count('@media (max-width:22px)') == 1
assert re.search(r'<g id="cut-16">\s*<path id="door-16"[^>]*fill="#dbcca7"/>\s*<path id="shoulders-16"[^>]*fill="#dbcca7" opacity="0.45"/>', fav)
assert fav.index('id="tile"') < fav.index('id="cut-16"') and fav.index('id="tile"') < fav.index('id="cut-32"')
mk = open(f'{K}/mark.svg', encoding='utf-8').read()
assert mk.count('<path') == 1 and mk.count('fill="currentColor"') == 1 and 'viewBox="0 0 56 72"' in mk

# 7. manifest, ico, head snippet
m = json.load(open(f'{K}/site.webmanifest', encoding='utf-8'))
assert m['name'] == 'Artbitrage — a place to meet art' and m['short_name'] == 'Artbitrage' and m['start_url'] == '/'
assert m['display'] == 'browser' and m['theme_color'] == m['background_color'] == '#17271f'
for ic in m['icons']:
    w, h, mode, _ = IMG[ic['src'].lstrip('/')]
    assert ic['sizes'] == f'{w}x{h}' and ic['type'] == 'image/png' and ic['purpose'] in ('any', 'maskable'), ic
print(f'  site.webmanifest         {len(m["icons"])} icons, sizes match the files')
ico = open(f'{K}/favicon.ico', 'rb').read(); n = struct.unpack('<H', ico[4:6])[0]
w, h = ico[6] or 256, ico[7] or 256; size, off = struct.unpack('<II', ico[14:22])
iw, ih, _, ipx = png_px(ico[off:off + size])
same = ipx == IMG['favicon-32.png'][3]
assert n == 1 and (w, h, iw, ih) == (32, 32, 32, 32) and same, (n, w, h, iw, ih, same)
print(f'  favicon.ico              {n} frame, {w}x{h} PNG, pixels identical to favicon-32.png')
head = open(f'{K}/head-snippet.html', encoding='utf-8').read()
hrefs = re.findall(r'href="/([^"]+)"', head)
import os
assert all(os.path.isfile(f'{K}/{h}') for h in hrefs) and 'manifest.json' not in hrefs, hrefs
assert 'content="#17271f"' in head
print(f'  head-snippet.html        {len(hrefs)} links, every href is a file in this kit')
PY
for f in favicon-16.png favicon-32.png apple-touch-icon.png icon-192.png icon-512.png icon-maskable-512.png; do
  printf '  sips %-24s %s x %s\n' "$f" "$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')" "$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')"
done

# ── 7. review sheets (inspection only; never a deliverable, never a reason to fail the build) ─
if [ -f work/browser-check.cjs ] && command -v node >/dev/null; then node work/browser-check.cjs "$KIT" || echo "browser check skipped"; fi
if [ -f work/review.py ]; then python3 work/review.py "$KIT" || echo "review sheets skipped"; fi
echo "built: ${OUTS[*]}"
