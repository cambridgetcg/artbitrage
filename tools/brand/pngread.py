"""Minimal stdlib PNG reader (8-bit, non-interlaced, gray/RGB/RGBA/palette-less) for verification."""
import struct, zlib

def read(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos, idat, w = 8, [], None
    while pos < len(data):
        n, t = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if t == b'IHDR':
            w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', body)
            assert bd == 8 and il == 0, (bd, il)
        elif t == b'IDAT':
            idat.append(body)
        elif t == b'IEND':
            break
        pos += 12 + n
    ch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(b''.join(idat))
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f == 1:
            for x in range(ch, stride): line[x] = (line[x] + line[x - ch]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]; c = prev[x - ch] if x >= ch else 0
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, bytes(out)

def rgb_at(img, x, y):
    w, h, ch, px = img
    o = (y * w + x) * ch
    return tuple(px[o:o + 3]) if ch >= 3 else (px[o],) * 3

def region_equal(big, small, x0, y0):
    """True and 0 if small's RGB equals big's RGB at offset; else (False, max diff, n diff)."""
    bw, bh, bc, bp = big
    sw, sh, sc, sp = small
    md, nd = 0, 0
    for y in range(sh):
        for x in range(sw):
            so = (y * sw + x) * sc
            bo = ((y + y0) * bw + x + x0) * bc
            for k in range(3):
                d = abs(sp[so + k] - bp[bo + k])
                if d:
                    nd += 1
                    md = max(md, d)
    return nd == 0, md, nd
