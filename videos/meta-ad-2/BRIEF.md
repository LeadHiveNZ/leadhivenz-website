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
