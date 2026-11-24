#!/usr/bin/env python3
"""Jump-cut composite: source frame ranges from edl.json (video trimmed by frame, audio by the exact same times,
4 ms edge fades only to stop clicks; no other audio processing), last frame held 1s with silence, then the
transparent overlay composited (SDR->HLG via sdr2hlg.cube). HLG HDR preserved. usage: src overlay edl out"""
import json, subprocess, sys
src, ov, edlf, out = sys.argv[1:5]
E = json.load(open(edlf))["EDL_FRAMES"]; F = 30
n = len(E); frames = sum(b - a for a, b in E) + F
parts = []
for k, (a, b) in enumerate(E):
    d = (b - a) / F
    parts.append(f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[v{k}]")
    parts.append(f"[0:a]atrim=start={a/F:.6f}:end={b/F:.6f},asetpts=PTS-STARTPTS,afade=t=in:d=0.004,afade=t=out:st={d-0.004:.6f}:d=0.004[a{k}]")
cat = "".join(f"[v{k}][a{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]"
OVF = ("[1:v]split[o1][o2];[o2]alphaextract,format=gray10le[al];[o1]zscale=min=bt709:rin=tv:m=gbr:r=full:tin=bt709:t=bt709:pin=bt709:p=bt709,"
       "format=gbrp16le,lut3d=file=sdr2hlg.cube:interp=tetrahedral,zscale=min=gbr:rin=full:tin=arib-std-b67:pin=bt2020:m=bt2020nc:r=tv:"
       "t=arib-std-b67:p=bt2020,format=yuv444p10le[oc];[oc][al]alphamerge[ov]")
fc = ";".join(parts + [cat, "[vc]tpad=stop_mode=clone:stop_duration=1[base]", OVF,
                        "[base][ov]overlay=0:0:format=yuv444p10:eof_action=pass,format=yuv420p10le[v]", f"[ac]apad=whole_dur={frames/F:.6f}[a]"])
XP = "log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited"
common = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", ov, "-filter_complex", fc, "-map", "[v]"]
venc = ["-c:v", "libx265", "-preset", "slow", "-b:v", "16500k", "-pix_fmt", "yuv420p10le", "-frames:v", str(frames)]
subprocess.run(common + ["-map", "[a]", "-an"] + venc + ["-x265-params", XP + ":pass=1", "-f", "null", "/dev/null"], check=True)
subprocess.run(common + ["-map", "[a]", "-c:a", "aac", "-b:a", "256k", "-ar", "44100"] + venc + ["-x265-params", XP + ":pass=2",
               "-tag:v", "hvc1", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc", "-color_range", "tv",
               "-t", f"{frames/F:.6f}", "-movflags", "+faststart", out], check=True)
subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,nb_frames,duration:format=duration,size", "-of", "compact", out])
