#!/usr/bin/env bash
# Small HDR preview: same HLG BT.2020 10-bit as the original, downscaled only (no tone mapping / colour conversion).
set -euo pipefail
IN=$1; OUT=$2; BR=$3
XP="log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited"
rm -f x265_2pass*
ffmpeg -v error -y -i "$IN" -vf "scale=720:1280:flags=lanczos" -an -c:v libx265 -preset medium -b:v $BR -pix_fmt yuv420p10le -x265-params "$XP:pass=1" -f null /dev/null
ffmpeg -v error -y -i "$IN" -vf "scale=720:1280:flags=lanczos" -map 0:v:0 -map 0:a:0 -c:a copy -c:v libx265 -preset medium -b:v $BR -pix_fmt yuv420p10le -x265-params "$XP:pass=2" -tag:v hvc1 -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv -movflags +faststart "$OUT"
rm -f x265_2pass*
