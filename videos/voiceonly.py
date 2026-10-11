#!/usr/bin/env python3
"""Background-noise removal only. The voice is left as recorded.

usage: voiceonly.py SOURCE EDL_JSON OUT_DIR DPDF_MODEL KNEE

What it does:
  1. decode the original stereo audio to 32-bit float (no level change, no EQ, no filters)
  2. DPDFNet 48 kHz speech enhancement on each channel separately, used only as a noise map:
     maskapply.py passes voice-dominated time-frequency cells through at their original level
     and phase, and turns down only the cells the model marks as noise (ambience, hiss,
     birdsong, whine). KNEE sets how cautious it is (lower = touches the voice even less).
  3. cut to the EDL with 40 ms equal-power blends at each join (needed to avoid clicks)
  4. one static volume trim, only if needed, so decoded peaks stay at or below -1 dBFS (trimmed to -2 dBTP before the AAC encode, which overshoots)
     (the phone files decode above 0 dBFS, which clips on playback); this changes loudness
     only, never tone or dynamics
  5. encode once to AAC-LC 192 kb/s stereo, 48 kHz

What it deliberately does not do: compression, limiting, loudness normalisation, EQ,
high-pass, de-essing, declipping, mono folding or channel balancing.
"""
import json, os, subprocess, sys
import numpy as np

src, edl_path, out, model, knee = sys.argv[1:6]
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
cfg = json.load(open(edl_path))
EDL, D = cfg["EDL"], cfg["D"]


def ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)


# 1. original stereo, float, untouched
ff("-i", src, "-vn", "-af", "aformat=sample_fmts=fltp", "-ar", "48000", "-c:a", "pcm_f32le", f"{out}/0_orig.wav")
# 2. denoise each channel independently
for ch, name in ((0, "L"), (1, "R")):
    ff("-i", f"{out}/0_orig.wav", "-af", f"pan=mono|c0=c{ch}", "-c:a", "pcm_f32le", f"{out}/0_{name}.wav")
    subprocess.run([sys.executable, "-I", os.path.join(here, "dpdf.py"), model, f"{out}/0_{name}.wav", f"{out}/1_{name}.wav", "0"],
                   check=True, capture_output=True)
subprocess.run([sys.executable, "-I", os.path.join(here, "maskapply.py"), f"{out}/0_orig.wav", f"{out}/1_L.wav",
                f"{out}/1_R.wav", f"{out}/1_clean.wav", knee], check=True)
# 3. cut
parts = [f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(EDL)]
chain, prev = "", "s0"
for i in range(1, len(EDL)):
    chain += f"[{prev}][s{i}]acrossfade=d={D}:c1=qsin:c2=qsin[x{i}];"
    prev = f"x{i}"
ff("-i", f"{out}/1_clean.wav", "-filter_complex", "".join(parts) + chain + f"[{prev}]anull[o]", "-map", "[o]",
   "-c:a", "pcm_f32le", f"{out}/2_cut.wav")
# 4. static trim only if peaks exceed -1 dBFS (4x oversampled to catch inter-sample peaks)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"{out}/2_cut.wav", "-ar", "192000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
peak_db = 20 * np.log10(np.abs(np.frombuffer(raw, dtype=np.float32)).max() + 1e-12)
trim = min(0.0, -2.0 - peak_db)
ff("-i", f"{out}/2_cut.wav", "-af", f"volume={trim:.2f}dB", "-c:a", "pcm_f32le", f"{out}/3_master.wav")
# 5. single encode
ff("-i", f"{out}/3_master.wav", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", f"{out}/final.m4a")
print(f"true peak before trim {peak_db:+.2f} dBFS -> static trim {trim:+.2f} dB")
