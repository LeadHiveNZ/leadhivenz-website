---
workflow: general-video
flow: automation
storyboard: no
message: "Someone's charging tradies $1,000 for a Claude AI workshop. I'm doing it for $50."
destination: meta-reels-ad
aspect: 1080x1920
language: en
length: ~37s
angle: authentic-talking-head-ad
---

## Intent

Paid Meta ad for Joe's Claude AI workshop for tradies (Wed 28 Oct, 7:30pm, live on Zoom, $50,
full refund guarantee). Asked for: captions, animation only where necessary, authentic, all dead
space cut, reviewed multiple times before delivery.

## Assets

- assets/source.mp4 — SDR tonemap of the uploaded iPhone HLG clip (41.3s), video only.
- assets/mix.m4a — edit audio from mkaudio.py (40 ms joins, loudnorm); final master is
  re-normalised to -14 LUFS with a -1.4 dBFS ceiling after render.
- transcript.json / face.json — Parakeet words; OpenCV face track.

## Customizations

- Nine kept ranges, hard cuts on silence only, alternating 1.24 / 1.31 punch-in.
- Framing for Reels ads: wrapper scale 1.24, x +47, y -225 so the face sits upper-middle and
  every caption and pill ends above y=1248 (the bottom 35% Meta's ad UI covers).
- Captions: every transcribed word kept (gap words assigned to a side by punctuation), ASR
  timings shifted +0.08s, lone sentence-final words folded into the previous line.
- Pills: $1,000 struck through to $50 on "fifty"; Wed 28 Oct · 7:30pm · Live on Zoom;
  5 hrs admin saved weekly · +10% jobs won; Full refund; Tap the link below.

## Notes

- "stay on the end" captioned verbatim from the transcript; confirm wording.

## Delivery v2 (audio and quality fix)

- Distortion traced to the render step: the renderer raised the supplied mix past 0 dBFS
  (about 1,100 clipped samples on the $500 ad), and the phone sources decode above 0 dBFS.
- Audio is now built outside the renderer by ../finalaudio.py in 32-bit float: -6 dB
  headroom, declip, balanced mono, 80 Hz high-pass, (denoise on the $500 ad only), cuts with
  40 ms equal-power blends, 3:1 voice compression, -16 LUFS, limiter at -1.5 dBFS touching
  under 1% of the audio. One AAC-LC 192k stereo encode, muxed with -c:v copy.
- Picture: source re-made at 1080x1920 (Lanczos + light unsharp) before rendering; render at
  --video-bitrate 14M. Final: H.264 High, 1080x1920, 30fps, ~14 Mbps, AAC 192k 48 kHz.
- Deliverables in ../../deliverables/.

## Delivery v3 (outdoor noise removal)

- Replaced the gentle FFT filter (only ~1.5 dB) with DPDFNet 48 kHz full-band speech
  enhancement (sherpa-onnx, model dpdfnet2_48khz_hr.onnx from the k2-fsa
  speech-enhancement-models release), via ../dpdf.py, plus a Q30 -12 dB notch on the steady
  whine (1201 Hz workshop ad, 1176 Hz $500 ad) and a +2 dB shelf at 7 kHz.
- Measured vs untreated: pause noise -10 dB (workshop) / -19 dB ($500); birds 2.5-8 kHz
  -11 / -20 dB; whine -17 / -29 dB; voice 300-3000 Hz unchanged; zero added latency.
- Rebuild: python3 ../finalaudio.py SOURCE edl-in.json OUT --dpdf MODEL --notch HZ
