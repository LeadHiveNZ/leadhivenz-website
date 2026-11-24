#!/usr/bin/env bash
# Trim the untouched HLG footage (frames 282..1247 = src 9.40..41.60s), hold the last frame 1s, composite the
# transparent overlay (SDR->HLG via sdr2hlg.cube). Audio: original PCM trimmed at the same points (room-tone
# 20ms/40ms edge fades only), 1s of silence for the hold, AAC 256k. No other audio processing.
set -euo pipefail
SRC=$1; OV=$2; OUT=$3
FC="[0:v]trim=start_frame=282:end_frame=1248,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=1[base];[1:v]split[o1][o2];[o2]alphaextract,format=gray10le[al];[o1]zscale=min=bt709:rin=tv:m=gbr:r=full:tin=bt709:t=bt709:pin=bt709:p=bt709,format=gbrp16le,lut3d=file=sdr2hlg.cube:interp=tetrahedral,zscale=min=gbr:rin=full:tin=arib-std-b67:pin=bt2020:m=bt2020nc:r=tv:t=arib-std-b67:p=bt2020,format=yuv444p10le[oc];[oc][al]alphamerge[ov];[base][ov]overlay=0:0:format=yuv444p10:eof_action=pass,format=yuv420p10le[v];[0:a]atrim=start=9.4:end=41.6,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=32.16:d=0.04,apad=whole_dur=33.2[a]"
XP="log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited"
rm -f x265_2pass*
ffmpeg -v error -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -an -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le -x265-params "$XP:pass=1" -f null /dev/null
ffmpeg -v error -y -i "$SRC" -i "$OV" -filter_complex "$FC" -map "[v]" -map "[a]" -c:a aac -b:a 256k -ar 44100 -c:v libx265 -preset slow -b:v 16500k -pix_fmt yuv420p10le -x265-params "$XP:pass=2" -tag:v hvc1 -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv -t 33.2 -movflags +faststart "$OUT"
rm -f x265_2pass*
ffprobe -v error -show_entries stream=codec_name,pix_fmt,color_transfer,bit_rate,nb_frames,duration:format=duration,size -of compact "$OUT"
