#!/bin/bash
# Live, read-only: each of the five retired trap rooms answers 410 within 1 s
# with its one line and a stated length (no drip, no held socket), and
# robots.txt no longer Disallows them or mentions the tarpit.
# Usage: check-trap-rooms.sh [room ...]   (default: the five rooms)
set -u
BASE="${BASE:-https://artbitrage.io}"
UA='kingdom-door-check/0.1 (+https://github.com/cambridgetcg/cambridgetcg.github.io)'
LINE='A trap room stood here; retired October 2026. Nothing is here. The site is at /.'
ROOMS=(/lost /treasury /wallet-backup /investor-relations/private /internal/pricing-model)
[ "$#" -gt 0 ] && ROOMS=("$@")
fail=0
tmp="$(mktemp -d)"
for p in "${ROOMS[@]}"; do
  : >"$tmp/body"; : >"$tmp/hdr"
  out="$(curl -sS -A "$UA" -o "$tmp/body" -D "$tmp/hdr" --max-time 3 \
    -w '%{http_code} %{time_total} %{size_download}' "$BASE$p" 2>/dev/null)"
  read -r code t size <<<"${out:-000 3 0}"
  clen="$(grep -i '^content-length:' "$tmp/hdr" | tr -d '\r' | awk '{print $2}')"
  body="$(cat "$tmp/body")"
  if [ "$code" = 410 ] && awk "BEGIN{exit !($t < 1.0)}" && [ "$body" = "$LINE" ] && [ "${clen:-}" = "$size" ]; then
    echo "PASS $p 410 ${t}s ${size}B content-length=$clen"
  else
    echo "FAIL $p code=$code t=${t}s size=$size content-length=${clen:-none}"; fail=1
  fi
done
rm -rf "$tmp"
python3 -I - "$BASE" "$UA" <<'PY' || fail=1
import sys, time, urllib.request, urllib.robotparser
base, ua = sys.argv[1], sys.argv[2]
rooms = ['/lost', '/treasury', '/wallet-backup', '/investor-relations/private', '/internal/pricing-model']
req = urllib.request.Request(f'{base}/robots.txt?kdc={int(time.time())}', headers={'User-Agent': ua})
text = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
rp = urllib.robotparser.RobotFileParser(); rp.parse(text.splitlines())
parsed = [p for p in rooms if not rp.can_fetch('*', base + p)]
# Raw lines too: older robotparsers apply rules first-match-wins, so "Allow: /" first would hide them.
raw = [p for p in rooms if any(l.split(':', 1)[0].strip().lower() == 'disallow' and l.split(':', 1)[1].strip() == p
                               for l in text.splitlines() if ':' in l)]
bad = sorted(set(parsed) | set(raw), key=rooms.index)
flagged = 'flypaper' in text.lower() or 'tarpit' in text.lower()
if bad or flagged:
    print(f"FAIL robots.txt: still Disallowed {bad}; flypaper text present={flagged}"); sys.exit(1)
print('PASS robots.txt: no Disallow for the five rooms, no flypaper text')
PY
[ "$fail" = 0 ] && echo "ALL PASS" || { echo "SOME FAIL"; exit 1; }
