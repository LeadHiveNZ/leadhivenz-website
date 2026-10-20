#!/usr/bin/env python3
"""Original soundtrack for the game-winner edit, synthesised and locked to timeline.json.

usage: audio.py OUT.wav
150 BPM dark trap in D minor: braam + riser intro, drop 1 on the comeback montage, the beat cuts
for the final possession (heartbeat, crowd murmur, countdown booms), a vacuum during the slow-mo
flight, drop 2 on the swish (impact, net, crowd roar), half-time on the rim close-up, buzzer on
the final card. Uses the bundled Pixabay-licensed SFX for impacts, whooshes, glitch and riser.
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve

SR = 48000
TL = json.load(open("timeline.json"))
TOTAL = TL["total"]
N = int((TOTAL + 1.5) * SR)
L, R = np.zeros(N), np.zeros(N)
rng = np.random.default_rng(36)
SFX = "/root/.claude/skills/media-use/audio/assets/sfx/"
BEAT = 60 / TL["bpm"]
STEP = BEAT / 4

# ------------------------------------------------------------------ basics
def t_(d): return np.arange(int(d * SR)) / SR
def filt(x, kind, f, order=2):
    if kind == "bp":
        sos = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype="band", output="sos")
    else:
        sos = butter(order, f / (SR / 2), btype=kind, output="sos")
    return sosfilt(sos, x)
def noise(d): return rng.standard_normal(int(d * SR))
def saw(f, d, phase=0.0):
    t = t_(d); return 2 * ((f * t + phase) % 1.0) - 1
def hz(note):  # note name like D2, Bb1, F#3
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
             "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    n, o = note[:-1], int(note[-1])
    return 440 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)
def add(sig, t, gain=1.0, pan=0.0, width=0.0):
    """Mix mono (or (2,n) stereo) sig in at time t. pan -1..1."""
    i = int(round(t * SR))
    if i >= N: return
    if sig.ndim == 1:
        n = min(len(sig), N - i)
        if i < 0: sig, n, i = sig[-i:], min(len(sig) + i, N), 0
        gl, gr = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        L[i:i + n] += sig[:n] * gain * gl
        R[i:i + n] += sig[:n] * gain * gr
    else:
        n = min(sig.shape[1], N - i)
        L[i:i + n] += sig[0, :n] * gain
        R[i:i + n] += sig[1, :n] * gain
def load(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SFX + name, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
    return x / (np.abs(x).max() + 1e-9)
IR_CACHE = {}
def reverb(x, decay=1.4, mix=0.3, bright=6000):
    key = (decay, bright)
    if key not in IR_CACHE:
        n = int(decay * SR)
        ir = np.stack([filt(noise(decay), "lp", bright) * np.exp(-np.arange(n) / SR * 6.9 / decay) for _ in range(2)])
        IR_CACHE[key] = ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True)) * 0.5
    ir = IR_CACHE[key]
    wet = np.stack([fftconvolve(x, ir[0]), fftconvolve(x, ir[1])])
    dry = np.stack([np.pad(x, (0, wet.shape[1] - len(x)))] * 2)
    return dry * (1 - mix) + wet * mix

# ------------------------------------------------------------------ instruments
def kick(g=1.0):
    t = t_(0.5)
    f = 46 + 120 * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    click = filt(noise(0.5), "hp", 2500) * np.exp(-t / 0.004) * 0.5
    return filt(np.tanh(1.8 * (body + click)), "hp", 38) * g * 0.55
def k808(note, dur):
    t = t_(dur + 0.05)
    f0 = hz(note)
    f = f0 * (1 + 0.5 * np.exp(-t / 0.025))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.75)
    env[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return filt(filt(np.tanh(3.2 * x * env) * 0.5, "lp", 1800), "hp", 40)
def clap():
    t = t_(0.6)
    n = filt(noise(0.6), "bp", (900, 4200))
    env = np.zeros_like(t)
    for o in (0, 0.011, 0.023):
        m = t >= o
        env[m] += np.exp(-(t[m] - o) / 0.007)
    env += np.exp(-t / 0.13) * 0.55
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.06) * 0.6
    return reverb(n * env * 0.9 + body, 0.9, 0.22)
def hat(open_=False):
    d = 0.25 if open_ else 0.08
    t = t_(d)
    return filt(noise(d), "hp", 7500) * np.exp(-t / (0.12 if open_ else 0.022)) * 0.55
def stab(notes, d=0.32):
    t = t_(d)
    x = np.zeros_like(t)
    for nt in notes:
        for det in (-0.008, 0.0, 0.008):
            x += saw(hz(nt) * (1 + det), d, rng.random())
    x = filt(x / (3 * len(notes)), "lp", 2600, 2)
    env = np.minimum(1, t / 0.003) * np.exp(-t / 0.13)
    return np.tanh(2.2 * x * env)
def bell(note, d=0.9):
    t = t_(d); f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t / 0.25) + 0.2 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.12)
    return x * np.minimum(1, t / 0.002) * np.exp(-t / 0.38) * 0.5
def choir(notes, d, attack=0.25):
    t = t_(d)
    out = np.zeros((2, len(t)))
    for k, nt in enumerate(notes):
        for v in range(4):
            det = (v - 1.5) * 0.006
            vib = 1 + 0.004 * np.sin(2 * np.pi * (4.6 + v * 0.3) * t + v)
            x = 2 * ((np.cumsum(hz(nt) * (1 + det) * vib) / SR + rng.random()) % 1) - 1
            ch = (k + v) % 2
            out[ch] += x
    res = np.zeros_like(out)
    for f, g in ((700, 1.0), (1150, 0.6), (2600, 0.25)):
        for c in range(2):
            res[c] += filt(out[c], "bp", (f * 0.8, f * 1.2)) * g
    env = np.minimum(1, t / attack) * np.minimum(1, (d - t) / 0.25).clip(0, 1)
    return res * env / (len(notes) * 3)
def drone(d, notes=("D1", "D2", "A2")):
    t = t_(d)
    x = np.zeros_like(t)
    for nt in notes:
        x += np.sin(2 * np.pi * hz(nt) * t) + 0.3 * filt(saw(hz(nt) * 1.003, d), "lp", 260)
    trem = 0.85 + 0.15 * np.sin(2 * np.pi * 0.35 * t)
    env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.4).clip(0, 1)
    return filt(x * trem * env / len(notes), "hp", 45) * 0.6
def braam(d=2.4, notes=("D1", "D2", "A2", "D3", "F3")):
    t = t_(d)
    x = np.zeros_like(t)
    for nt in notes:
        for det in (-0.006, 0.006):
            x += saw(hz(nt) * (1 + det), d, rng.random())
    x /= 2 * len(notes)
    dark, bright = filt(x, "lp", 220), filt(x, "lp", 1800)
    open_ = np.clip(t / 0.25, 0, 1) * np.exp(-t / 0.9)
    env = np.minimum(1, t / 0.02) * np.exp(-t / 1.4)
    return filt(np.tanh(2.4 * (dark * (1 - open_) + bright * open_) * env), "hp", 50)
def taiko():
    t = t_(1.6)
    f = 48 + 30 * np.exp(-t / 0.05)
    body = filt(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45), "hp", 40) * 0.6
    skin = filt(noise(1.6), "lp", 400) * np.exp(-t / 0.03) * 0.8
    clang = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / dc) for fr, dc in ((523, 0.5), (1307, 0.3), (2213, 0.2), (3561, 0.12))) * 0.06
    return reverb(np.tanh(1.6 * (body + skin)) + clang, 1.8, 0.35)
def heartbeat(g=1.0):
    def thump(a):
        t = t_(0.16)
        return np.sin(2 * np.pi * 52 * t) * np.minimum(1, t / 0.008) * np.exp(-t / 0.05) * a
    x = np.zeros(int(0.45 * SR))
    a = thump(1.0); x[:len(a)] += a
    b = thump(0.7); i = int(0.19 * SR); x[i:i + len(b)] += b
    return filt(np.tanh(2 * x), "lp", 180) * g
def swish():
    t = t_(0.42)
    n = filt(noise(0.42), "bp", (2200, 7500))
    env = np.minimum(1, t / 0.03) * np.exp(-t / 0.09)
    net = filt(noise(0.42), "bp", (600, 1800)) * np.minimum(1, t / 0.01) * np.exp(-t / 0.05) * 0.5
    return (n * env + net) * 0.9
def buzzer(d=1.25):
    t = t_(d)
    x = saw(233, d) + 0.8 * saw(311, d) + 0.5 * np.sign(np.sin(2 * np.pi * 116.5 * t))
    x = filt(x, "lp", 2400) * (1 + 0.12 * np.sin(2 * np.pi * 31 * t))
    env = np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.08).clip(0, 1)
    return np.tanh(1.5 * x * env) * 0.6
def reverse_cym(d=1.4):
    t = t_(d)
    x = filt(noise(d), "hp", 3500) * (t / d) ** 3
    return x * 0.8
def sub_drop(d=1.6):
    t = t_(d)
    f = 34 + 40 * np.exp(-t / 0.3)
    return filt(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.005) * np.exp(-t / 0.7), "hp", 35) * 0.5
def crowd(d, roar=1.0, seed=0):
    """Arena crowd: banded noise with independent slow swells + formant 'whoo' voices + claps."""
    r = np.random.default_rng(seed)
    n = int(d * SR); t = np.arange(n) / SR
    out = np.zeros((2, n))
    for c in range(2):
        for lo, hi, g in ((180, 700, 1.0), (600, 1900, 0.8), (1700, 4200, 0.35)):
            band = filt(r.standard_normal(n), "bp", (lo, hi))
            am = filt(r.standard_normal(n), "lp", 3.0)
            am = 0.6 + 0.4 * am / (np.abs(am).max() + 1e-9)
            out[c] += band * am * g
    voices = int(26 * roar) + 4
    for v in range(voices):
        vd = r.uniform(0.5, 1.8); st = r.uniform(0, max(0.01, d - 0.3))
        m = int(vd * SR); tt = np.arange(m) / SR
        f0 = r.uniform(240, 520) * (1 + 0.25 * np.sin(np.pi * tt / vd))
        f = f0 * (1 + 0.012 * np.sin(2 * np.pi * r.uniform(5, 7) * tt))
        x = 2 * ((np.cumsum(f) / SR) % 1) - 1
        x = filt(x, "bp", (r.uniform(500, 800), r.uniform(1000, 1500)))
        env = np.sin(np.pi * tt / vd) ** 1.5
        i = int(st * SR); k = min(m, n - i)
        out[v % 2, i:i + k] += x[:k] * env[:k] * 0.9
    for _ in range(int(d * 18 * roar)):
        i = int(r.uniform(0, d - 0.05) * SR)
        cl = filt(r.standard_normal(int(0.03 * SR)), "bp", (1000, 3500)) * np.exp(-np.arange(int(0.03 * SR)) / SR / 0.006)
        out[r.integers(0, 2), i:i + len(cl)] += cl * 0.5
    out /= np.abs(out).max() + 1e-9
    return out

# ------------------------------------------------------------------ arrangement
CH = [("D3", "F3", "A3"), ("Bb2", "D3", "F3"), ("G2", "Bb2", "D3"), ("A2", "C#3", "E3")]
ROOT = ["D2", "Bb1", "G1", "A1"]
MEL = [["D5", "A4", "F5", "E5"], ["D5", "F5", "Bb4", "A4"], ["G4", "Bb4", "D5", "C5"], ["A4", "C#5", "E5", "A5"]]
BAR = 4 * BEAT

def beat_bars(t0, bars, energy=1.0, halftime=False, roll_bars=(), chord0=0, stabs=True, melody=True, choirs=True):
    for b in range(bars):
        tb = t0 + b * BAR
        ci = (chord0 + b) % 4
        kicks = [0, 7, 10] + ([14] if b % 2 else [])
        if halftime: kicks = [0, 10]
        for s in kicks:
            add(kick(1.0), tb + s * STEP, 0.95)
        nxt = kicks + [16]
        for j, s in enumerate(kicks):
            add(k808(ROOT[ci], (nxt[j + 1] - s) * STEP), tb + s * STEP, 0.75 * energy)
        for s in ([8] if halftime else [4, 12]):
            add(clap(), tb + s * STEP, 0.8)
        hs = range(0, 16, 2) if not halftime else range(0, 16, 4)
        for s in hs:
            add(hat(s % 8 == 6), tb + s * STEP, 0.42 * energy, pan=0.25)
        if b in roll_bars and not halftime:
            for k in range(8):
                add(hat(), tb + 12 * STEP + k * STEP / 2, 0.22 + 0.03 * k, pan=-0.2)
        elif not halftime:
            for s in (13, 15):
                add(hat(), tb + s * STEP, 0.2, pan=-0.2)
        if stabs:
            for s in (0, 6):
                add(stab(CH[ci]), tb + s * STEP, 0.62 * energy, pan=-0.15 if s else 0.15)
        if melody:
            for k, nt in enumerate(MEL[ci]):
                add(reverb(bell(nt), 1.6, 0.35), tb + k * BEAT + (STEP if k == 3 else 0), 0.3 * energy)
        if choirs:
            add(choir(CH[ci], BAR + 0.2), tb, 1.0 * energy)

whoosh, whoosh_s, whoosh_c = load("whoosh.mp3"), load("whoosh-short.mp3"), load("whoosh-cinematic.mp3")
imp1, imp2, riser, glitch = load("impact-bass-1.mp3"), load("impact-bass-2.mp3"), load("riser.mp3"), load("glitch-1.mp3")

I0, M0, M1 = 0.0, TL["intro_end"], TL["mont_end"]
FRZ, SLB, IMP = TL["freeze"], TL["slowb"], TL["impact"]
HERO, REP, RIM, FIN = TL["hero"], TL["replay"], TL["rim"], TL["final"]

# intro
add(drone(M0 + 0.2), 0, 0.45)
add(whoosh_s, 0.2, 0.25)
add(braam(2.4), 0.80, 0.55)
add(taiko(), 0.80, 0.55)
add(braam(1.6, ("D2", "A2", "D3")), 1.60, 0.3)
add(kick(), 1.60, 0.6)
rs = riser[:, -int(2.3 * SR):]
add(rs, M0 - 2.3, 0.45)
add(reverse_cym(1.6), M0 - 1.6, 0.35)
add(crowd(M0, 0.3, 1) * np.linspace(0, 1, int(M0 * SR)), 0, 0.12)
# drop 1: comeback montage (8 bars)
add(imp2, M0, 0.5)
add(sub_drop(), M0, 0.5)
beat_bars(M0, 8, 1.0, roll_bars=(1, 3, 5, 7))
add(crowd(M1 - M0, 0.6, 2), M0, 0.26)
for tc in TL["montage_cuts"]:
    add(whoosh_s, tc - 0.08, 0.12, pan=rng.uniform(-0.5, 0.5))
add(imp1, TL["score_changes"][0], 0.32)
add(crowd(1.6, 1.2, 3) * np.minimum(1, t_(1.6) / 0.1) * np.exp(-t_(1.6) / 0.8), TL["score_changes"][0], 0.35)
add(glitch[:, :int(0.35 * SR)], TL["score_changes"][1] - 0.02, 0.2)
# snare roll into the stop
for k in range(16):
    add(clap(), M1 - BAR / 2 + k * BAR / 32, 0.15 + 0.02 * k)
add(reverse_cym(BAR / 2), M1 - BAR / 2, 0.45)
# tension (beat stops)
add(imp1, M1, 0.75)
add(taiko(), M1, 0.6)
add(braam(3.2, ("D1", "D2", "A2", "D3")), M1, 0.45)
TEN = TL["slowa"] - M1
add(drone(TEN + 0.9, ("D1", "D2")), M1, 0.55)
add(choir(("D3", "F3", "A3"), TEN) * 0.6, M1, 0.6)
mur = crowd(TEN, 0.5, 4)
mur = np.stack([filt(mur[0], "lp", 1400), filt(mur[1], "lp", 1400)]) * np.linspace(0.3, 1.0, mur.shape[1])
add(mur, M1, 0.6)
hb, period = M1 + 0.6, 0.78
while hb < FRZ - 0.1:
    add(heartbeat(), hb, 0.9)
    period = max(0.5, period - 0.025)
    hb += period
for tc in TL["count"]:
    add(taiko(), tc, 0.75)
    add(sub_drop(1.0), tc, 0.35)
add(riser[:, -int((TL["slowa"] - TL["shot1"] + 0.3) * SR):], TL["shot1"] - 0.3, 0.35)
add(whoosh_c[:, :int(1.2 * SR)], TL["slowa"] - 0.1, 0.35)
# freeze: near-silence, one heartbeat, ringing
tt = t_(SLB - FRZ + 0.3)
add(np.sin(2 * np.pi * 3520 * tt) * np.minimum(1, tt / 0.1) * np.exp(-tt / 0.7) * 0.05, FRZ, 1.0)
add(heartbeat(1.2), FRZ + 0.35, 1.0)
# slow flight: stretched drone, slowed heart, muffled crowd rising, riser into a vacuum
FL = IMP - SLB
add(drone(FL, ("D1", "A1")), SLB, 0.5)
add(heartbeat(1.1), SLB + 0.4, 1.0)
add(heartbeat(1.1), SLB + 1.45, 1.0)
add(heartbeat(1.1), SLB + 2.4, 0.9)
mf = crowd(FL, 0.8, 5)
mf = np.stack([filt(mf[0], "lp", 700), filt(mf[1], "lp", 700)]) * np.linspace(0.2, 1.0, mf.shape[1]) ** 2
add(mf, SLB, 0.5)
rz = riser[:, -int(FL * SR):].copy()
rz[:, -int(0.09 * SR):] = 0                                # vacuum right before the swish
add(rz, SLB, 0.5)
add(reverse_cym(2.0)[:-int(0.09 * SR)], IMP - 2.0, 0.5)
# IMPACT
add(imp1, IMP, 1.0)
add(sub_drop(2.0), IMP, 0.8)
add(swish(), IMP, 0.9)
add(reverb(filt(noise(1.2), "hp", 1500) * np.exp(-t_(1.2) / 0.35), 2.2, 0.4), IMP, 0.35)
roar = crowd(TOTAL - IMP + 0.5, 1.6, 6)
roar *= np.minimum(1, t_(TOTAL - IMP + 0.5) / 0.05)
roar *= np.concatenate([np.ones(int((FIN - IMP) * SR)) * 0.85, np.ones(roar.shape[1] - int((FIN - IMP) * SR))])[:roar.shape[1]]
add(roar, IMP, 0.85)
# drop 2: celebration
bars2 = int(round((RIM - IMP) / BAR + 0.49))
beat_bars(IMP, 2, 1.15, roll_bars=(1,))
add(braam(1.8, ("D2", "A2", "D3", "F3")), HERO, 0.4)
for tt_ in (HERO + 0.02, HERO + 0.16):
    add(whoosh, tt_ - 0.12, 0.25)
# replay: rewind glitch then the beat continues
add(glitch[:, :int(0.5 * SR)], REP - 0.08, 0.3)
add(whoosh_s[:, ::-1].copy(), REP - 0.3, 0.3)
beat_bars(REP, 2, 1.0, roll_bars=(), chord0=2)
add(imp2, TL["replay_swish"], 0.4)
add(swish(), TL["replay_swish"], 0.5)
# rim close-up: half-time, then the swish boom and a roll into the final
add(whoosh_c[:, :int(1.0 * SR)], RIM - 0.2, 0.3)
beat_bars(RIM, 1, 0.9, halftime=True, chord0=0, melody=False)
add(taiko(), TL["rim_swish"], 0.7)
add(swish(), TL["rim_swish"], 0.6)
add(imp1, TL["rim_swish"], 0.5)
for k in range(12):
    add(clap(), FIN - BAR * 3 / 8 + k * BAR / 32, 0.15 + 0.025 * k)
add(reverse_cym(0.8), FIN - 0.8, 0.5)
# final card: buzzer, last drop, end stinger with a long tail
add(buzzer(), FIN, 0.5)
add(imp1, FIN, 0.9)
add(sub_drop(2.0), FIN, 0.6)
beat_bars(FIN, 2, 1.1, roll_bars=(1,), chord0=0)
END = FIN + 2 * BAR
add(reverb(np.concatenate([stab(("D3", "F3", "A3", "D4"), 0.6), np.zeros(int(0.2 * SR))]), 2.5, 0.5)[0], END, 0.45)
add(taiko(), END, 0.6)
add(braam(1.6, ("D1", "D2", "A2", "D3")), END, 0.4)

# ------------------------------------------------------------------ master
mix = np.stack([L, R])[:, :int(TOTAL * SR)]
mix = np.stack([filt(c, "hp", 30) for c in mix])
# master EQ for phone playback: low shelf under ~60 Hz (about -9 dB), presence lift 1.2-4.5 kHz, air
def zf(x, kind, f, order=2):   # zero-phase, so the parallel shelves sum cleanly
    sos = butter(order, (np.array(f) / (SR / 2)), btype={"bp": "band"}.get(kind, kind), output="sos")
    return sosfiltfilt(sos, x)
mix = np.stack([c - 0.62 * zf(c, "lp", 90) for c in mix])
mix = np.stack([c + 0.8 * zf(c, "bp", (1200, 4500)) + 0.4 * zf(c, "bp", (300, 1200)) + 0.3 * zf(c, "hp", 9000) for c in mix])
# section gain staging: comeback a touch under the intro, the final possession well down, the swish loudest
def db(x): return 10 ** (x / 20)
pts_ = [(0, 0), (M0, -1.5), (M1 + 0.5, -1.5), (M1 + 0.9, -3.5), (FRZ, -3.5), (IMP - 0.02, -3.0), (IMP, 0.0), (TOTAL, 0.0)]
tt_all = np.arange(mix.shape[1]) / SR
mix *= db(np.interp(tt_all, [p[0] for p in pts_], [p[1] for p in pts_]))
for tv, dv in ((M0, 0.08), (FIN, 0.07), (REP, 0.05)):      # short vacuums so each drop lands clean
    k0, k1 = int((tv - dv) * SR), int(tv * SR)
    mix[:, k0:k1] *= np.linspace(1, 0.08, k1 - k0) ** 0.5
fade = int(0.5 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
mix /= np.abs(mix).max() + 1e-9
mix = np.tanh(1.6 * mix) / np.tanh(1.6)       # glue / soft clip
out = sys.argv[1]
raw = (mix.T * 0.5).astype(np.float32).tobytes()
meas = subprocess.run(["ffmpeg", "-v", "info", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-af", "ebur128", "-f", "null", "-"],
                      input=raw, capture_output=True).stderr.decode()
I = float(meas.split("Summary:")[1].split("I:")[1].split("LUFS")[0])
gain = -11.0 - I                                    # static gain to about -11 LUFS, then an oversampled brickwall (true peak <= -1 dBTP)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                "-af", f"volume={gain:.2f}dB,aresample=192000,alimiter=limit=0.66:attack=2:release=60:level=false,aresample={SR}", "-ar", str(SR), "-c:a", "pcm_s24le", out],
               input=raw, check=True)
print(f"measured {I:.1f} LUFS, gain {gain:+.1f} dB")
print("wrote", out, f"{TOTAL:.2f}s")
