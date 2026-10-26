#!/usr/bin/env bash
# Downloads every candidate font in candidates.json from Google Fonts as TTF (a non-browser user agent gets TTF).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ttf
node -e "for (const c of require('./candidates.json')) console.log([c.family.replace(/ /g,'+'), c.wght, c.file].join('\t'))" | sort -u |
while IFS=$'\t' read -r fam w file; do
  [ -s "ttf/$file" ] && continue
  url=$(curl -sS -m 30 "https://fonts.googleapis.com/css2?family=${fam}:wght@${w}&display=swap" | grep -o 'https://[^)]*\.ttf' | head -1)
  [ -n "$url" ] && curl -sS -m 60 -o "ttf/$file" "$url" && echo "fetched $file" || echo "FAILED $fam $w"
done
