#!/usr/bin/env bash
# Logo + favicon pipeline (ImageMagick 6).
# The client's logo file is an RGB PNG on a solid black background (no alpha channel).
# We recover transparency by "un-premultiplying" from black: alpha = clamp(max(R,G,B) / 0.6),
# colour = rgb / alpha. Solid artwork stays fully opaque; anti-aliased edges and the black gaps
# between the sphere stripes become transparent, so the logo sits cleanly on the site's navy.
set -euo pipefail
cd "$(dirname "$0")"
SRC=source/onshore-logo-original.png
OUT=../site/assets/img
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
NAVY='#0C1D45'
mkdir -p "$OUT"

# 1. Trim to the artwork (bbox measured from max-channel > 12%: 535x293+16+66) and build alpha.
convert "$SRC" -crop 535x293+16+66 +repage \
  \( +clone -channel RGB -separate -evaluate-sequence Max -evaluate multiply 1.6667 -evaluate min 65535 \) \
  -compose CopyOpacity -composite PNG32:"$TMP/premult.png"
convert "$TMP/premult.png" -alpha extract "$TMP/mask.png"
convert "$TMP/premult.png" \( +clone -alpha extract \) -alpha off -compose DivideSrc -composite "$TMP/unpre.png"
convert "$TMP/unpre.png" "$TMP/mask.png" -compose CopyOpacity -composite PNG32:"$TMP/logo-alpha.png"

# 2. Site logo: 180px tall (2x the largest display size), PNG fallback + WebP.
convert "$TMP/logo-alpha.png" -filter Lanczos -resize x180 -strip -depth 8 -define png:compression-level=9 PNG32:"$OUT/logo.png"
convert "$TMP/logo-alpha.png" -filter Lanczos -resize x180 -strip -define webp:alpha-quality=95 -quality 90 "$OUT/logo.webp"

# 3. Favicons from the sphere only (bbox 207x206+163+0 inside the trimmed logo), squared up.
convert "$TMP/logo-alpha.png" -crop 207x206+163+0 +repage -background none -gravity center -extent 210x210 PNG32:"$TMP/sphere.png"
convert "$TMP/sphere.png" -filter Lanczos -resize 32x32 -strip -depth 8 PNG32:"$OUT/favicon-32.png"
convert "$TMP/sphere.png" \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) -delete 0 ../site/favicon.ico
# iOS ignores transparency, so the touch icon and manifest icons sit on brand navy.
# Manifest icons keep the sphere inside the central 62% so they also work as maskable icons.
convert -size 180x180 xc:"$NAVY" \( "$TMP/sphere.png" -filter Lanczos -resize 132x132 \) -gravity center -composite -strip -depth 8 +dither -colors 256 PNG8:"$OUT/apple-touch-icon.png"
for s in 192 512; do
  inner=$(( s * 62 / 100 ))
  convert -size ${s}x${s} xc:"$NAVY" \( "$TMP/sphere.png" -filter Lanczos -resize ${inner}x${inner} \) -gravity center -composite -strip -depth 8 +dither -colors 256 PNG8:"$OUT/icon-$s.png"
done
ls -la "$OUT"/logo.* "$OUT"/favicon-32.png "$OUT"/apple-touch-icon.png "$OUT"/icon-*.png ../site/favicon.ico
identify "$OUT/logo.png" "$OUT/logo.webp"
