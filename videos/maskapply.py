#!/usr/bin/env python3
"""Voice-preserving noise removal: use DPDFNet only as a noise map, never as the output.

usage: maskapply.py ORIG_STEREO_WAV DENOISED_L_WAV DENOISED_R_WAV OUT_STEREO_WAV [KNEE]

For each time-frequency cell, the model's keep-ratio G = |denoised| / |original mid| says how
much of that cell is voice. Cells the model keeps at or above KNEE (default 0.6) are voice-
dominated and pass through at exactly their original level and phase (gain 1). Cells it
suppresses are turned down in proportion, so birds, hiss and room air drop while the voice is
left as recorded. Each channel gets its own map from its own denoised copy: on a mid (L+R)
fold the two phone mics' high frequencies partly cancel and the model then mistakes the
voice's 's' and 't' sounds for noise. Gains are lightly smoothed across time and frequency to avoid
'musical noise' warble.
"""
import sys, subprocess, numpy as np

SR, N, H = 48000, 1024, 256
orig_p, den_l, den_r, out_p = sys.argv[1:5]
KNEE = float(sys.argv[5]) if len(sys.argv) > 5 else 0.6


def load(f, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch)


win = np.sqrt(np.hanning(N + 1)[:-1])  # sqrt-Hann analysis/synthesis, 75% overlap -> perfect reconstruction


def stft(x):
    pad = np.pad(x, (N, N + H))
    frames = (len(pad) - N) // H
    idx = np.arange(N)[None, :] + H * np.arange(frames)[:, None]
    return np.fft.rfft(pad[idx] * win, axis=1)


def istft(S, n):
    frames = S.shape[0]
    y = np.zeros(N + H * frames + N)
    wsum = np.zeros_like(y)
    t = np.fft.irfft(S, n=N, axis=1) * win
    for i in range(frames):
        y[i * H:i * H + N] += t[i]
        wsum[i * H:i * H + N] += win ** 2
    y = y / np.maximum(wsum, 1e-8)
    return y[N:N + n]


o = load(orig_p, 2)
dens = [load(den_l, 1)[:, 0], load(den_r, 1)[:, 0]]
n = min(len(o), *(len(x) for x in dens))
k = np.ones((3, 3)) / 9
chans, passed = [], []
for c in range(2):
    Oc, Dc = stft(o[:n, c]), stft(dens[c][:n])
    G = np.clip(np.abs(Dc) / (np.abs(Oc) + 1e-9), 0, 1)
    Gp = np.pad(G, 1, mode="edge")
    G = sum(Gp[i:i + G.shape[0], j:j + G.shape[1]] * k[i, j] for i in range(3) for j in range(3))
    G = np.minimum(1.0, G / KNEE)
    passed.append((G >= 0.999).mean())
    chans.append(istft(Oc * G, n))
out = np.stack(chans, axis=1).astype(np.float32)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_f32le", out_p],
               input=out.tobytes(), check=True)
print(f"cells passed untouched: L {100 * passed[0]:.1f}%  R {100 * passed[1]:.1f}%")
