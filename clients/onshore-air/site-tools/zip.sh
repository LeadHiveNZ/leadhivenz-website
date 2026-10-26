#!/usr/bin/env bash
# Builds the Netlify drag-and-drop zip with index.html at the zip root.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/onshore-air-site.zip
(cd site && zip -r -X -q ../dist/onshore-air-site.zip . -x '.DS_Store' -x '*/.DS_Store')
unzip -l dist/onshore-air-site.zip | awk 'NR<=4 || /index.html|404.html|netlify.toml|_redirects/ ; END {print}'
echo "zip size: $(du -h dist/onshore-air-site.zip | cut -f1) ($(stat -c %s dist/onshore-air-site.zip) bytes)"
