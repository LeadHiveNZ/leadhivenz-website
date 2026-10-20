#!/usr/bin/env python3
"""Build the ad's audio: the original recording, cut, nothing else.

usage: audio.py SOURCE OUT_M4A
Main take and P.S. are each cut with 40 ms equal-power blends at the joins (click-free),
separated by silence under the P.S. card, followed by silence under the freeze hold and end
card. No EQ, compression, normalisation, denoise, speed or pitch change. Single AAC encode.
"""
import json, subprocess, sys

src, out = sys.argv[1], sys.argv[2]
c = json.load(open("edl-in.json"))
D = c["D"]


def chain(ranges, tag):
    parts = "".join(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[{tag}{i}];" for i, (a, b) in enumerate(ranges))
    prev, s = f"{tag}0", ""
    for i in range(1, len(ranges)):
        s += f"[{prev}][{tag}{i}]acrossfade=d={D}:c1=qsin:c2=qsin[{tag}x{i}];"
        prev = f"{tag}x{i}"
    return parts + s, prev


m, mo = chain(c["main"], "m")
p, po = chain(c["ps"], "p")
fc = (m + p
      + f"aevalsrc=0:c=stereo:s=48000:d={c['ps_card']}[gap];"
      + f"aevalsrc=0:c=stereo:s=48000:d={c['hold'] + c['end_card']}[tail];"
      + f"[{mo}]aresample=48000[ma];[{po}]aresample=48000[pa];"
      + "[ma][gap][pa][tail]concat=n=4:v=0:a=1[o]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[o]",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", out], check=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                   capture_output=True, text=True).stdout.strip()
print("audio duration", d)
