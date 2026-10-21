"""Refine phrase edges from 10 ms energy and write edl.json for voiceonly.py / the composition."""
import json, subprocess, numpy as np
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "src/handymen.mov", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); sr = 16000; w = int(0.01 * sr)
db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + w] ** 2)) + 1e-9) for i in range(0, len(x) - w, w)])
# kept phrases (ASR start, ASR end); dropped: false start 15.68, ums 16.8-21.4 / 24.4 / 41.1, first CTA take 43.68
KEEP = [(0.56, 6.80, "I'm looking for one handyman ... residential maintenance work."),
        (10.56, 13.28, "This is how many qualified enquiries came through Auckland last month."),
        (13.92, 14.56, "This is South Auckland."),
        (16.24, 16.48, "This is Wellington."),
        (18.96, 23.12, "It's not like Builderscrack ... undercutting each other."),
        (26.00, 29.04, "These jobs come straight through to you ... same-day attention."),
        (31.60, 34.80, "I have 18 tradesmen ... same model."),
        (40.40, 45.52, "And if you're seeing this ad ... quick call.")]
# dropped: 15.20 "This is Christchurch." (screenshot is a Tauranga client), first take of the CTA at 36.64, pauses/ums
def onset(s):
    i0, i1 = int((s - 0.35) / 0.01), int((s + 0.25) / 0.01)
    for i in range(i0, i1):
        if db[i] > -36 and db[i + 1] > -36 and db[i + 2] > -36:
            return i * 0.01
    return s
def offset(e):
    i0, i1 = int((e - 0.1) / 0.01), int((e + 0.7) / 0.01)
    last = i0
    for i in range(i0, i1):
        if db[i] > -50: last = i
        if i - last > 14: break     # 140 ms of quiet = word is over
    return (last + 1) * 0.01
edl = []
for s, e, txt in KEEP:
    a, b = onset(s), offset(e)
    edl.append([round(a - 0.08, 2), round(b + 0.07, 2)])
    print(f"{a - 0.08:6.2f} - {b + 0.07:6.2f}  ({b - a + 0.12:4.2f}s)  {txt}")
print("total", round(sum(b - a for a, b in edl), 2))
json.dump({"EDL": edl, "D": 0.03}, open("edl.json", "w"))
