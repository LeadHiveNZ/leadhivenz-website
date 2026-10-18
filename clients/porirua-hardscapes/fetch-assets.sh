#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Porirua Hardscapes: pull images (and page HTML) from the OLD website.
#
# Not run in the build session: that environment's network policy blocked
# poriruahardscapes.co.nz / .com and facebook.com. Run it on any machine with
# normal internet access:
#
#   cd clients/porirua-hardscapes
#   bash fetch-assets.sh
#
# What it does
#   1. Downloads every known page of the old site (both domains) with curl into
#      assets/img/_from-old-site/_pages/  (keep these: the verbatim testimonials,
#      partner names and sponsorship copy are in them).
#   2. Greps every image URL out of them: <img src>, data-src, srcset, og:image,
#      CSS background-image url(...), plus Wix (static.wixstatic.com) and
#      Squarespace (images.squarespace-cdn.com) CDN patterns. Wix URLs are
#      rewritten to the original full-size file (transform suffix stripped).
#   3. Downloads each unique image into assets/img/_from-old-site/.
#   4. Prints a manifest (also saved as _from-old-site/manifest.tsv):
#      local file · size · dimensions · page it came from · source URL.
#
# Then: open the folder, pick the good shots, and RENAME/COPY them into the
# placeholder paths listed in README.md ("Photo and logo drop-in"). A photo
# appears on the site as soon as a file exists at its path. Do not commit
# _from-old-site/ to the live build.
# ---------------------------------------------------------------------------
set -uo pipefail   # no -e: grep returns 1 when a pattern has no matches

cd "$(dirname "$0")"
OUT="assets/img/_from-old-site"
PAGES="$OUT/_pages"
mkdir -p "$OUT" "$PAGES"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# Known URLs of the old site (from Google's index, Oct 2026). Add any you find.
SLUGS=(
  ""
  "concrete-services-wellington"
  "retaining-wall-construction-wellington"
  "landscaping-services-wellington"
  "excavator-hire-services-wellington"
  "construction-demolition-services-wellington"
  "fencing-services-wellington"
  "new-landscaping-projects-wellington"
  "landscaping-and-construction-quotes"
  "about" "about-us" "contact" "contact-us" "gallery" "projects" "testimonials" "reviews"
)
HOSTS=("https://www.poriruahardscapes.co.nz" "https://www.poriruahardscapes.com")

URLLIST="$OUT/.urls.tsv"       # page<TAB>imageURL
: > "$URLLIST"

