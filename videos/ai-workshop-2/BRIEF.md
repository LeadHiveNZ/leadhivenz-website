---
workflow: general-video
flow: automation
storyboard: no
message: "Claude AI workshop for tradies: Wed 28 Oct 7:30pm, full on-the-spot refund if you get nothing out of it"
destination: instagram-reels
aspect: 1080x1920
language: en
length: ~28s
angle: authentic-seated-pitch
---

## Intent

Joe's 33s seated outdoor pitch (take 2) for the Claude AI workshop. Same brief as
take 1: captions, dead space cut fast, seamless audio, wind fixed if it muffles,
centred, animation only where necessary.

## Assets

- assets/workshop2.mp4 — SDR tonemap of "Ai workshop video 2" (iPhone HLG source), video only.
- assets/mix.m4a — edit audio: 90 Hz high-pass (wind rumble), 40 ms joins, loudnorm -16 LUFS.
- transcript.json — Parakeet word-level transcript in source time.
- face.json — face centre per 0.5 s from OpenCV, drives the centring track.

## Customizations

- Six kept ranges, hard cuts, alternating 1.15/1.22 punch-in.
- Horizontal centring: slow linear x tweens on the video wrapper following the
  smoothed face centre (clamped to the crop margin).
- Three pills only: Wed 28 Oct 7:30pm, full refund, ticket link below.

## Notes

- Wind only showed in pauses (low band louder than voice band), not over speech;
  high-pass plus the pause cuts handle it without noise reduction artefacts.
