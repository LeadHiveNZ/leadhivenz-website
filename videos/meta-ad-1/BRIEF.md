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
