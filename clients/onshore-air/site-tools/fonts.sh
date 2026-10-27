#!/usr/bin/env bash
# Self-host the two Google Fonts used by the site (latin subset, woff2):
#   Bricolage Grotesque (display: headings, phone numbers, prices, "5.0", numbers), variable opsz 12-96 and wght 400-800,
#             with the wdth axis pinned at 100 in the download (halves the file size). It has no italic.
#   Instrument Sans (body/UI; its italic carries captions and quotes), roman + italic, variable wght 400-700
# A modern Chrome UA is required so Google serves woff2.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../site/assets/fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
mkdir -p "$OUT"
latin_url() { # $1 = css, $2 = font-style
  printf '%s' "$1" | awk -v st="$2" '
    /\/\* latin \*\//{latin=1; next} /\/\* /{latin=0}
    latin && $0 ~ "font-style: "st";" {hit=1}
    latin && hit && /src: url\(/ { match($0, /https:[^)]+\.woff2/); print substr($0, RSTART, RLENGTH); exit }'
}
bg=$(curl -sSL -A "$UA" "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,100,400..800&display=swap")
is=$(curl -sSL -A "$UA" "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap")
for pair in "bricolage-grotesque-latin.woff2|$(latin_url "$bg" normal)" "instrument-sans-latin.woff2|$(latin_url "$is" normal)" "instrument-sans-italic-latin.woff2|$(latin_url "$is" italic)"; do
  file=${pair%%|*}; url=${pair#*|}
  [ -n "$url" ] || { echo "no latin woff2 for $file" >&2; exit 1; }
  curl -sSL "$url" -o "$OUT/$file"
  echo "$file $(wc -c < "$OUT/$file") bytes  <- $url"
done
