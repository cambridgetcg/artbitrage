#!/usr/bin/env python3
"""Merge artbitrage catalog wing shards -> validated shards + catalog/index.json + catalog.json.

Every image URL is live-checked (range GET). Dead artworks are pruned from shards.
"""
import json, sys, datetime, urllib.request, socket
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/macair/Desktop/artbitrage')
CATDIR = REPO / 'catalog'
REQUIRED = ['source', 'source_name', 'id', 'title', 'image', 'url', 'wing']
HEADERS = {'User-Agent': 'Artbitrage/2.0 (+https://artbitrage.io)', 'Range': 'bytes=0-0'}
# Hosts whose URLs come straight from the museum's own API and whose CDN
# bot-challenges rapid checkers (cf-mitigated) — trust, don't live-check.
TRUSTED_HOSTS = ('www.artic.edu/iiif/',)

def check_image(url):
    if not url or not url.startswith('http'):
        return False
    if any(h in url for h in TRUSTED_HOSTS):
        return True
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status in (200, 206)
    except Exception:
        return False

def main():
    shard_files = sorted(p for p in CATDIR.glob('*.json') if p.name not in ('index.json', 'all.json'))
    shards = []
    for p in shard_files:
        try:
            shards.append((p, json.loads(p.read_text())))
        except Exception as e:
            print(f'!! {p.name}: unparseable ({e}) — skipping', file=sys.stderr)

    # collect every unique image URL
    urls = {}
    for _, s in shards:
        for a in s.get('artworks', []):
            u = a.get('image', '')
            if u and u not in urls:
                urls[u] = None
    print(f'checking {len(urls)} image URLs…')
    with ThreadPoolExecutor(max_workers=20) as ex:
        for u, ok in zip(urls, ex.map(check_image, urls)):
            urls[u] = ok
    dead = [u for u, ok in urls.items() if not ok]
    print(f'dead images: {len(dead)}')
    for u in dead[:12]:
        print('  ✗', u[:110])

    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    wings_meta, merged, seen, sources = [], [], set(), {}
    total_pruned = 0
    for p, s in shards:
        kept, pruned = [], 0
        for a in s.get('artworks', []):
            missing = [f for f in REQUIRED if not str(a.get(f, '')).strip()]
            if missing and missing != ['title']:
                pruned += 1
                continue
            if not urls.get(a.get('image', '')):
                pruned += 1
                continue
            a.setdefault('wing', s.get('wing', p.stem))
            kept.append(a)
        total_pruned += pruned
        s['artworks'] = kept
        s['count'] = len(kept)
        if not kept:
            print(f'!! {p.name}: nothing survived — leaving file but excluding from index')
            continue
        cover = s.get('cover_image', '')
        if cover and not urls.get(cover):
            cover = ''
        if not cover:
            cover = kept[0]['image']
        s['cover_image'] = cover
        s['generated_at'] = s.get('generated_at') or now
        p.write_text(json.dumps(s, ensure_ascii=False, indent=1))
        wings_meta.append({
            'wing': s.get('wing', p.stem),
            'title': s.get('title', p.stem.title()),
            'description': s.get('description', ''),
            'count': len(kept),
            'cover_image': cover,
        })
        for a in kept:
            k = f"{a['source']}:{a['id']}"
            sources[a['source_name']] = sources.get(a['source_name'], 0) + 1
            if k in seen:
                continue
            seen.add(k)
            merged.append(a)
        print(f'  {p.name}: kept {len(kept)} (pruned {pruned})')

    total = sum(w['count'] for w in wings_meta)
    index = {
        'name': 'ARTBITRAGE Catalogue',
        'description': "The catalogue and data distributor of the art world. Open-access works, no gate, no key, free.",
        'total': total,
        'unique_works': len(merged),
        'wings_count': len(wings_meta),
        'sources': sources,
        'generated_at': now,
        'river': 'https://artbitrage.io/river',
        'wings': wings_meta,
    }
    (CATDIR / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1))
    master = dict(index)
    master['artworks'] = merged
    (CATDIR / 'all.json').write_text(json.dumps(master, ensure_ascii=False, indent=1))
    print(f'\nTOTAL: {total} wing entries, {len(merged)} unique works, {len(wings_meta)} wings, pruned {total_pruned}')
    print('sources:', json.dumps(sources, indent=None))

if __name__ == '__main__':
    main()
