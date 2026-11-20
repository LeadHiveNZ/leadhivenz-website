#!/usr/bin/env bash
# Composite the transparent HyperFrames overlay onto the untouched iPhone HLG original.
# Overlay colours mapped SDR->HLG via sdr2hlg.cube (BT.2408); audio stream copied byte-for-byte.
set -euo pipefail
SRC=$1; OV=$2; OUT=$3
FC="[1:v]split[o1][o2];[o2]alphaextract,format=gray10le[al];[o1]zscale=min=bt709:rin=tv:m=gbr:r=full:tin=bt709:t=bt709:pin=bt709:p=bt709,format=gbrp16le,lut3d=file=sdr2hlg.cube:interp=tetrahedral,zscale=min=gbr:rin=full:tin=arib-std-b67:pin=bt2020:m=bt2020nc:r=tv:t=arib-std-b67:p=bt2020,format=yuv444p10le[oc];[oc][al]alphamerge[ov];[0:v][ov]overlay=0:0:format=yuv444p10:shortest=1:eof_action=pass,format=yuv420p10le[v]"
XP="log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited"
rm -f x265_2pass*
ffmpeg -v error -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -an -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le -x265-params "$XP:pass=1" -f null /dev/null
ffmpeg -v error -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -map 0:a:0 -c:a copy -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le -x265-params "$XP:pass=2" -tag:v hvc1 -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv -movflags +faststart "$OUT"
rm -f x265_2pass*
ffprobe -v error -show_entries stream=codec_name,pix_fmt,color_transfer,bit_rate,nb_frames:format=duration,size -of compact "$OUT"
cmp <(ffmpeg -v error -i "$OUT" -vn -c:a copy -f adts -) <(ffmpeg -v error -i "$SRC" -vn -map 0:a:0 -c:a copy -f adts -) && echo "AUDIO: bit-identical"
ffmpeg -v info -i "$SRC" -i "$OUT" -ss 20 -t 1 -lavfi "[0:v]crop=1080:700:0:200,setpts=PTS-STARTPTS[a];[1:v]crop=1080:700:0:200,setpts=PTS-STARTPTS[b];[a][b]ssim" -f null - 2>&1 | grep -o "All:[0-9.]*"
