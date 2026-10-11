#!/usr/bin/env python3
"""Compare denoise candidates against the untreated file on the same timeline.

usage: score.py REF_WAV PAUSES_JSON CAND_WAV...
Reports, per candidate: noise left in pauses (overall and in the bird band 2.5-8 kHz),
the 1.1 kHz whine, speech-band level change during speech, high-frequency 'air' kept in
speech (5-12 kHz, guards against a muffled result), and alignment drift vs the reference.
"""
import sys, json, subprocess, numpy as np

SR = 48000


def load(f):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                        capture_output=True, check=True).stdout, dtype=np.float32)


def band_db(seg, a, b):
    n = 4096
    seg = seg[:len(seg) // n * n].reshape(-1, n) * np.hanning(n)
    p = (np.abs(np.fft.rfft(seg, axis=1)) ** 2).mean(0)
    fr = np.fft.rfftfreq(n, 1 / SR)
    return 10 * np.log10(p[(fr >= a) & (fr < b)].sum() + 1e-12)


ref = load(sys.argv[1])
pauses = json.load(open(sys.argv[2]))
mask = np.zeros(len(ref), bool)
for a, b in pauses:
    mask[int(a * SR):int(b * SR)] = True
speech = ~mask
print(f"{'candidate':28s} {'pause all':>9s} {'birds 2.5-8k':>12s} {'whine 1.1k':>10s} {'speech 300-3k':>13s} {'air 5-12k':>9s} {'lag ms':>6s}")
base = None
for f in [sys.argv[1]] + sys.argv[3:]:
    x = load(f)
    n = min(len(x), len(ref))
    x = x[:n]
    p = x[mask[:n]]
    s = x[speech[:n]]
    row = [band_db(p, 80, 16000), band_db(p, 2500, 8000), band_db(p, 1050, 1180),
           band_db(s, 300, 3000), band_db(s, 5000, 12000)]
    a = np.abs(ref[:n:8]); b = np.abs(x[::8])
    a = a - a.mean(); b = b - b.mean()
    lags = range(-60, 61)
    lag = max(lags, key=lambda k: float(np.dot(a[max(0, k):len(a) + min(0, k)], b[max(0, -k):len(b) - max(0, k)])))
    if base is None:
        base = row
        print(f"{f.split('/')[-1][:28]:28s} " + " ".join(f"{v:9.1f}" if i != 1 else f"{v:12.1f}" for i, v in enumerate(row)) + "   (reference, absolute dB)")
    else:
        d = [r - b0 for r, b0 in zip(row, base)]
        print(f"{f.split('/')[-1][:28]:28s} {d[0]:+9.1f} {d[1]:+12.1f} {d[2]:+10.1f} {d[3]:+13.1f} {d[4]:+9.1f} {lag * 8 / 48:6.1f}")