extract() {  # $1 = html file, $2 = page url ; prints image URLs, one per line
  local f="$1" base="$2"
  {
    # src / data-src / data-lazy-src / content (og:image) / href to image files
    grep -oiE '(src|data-src|data-lazy-src|data-original|content|href)="[^"]+\.(jpe?g|png|webp|gif|svg|avif)[^"]*"' "$f" \
      | sed -E 's/^[a-zA-Z-]+="//; s/"$//'
    # srcset: split comma-separated candidates, keep the URL part
    grep -oiE 'srcset="[^"]+"' "$f" | sed -E 's/^srcset="//; s/"$//' | tr ',' '\n' | awk '{print $1}'
    # CSS background-image: url(...)
    grep -oiE 'url\((&quot;|["'"'"'])?[^)"'"'"'&]+\.(jpe?g|png|webp|gif|svg|avif)[^)"'"'"'&]*' "$f" \
      | sed -E "s/^url\((&quot;|[\"'])?//"
    # Wix CDN (also catches URLs buried in JSON blobs)
    grep -oE 'https?:\\?/\\?/static\.wixstatic\.com\\?/media\\?/[A-Za-z0-9_~.%-]+' "$f" | sed 's#\\/#/#g'
    grep -oE '"uri":"[A-Za-z0-9_]+~mv2\.[a-z]+"' "$f" | sed -E 's/^"uri":"//; s/"$//; s#^#https://static.wixstatic.com/media/#'
    # Squarespace CDN
    grep -oE 'https?://images\.squarespace-cdn\.com/[^"'"'"' )?]+' "$f"
  } | sed -E 's/&amp;/\&/g' \
    | while read -r u; do
        [ -z "$u" ] && continue
        case "$u" in
          data:*) continue ;;
          //*)    u="https:$u" ;;
          /*)     u="${base%%/}$u" ;;
          http*)  ;;
          *)      u="${base%%/}/$u" ;;
        esac
        # Wix: strip /v1/fill/... transform to get the original upload
        if [[ "$u" == *static.wixstatic.com/media/* ]]; then
          u="$(echo "$u" | sed -E 's#(static\.wixstatic\.com/media/[^/]+)/v1/.*#\1#')"
        fi
        # Squarespace: request the large original
        if [[ "$u" == *images.squarespace-cdn.com* ]]; then
          u="${u%%\?*}?format=2500w"
        fi
        echo "$u"
      done
}

echo "== 1/3  Downloading pages"
for host in "${HOSTS[@]}"; do
  hname="$(echo "$host" | sed -E 's#https?://##; s#[^A-Za-z0-9]+#_#g')"
  for slug in "${SLUGS[@]}"; do
    url="$host/$slug"
    file="$PAGES/${hname}__${slug:-home}.html"
    code="$(curl -sSL -A "$UA" --max-time 30 -o "$file" -w '%{http_code}' "$url" || echo 000)"
    if [ "$code" != "200" ] || [ ! -s "$file" ]; then
      rm -f "$file"; printf '   %s  %s\n' "$code" "$url"; continue
    fi
    printf '   200  %s\n' "$url"
    # discover more internal pages linked from this one (same host, no assets)
    grep -oE 'href="(/|'"$host"'/)[a-z0-9-]+/?"' "$file" \
      | sed -E 's#href="##; s#"$##; s#^'"$host"'##; s#^/##; s#/$##' >> "$OUT/.discovered" || true
    extract "$file" "$host" | while read -r img; do printf '%s\t%s\n' "$url" "$img"; done >> "$URLLIST"
  done
done

# second pass over pages discovered via links
if [ -s "$OUT/.discovered" ]; then
  sort -u "$OUT/.discovered" | while read -r slug; do
    printf '%s\n' "${SLUGS[@]}" | grep -qx "$slug" && continue
    host="${HOSTS[0]}"; url="$host/$slug"; file="$PAGES/discovered__${slug}.html"
    code="$(curl -sSL -A "$UA" --max-time 30 -o "$file" -w '%{http_code}' "$url" || echo 000)"
    if [ "$code" = "200" ] && [ -s "$file" ]; then
      printf '   200  %s (discovered)\n' "$url"
      extract "$file" "$host" | while read -r img; do printf '%s\t%s\n' "$url" "$img"; done >> "$URLLIST"
    else rm -f "$file"; fi
  done
fi

echo "== 2/3  Downloading images"
MANIFEST="$OUT/manifest.tsv"
printf 'file\tbytes\tdimensions\tfound_on\tsource_url\n' > "$MANIFEST"
sort -u -t$'\t' -k2,2 "$URLLIST" | while IFS=$'\t' read -r page img; do
  name="$(basename "${img%%\?*}")"
  name="$(echo "$name" | sed -E 's/[^A-Za-z0-9._~-]+/_/g')"
  [ -z "$name" ] && name="image"
  # keep names unique
  dest="$OUT/$name"; n=1
  while [ -e "$dest" ]; do dest="$OUT/${n}_$name"; n=$((n+1)); done
  if curl -sSL -A "$UA" --max-time 60 -o "$dest" "$img" && [ -s "$dest" ]; then
    # drop anything that is not actually an image (HTML error pages etc.)
    if command -v file >/dev/null && ! file -b --mime-type "$dest" | grep -q '^image/'; then
      rm -f "$dest"; continue
    fi
    bytes="$(wc -c < "$dest" | tr -d ' ')"
    dims="?"
    if command -v identify >/dev/null; then dims="$(identify -format '%wx%h' "$dest[0]" 2>/dev/null || echo '?')"
    elif command -v sips >/dev/null; then dims="$(sips -g pixelWidth -g pixelHeight "$dest" 2>/dev/null | awk '/pixel/{print $2}' | paste -sd x -)"
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$(basename "$dest")" "$bytes" "$dims" "$page" "$img" >> "$MANIFEST"
  else
    rm -f "$dest"
  fi
done

echo "== 3/3  Manifest ($MANIFEST)"
if command -v column >/dev/null; then column -t -s$'\t' "$MANIFEST"; else cat "$MANIFEST"; fi
echo
echo "$(($(wc -l < "$MANIFEST") - 1)) images saved to $OUT/"
echo "Page HTML saved to $PAGES/ (copy testimonials, partner and sponsor names verbatim from here)."
echo "Facebook needs a logged-in browser: save photos from facebook.com/poriruahardscapes manually."
echo "Next: copy the best files into the placeholder paths listed in README.md."
rm -f "$OUT/.discovered"
