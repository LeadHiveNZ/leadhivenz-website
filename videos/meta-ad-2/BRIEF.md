---
workflow: general-video
flow: automation
storyboard: no
message: "A tradie got charged $10,000 for a website. I build you one for $500, and you don't pay until you see it."
destination: meta-reels-ad
aspect: 1080x1920
language: en
length: ~26s
angle: authentic-talking-head-ad
---

## Intent

Paid Meta ad for Joe's $500 tradie websites with a free live demo before payment. Asked for:
captions, animation only where necessary, authentic, all dead space cut, audio fixed, framing
adjusted, reviewed multiple times before delivery.

## Assets

- assets/source.mp4 — SDR tonemap of the uploaded iPhone HLG clip (29.7s), video only.
- assets/mix.m4a — built by ../mkaudio.py from footage5/clean.wav (see Audio repair).
- transcript.json / face.json — Parakeet words; OpenCV face track.

## Audio repair

Source problems: peaks at 0 dBFS with clipped samples, left channel 2.5 dB quieter than right,
room-noise floor around -45 dB. Chain on the whole file before cutting:
adeclip, mono fold (0.5L+0.5R), 80 Hz high-pass, afftdn nr=10 nf=-46, light de-ess.
Result: noise in pauses down ~6.5 dB with speech level unchanged. After render: two-pass
loudnorm to -14 LUFS and a limiter at -1.5 dBFS.

## Customizations

- Seven kept ranges, hard cuts on silence only, alternating 1.24 / 1.31 punch-in.
- Reels-ad framing: scale 1.24, x +59, y -200; every caption and pill ends above y=1248.
- Pills: "Tradie charged $10,000 for a website"; "$10,000" struck to "$500 · pay after you see
  it"; "Shows on Google · Google Ads · Reviews" built item by item as each is named;
  "Free demo · fill out the form below".

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
