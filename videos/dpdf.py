#!/usr/bin/env python3
"""Run sherpa-onnx DPDFNet (48 kHz full-band) speech enhancement on a mono float WAV.

usage: dpdf.py MODEL IN_WAV OUT_WAV [ATTEN_LIMIT_DB]
ATTEN_LIMIT_DB caps how far noise is pushed down (0 = no cap); a cap keeps a trace of the
room so the voice doesn't sound like it's floating in a vacuum.
"""
import sys, subprocess, numpy as np, sherpa_onnx

model, src, dst = sys.argv[1:4]
lim = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
cfg = sherpa_onnx.OfflineSpeechDenoiserConfig(
    model=sherpa_onnx.OfflineSpeechDenoiserModelConfig(
        dpdfnet=sherpa_onnx.OfflineSpeechDenoiserDpdfNetModelConfig(model=model, attenuation_limit_db=lim),
        num_threads=4))
den = sherpa_onnx.OfflineSpeechDenoiser(cfg)
sr = den.sample_rate
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, dtype=np.float32).copy()
out = den.run(x, sr)
y = np.asarray(out.samples, dtype=np.float32)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(out.sample_rate), "-ac", "1", "-i", "-",
                "-ar", "48000", "-c:a", "pcm_f32le", dst], input=y.tobytes(), check=True)
print(f"model sr {sr}, in {len(x)/sr:.2f}s, out {len(y)/out.sample_rate:.2f}s, atten_limit {lim}")
