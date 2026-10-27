#!/usr/bin/env bash
# Self-host the two Google Fonts used by the site (latin subset, woff2, static weights):
#   Barlow Condensed 700 (H1/H2 in caps, big phone numbers, prices, "5.0") and 600 (small caps labels, nav)
#   Barlow 400, 600, 700 (body, H3, buttons, UI)
# A modern Chrome UA is required so Google serves woff2.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../site/assets/fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
mkdir -p "$OUT"
latin_url() { # $1 = css, $2 = font-weight
  printf '%s' "$1" | awk -v wt="$2" '
    /\/\* latin \*\//{latin=1; next} /\/\* /{latin=0}
    latin && $0 ~ "font-weight: "wt";" {hit=1}
    latin && hit && /src: url\(/ { match($0, /https:[^)]+\.woff2/); print substr($0, RSTART, RLENGTH); exit }'
}
barlow=$(curl -sSL -A "$UA" "https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap")
cond=$(curl -sSL -A "$UA" "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap")
for pair in \
  "barlow-400-latin.woff2|$(latin_url "$barlow" 400)" \
  "barlow-600-latin.woff2|$(latin_url "$barlow" 600)" \
  "barlow-700-latin.woff2|$(latin_url "$barlow" 700)" \
  "barlow-condensed-600-latin.woff2|$(latin_url "$cond" 600)" \
  "barlow-condensed-700-latin.woff2|$(latin_url "$cond" 700)"; do
  file=${pair%%|*}; url=${pair#*|}
  [ -n "$url" ] || { echo "no latin woff2 for $file" >&2; exit 1; }
  curl -sSL "$url" -o "$OUT/$file"
  echo "$file $(wc -c < "$OUT/$file") bytes  <- $url"
done
