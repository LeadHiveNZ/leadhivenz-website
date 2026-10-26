#!/usr/bin/env bash
# Self-host the two Google Fonts used by the site (latin subset, variable weight axis).
# Outfit (display, 500-700) and Inter (body, 400-700). Re-run only if you change families/weights.
# A modern Chrome UA is required so Google serves woff2.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../site/assets/fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
mkdir -p "$OUT"
css=$(curl -sSL -A "$UA" "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap")
# Pick the latin-subset file for each family (same file serves every weight: it is a variable font).
for fam in Inter Outfit; do
  url=$(printf '%s' "$css" | awk -v fam="$fam" '
    /\/\* latin \*\//{latin=1; next}
    /\/\* /{latin=0}
    latin && $0 ~ "font-family: .?"fam"[^ ]?;" {hit=1}
    latin && hit && /src: url\(/ { match($0, /https:[^)]+\.woff2/); print substr($0, RSTART, RLENGTH); exit }')
  [ -n "$url" ] || { echo "no latin woff2 found for $fam" >&2; exit 1; }
  lc=$(echo "$fam" | tr 'A-Z' 'a-z')
  curl -sSL "$url" -o "$OUT/$lc-latin.woff2"
  echo "$fam -> $OUT/$lc-latin.woff2 ($(wc -c < "$OUT/$lc-latin.woff2") bytes) from $url"
done
