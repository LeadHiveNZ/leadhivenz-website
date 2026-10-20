---
workflow: general-video
flow: automation
storyboard: no
message: "Someone's charging tradies $1,000 for a Claude AI workshop. I'm doing it for $50."
destination: meta-reels-ad
aspect: 1080x1920
language: en-NZ
length: 28.7s
angle: authentic-talking-head-ad
---

## Intent

Joe's detailed brief (Meta/Instagram ad): cut every pause > 0.3 s, ums, false starts; first
word within 0.3 s; word-by-word Montserrat ExtraBold captions with a gold #FFB900 key word,
kept between the top 14% and bottom 20%; overlays only for lines actually said; persistent
date badge; punch-ins every 2-3 s; 1.5 s end card; 1:1 thumbnail with "$1,000 → $50".
Revision: Joe cut step 6 (the P.S. — "Claude edited and created this ad with one voice
prompt") as out of place; the ad now goes from "last chance to grab your tickets" straight
to the end card.

## Assets

- assets/source.mp4 — 1080x1920 SDR (HLG tonemap, Lanczos upscale, light unsharp) of the
  single uploaded file. Only the main take (0.0-29.6 s) is used; the P.S. take (30.0-36.9 s) is cut.
- assets/final.m4a — built by audio.py: original recording cut, 40 ms blends, silence under
  the end card. No processing (source is clean, peaks -2.4 dBFS).
- assets/fonts/NotoColorEmoji.ttf — for the 📅 glyph.

## Decisions

- Removed "It's in seven days and": a relative date goes stale as the ad runs and causes the
  "is it tomorrow?" confusion the badge exists to fix.
- Ends on the last main line ("last chance to grab your tickets"), cut in silence at 29.56 s,
  then the end card. The P.S. take, P.S. card, chat panel and freeze hold were removed.
- Overlays: $1,000 → $50 (said), "40 tradies booked" (he says 40, not 26), "Not worth it?
  Full refund" (said), "No tech skills needed" (said). Tick list skipped: quotes / invoices /
  emails are never listed.
- Framing: wrapper scale 1.17 about the face centre (528,1051), y -147; punch-ins x1.08
  alternate at sentence starts and mid-sentence points (gaps 0.95-3.4 s).
