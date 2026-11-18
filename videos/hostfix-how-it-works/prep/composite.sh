#!/usr/bin/env bash
# Composite the transparent animation layer onto the untouched HDR original.
# 1) npx hyperframes render -o renders/overlay.mov --format mov --fps 30   (ProRes 4444 with alpha)
# 2) bash prep/composite.sh SOURCE.mov renders/overlay.mov OUT.mp4
# Graphics are mapped SDR -> HLG with prep/sdr2hlg.cube (BT.2408: white at 203 cd/m2, true black stays black).
# Video: x265 10-bit HLG BT.2020, 2-pass 16.5 Mbps. Audio: original stream copied, untouched. No cuts, no zoom.
set -euo pipefail
SRC=$1; OV=$2; OUT=$3; HERE=$(cd "$(dirname "$0")" && pwd)
FC="[1:v]split[o1][o2];[o2]alphaextract,format=gray10le[al];[o1]zscale=min=bt709:rin=tv:m=gbr:r=full:tin=bt709:t=bt709:pin=bt709:p=bt709,format=gbrp16le,lut3d=file=$HERE/sdr2hlg.cube:interp=tetrahedral,zscale=min=gbr:rin=full:tin=arib-std-b67:pin=bt2020:m=bt2020nc:r=tv:t=arib-std-b67:p=bt2020,format=yuv444p10le[oc];[oc][al]alphamerge[ov];[0:v][ov]overlay=0:0:format=yuv444p10:shortest=1:eof_action=pass,format=yuv420p10le[v]"
XP="log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited"
ffmpeg -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -an -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le -x265-params "$XP:pass=1" -f null /dev/null
ffmpeg -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -map 0:a:0 -c:a copy -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le \
  -x265-params "$XP:pass=2" -tag:v hvc1 -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv -movflags +faststart "$OUT"
