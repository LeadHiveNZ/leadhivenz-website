#!/usr/bin/env python3
"""Final audio for the Claude workshop recap: the original recording, cut to edl.json and nothing else.
No noise reduction, no gain, no EQ, no sound effects. 30 ms blends sit inside silent padding at each join.
usage: audio_untouched.py SOURCE.mov OUT.m4a   (run from the project folder)"""
import json, subprocess, sys
src, out = sys.argv[1], sys.argv[2]
c = json.load(open("edl.json")); E, D = c["EDL"], c["D"]
parts = "".join(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(E))
chain, prev = "", "s0"
for i in range(1, len(E)):
    chain += f"[{prev}][s{i}]acrossfade=d={D}:c1=qsin:c2=qsin[x{i}];"; prev = f"x{i}"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", parts + chain + f"[{prev}]anull[o]", "-map", "[o]",
                "-c:a", "aac", "-b:a", "256k", "-ar", "48000", out], check=True)
