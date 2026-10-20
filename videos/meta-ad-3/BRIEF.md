---
workflow: general-video
flow: automation
storyboard: no
message: "Someone's charging tradies $1,000 for a Claude AI workshop. I'm doing it for $50."
destination: meta-reels-ad
aspect: 1080x1920
language: en-NZ
length: 36.3s
angle: authentic-talking-head-ad
---

## Intent

Joe's detailed brief (Meta/Instagram ad): cut every pause > 0.3 s, ums, false starts; first
word within 0.3 s; word-by-word Montserrat ExtraBold captions with a gold #FFB900 key word,
kept between the top 14% and bottom 20%; overlays only for lines actually said; persistent
date badge; punch-ins every 2-3 s; P.S. card + P.S. take with an animated chat panel ending
on "Posted" as he finishes; 1.5 s end card; 1:1 thumbnail with "$1,000 → $50".

## Assets

- assets/source.mp4 — 1080x1920 SDR (HLG tonemap, Lanczos upscale, light unsharp) of the
  single uploaded file, which holds both takes: main 0.0-29.7 s, P.S. 30.0-36.9 s.
- assets/final.m4a — built by audio.py: original recording cut, 40 ms blends, silence under
  the P.S. card / freeze / end card. No processing (source is clean, peaks -2.4 dBFS).
- assets/last.jpg — freeze frame for the 0.7 s hold after "Posted" lands.
- assets/fonts/NotoColorEmoji.ttf — for the 📅 and 🎙️ glyphs.

## Decisions

- Removed "It's in seven days and": a relative date goes stale as the ad runs and causes the
  "is it tomorrow?" confusion the badge exists to fix.
- P.S. card follows the last main line ("last chance to grab your tickets"); in this take
  the refund line is mid-sentence ("...jobs that you quote, or stay on..."), so it can't end.
- Overlays: $1,000 → $50 (said), "40 tradies booked" (he says 40, not 26), "Not worth it?
  Full refund" (said), "No tech skills needed" (said). Tick list skipped: quotes / invoices /
  emails are never listed.
- Captions hand over to the P.S. headline when the chat panel arrives.
- Framing: wrapper scale 1.17 about the face centre (528,1051), y -147; punch-ins x1.08
  alternate at sentence starts and mid-sentence points (gaps 0.95-3.4 s); base framing while
  the chat panel is up so the mouth stays clear.
- 0.7 s freeze after the last word so "Posted ✓" is readable before the end card.
