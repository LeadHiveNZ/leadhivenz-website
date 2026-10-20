#!/usr/bin/env python3
"""Build the ad's audio: the original recording, cut, nothing else.

usage: audio.py SOURCE OUT_M4A
The main take is cut with 40 ms equal-power blends at the joins (click-free), followed by
silence under the end card. (The P.S. take is no longer used.) No EQ, compression, normalisation, denoise, speed or pitch change. Single AAC encode.
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
fc = (m
      + f"aevalsrc=0:c=stereo:s=48000:d={c['end_card']}[tail];"
      + f"[{mo}]aresample=48000[ma];"
      + "[ma][tail]concat=n=2:v=0:a=1[o]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[o]",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", out], check=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                   capture_output=True, text=True).stdout.strip()
print("audio duration", d)
