---
workflow: general-video
flow: automation
storyboard: no
message: "If I still sold cars, this is how I'd use AI to get ahead"
destination: instagram-reels
aspect: 1080x1920
language: en
length: ~113s
angle: talking-head-recut
---

## Intent

Joe's phone-recorded talking head (2m16s, 720x1280) about how a car salesperson
should use Claude, Gmail and Google Sheets to build a CRM and automated follow-ups.
Requested: necessary cuts (dead air, restarts, the swearing ramble at the end,
the CapCut outro), word-timed captions, and animated graphic cards that land on
the moments he looks away from the lens. Tone: direct, punchy, social.

## Assets

- assets/bike.mp4 — H.264 transcode of "Bike video" from Google Drive; the only footage.
- transcript.json — Parakeet word-level transcript in source time.

## Customizations

- Hard cuts authored as multiple `<video>` clips with `data-media-start`; alternating
  1.0 / 1.07 punch-in on the wrapper to sell the jump cuts.
- Cards keyed to transcript word cues; placement chosen from frontal-face
  detection (cards start where the face detector lost a frontal face).
- Captions: one sub-composition track, 2-4 word groups, karaoke gold highlight.
- Closing 2.4s LeadHive card (wordmark + leadhivenz.com).

## Notes

- LeadHive palette from Bloom: gold #EFA41E, navy #0F1A2E, blue #0077C0.
  Brand heading font Space Grotesk is not bundled and Google Fonts is blocked in
  this environment, so Montserrat 900 stands in.
- No emoji (no colour emoji font in the headless renderer). No music bed.
- Kept "shitty AutoPlay" and "It's crap" as personality; cut the "um f*** it"
  and "f***ing something bullshit" lines.
