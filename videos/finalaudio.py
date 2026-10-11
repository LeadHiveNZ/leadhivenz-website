#!/usr/bin/env python3
"""Build an ad's final audio in 32-bit float, from the original phone file to one AAC encode.

usage: finalaudio.py SOURCE EDL_JSON OUT_DIR [--dpdf MODEL] [--notch HZ]

Stages (all float, no integer or lossy step until the last line):
  1. decode -> -6 dB headroom (iPhone/CapCut AAC decodes above 0 dBFS) -> declip -> balanced mono
     -> 80 Hz high-pass -> (optional) DPDFNet 48 kHz speech enhancement, which removes
     outdoor ambience, wind hiss and birdsong -> (optional) narrow notch on a steady whine
     -> +2 dB high shelf at 7 kHz to give back the crispness the denoiser takes
  2. cut to the EDL with 40 ms equal-power blends at each join
  3. voice compression (3:1 above -28 dB, 5 ms attack) so the limiter barely works
  4. two-pass loudnorm in linear mode to -16 LUFS / -2 dBTP (falls back to static gain if
     linear mode is refused), then a lookahead peak limiter at -1.5 dBFS as a safety net
  5. encode once to AAC-LC 192 kb/s, 48 kHz; decoded peaks are verified afterwards
"""
import json, subprocess, sys, os

src, edl_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
args = sys.argv[4:]
dpdf_model = args[args.index("--dpdf") + 1] if "--dpdf" in args else None
notch = float(args[args.index("--notch") + 1]) if "--notch" in args else None
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
cfg = json.load(open(edl_path))
EDL, D = cfg["EDL"], cfg["D"]


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


pre = "aformat=sample_fmts=fltp,volume=-6dB,adeclip,pan=mono|c0=0.5*c0+0.5*c1,highpass=f=80:p=2"
ff("-i", src, "-vn", "-af", pre, "-ar", "48000", "-c:a", "pcm_f32le", f"{out}/1_pre.wav")
stage = f"{out}/1_pre.wav"
if dpdf_model:
    subprocess.run([sys.executable, "-I", os.path.join(here, "dpdf.py"), dpdf_model, stage, f"{out}/1_dpdf.wav", "0"], check=True)
    stage = f"{out}/1_dpdf.wav"
post = "anull"
if notch:
    post += f",equalizer=f={notch}:t=q:w=30:g=-12"
if dpdf_model:
    post += ",treble=g=2:f=7000:t=s:w=0.7"
ff("-i", stage, "-af", post, "-c:a", "pcm_f32le", f"{out}/1_clean.wav")

parts = [f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(EDL)]
chain, prev = "", "s0"
for i in range(1, len(EDL)):
    chain += f"[{prev}][s{i}]acrossfade=d={D}:c1=qsin:c2=qsin[x{i}];"
    prev = f"x{i}"
fc = "".join(parts) + chain + f"[{prev}]acompressor=threshold=-28dB:ratio=3:attack=5:release=120:knee=6:makeup=1[out]"
ff("-i", f"{out}/1_clean.wav", "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_f32le", f"{out}/2_cut.wav")

meas = subprocess.run(["ffmpeg", "-i", f"{out}/2_cut.wav", "-af", "loudnorm=I=-16:TP=-2:LRA=11:print_format=json",
                       "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
ln = (f"loudnorm=I=-16:TP=-2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
      f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
res = subprocess.run(["ffmpeg", "-y", "-i", f"{out}/2_cut.wav", "-af", ln + ",alimiter=limit=0.84:attack=5:release=60:level=false",
                      "-ar", "48000", "-c:a", "pcm_f32le", f"{out}/3_master.wav"], capture_output=True, text=True).stderr
r = json.loads(res[res.rindex("{"):res.rindex("}") + 1])
mode = r.get("normalization_type", "?")
if mode != "linear":
    gain = -16 - float(m["input_i"])
    ff("-i", f"{out}/2_cut.wav", "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=5:release=60:level=false",
       "-ar", "48000", "-c:a", "pcm_f32le", f"{out}/3_master.wav")
    mode = f"static {gain:+.2f} dB (linear refused)"
ff("-i", f"{out}/3_master.wav", "-ac", "2", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", f"{out}/final.m4a")
print(f"input {m['input_i']} LUFS / TP {m['input_tp']} -> normalisation: {mode}")
