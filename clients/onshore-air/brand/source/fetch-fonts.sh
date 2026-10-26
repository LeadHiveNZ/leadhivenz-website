#!/usr/bin/env bash
# Downloads the Google Fonts (SIL OFL) TTFs used by the three concepts into ./fonts (not committed).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p fonts
get() { # family css-name, weight, output file
  local url; url=$(curl -sSL -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=$1:wght@$2&display=swap" | grep -oE 'https://fonts.gstatic.com/[^)]+\.ttf' | head -1)
  curl -sSL -o "fonts/$3" "$url"; echo "fonts/$3"
}
get Outfit 800 Outfit-800.ttf;            get Outfit 600 Outfit-600.ttf
get Sora 700 Sora-700.ttf;                get Sora 600 Sora-600.ttf
get Red+Hat+Display 900 RedHatDisplay-900.ttf; get Red+Hat+Display 700 RedHatDisplay-700.ttf
