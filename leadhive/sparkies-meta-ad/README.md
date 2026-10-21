# Sparky partner campaign — Wellington / Hamilton / Christchurch (Meta)

Built 21/10/2026 via Windsor.ai against ad account **act_2069841593323757** (Joe Ingram),
Facebook page **LeadHive NZ (1232945516571020)**. Everything was created **paused**; nothing
spends until Joe enables the campaign.

Template: the existing "Electrician Partner Campaigns" → "Electrician Ad" (ad 120255782861220460,
$355 spend / 616 link clicks), which used an instant lead form. This campaign swaps the instant
form for the website lead form at **https://leadhivenz.com/sparkies** so the pixel's Lead event
is the optimisation goal and Joe gets the enquiry in the same `area_check_enquiries` table and
email as the "Check my area" form.

## IDs

| Object | Name | ID |
|---|---|---|
| Campaign (CBO, $20/day NZD, OUTCOME_LEADS, paused) | Sparky Partner Campaign - Wellington / Hamilton / Christchurch | 120256589869770460 |
| Ad set | Wellington Sparkies | 120256589873310460 |
| Ad set | Hamilton Sparkies | 120256589880000460 |
| Ad set | Christchurch Sparkies | 120256589881300460 |
| Ad | Wellington Sparkies - Joe video | 120256589884960460 |
| Ad | Hamilton Sparkies - Joe video | 120256589885370460 |
| Ad | Christchurch Sparkies - Joe video | 120256589885750460 |
| Ad (edited cut) | Wellington Sparkies - Joe video (edited cut) | 120256590181770460 |
| Ad (edited cut) | Hamilton Sparkies - Joe video (edited cut) | 120256590181930460 |
| Ad (edited cut) | Christchurch Sparkies - Joe video (edited cut) | 120256590182070460 |
| Video (raw "Sparkies" from Drive, 1080x1920, 53s) | Sparkies - LeadHive NZ (Oct 2026) | 1590949935448010 |
| Video (edited cut with captions + report graphics, 26s) | Sparkies - edited - LeadHive NZ (Oct 2026) | 901234829620690 |
| Thumbnail image hash (raw) | sparkies-thumb.jpg (frame at 1s) | 9056e963229e12be5caef3a39a6bc0ee |
| Thumbnail image hash (edited) | sparkies-edited-thumb.jpg ("1 electrician per region" badge frame) | 34d8155f8fb12e98262c4d71e7ec9536 |

## Ad set settings (all three)

- Optimisation: OFFSITE_CONVERSIONS on pixel **2212898842912576**, event **Lead**; billing IMPRESSIONS;
  destination WEBSITE.
- Age 25–65, location types home + recent, Advantage+ audience on (same as the template ad sets).
- Geo (Meta city keys copied from the existing regional ad sets):
  - Wellington key 1673166, 25 mi radius
  - Hamilton key 1671146, 25 mi radius
  - Christchurch key 1670905, 30 mi radius
- One ad set per city so a city can be paused the day its sparky signs.

## Ad creative

Primary text (city swapped per ad):

> {City} sparkies: tired of chasing quotes that go nowhere?
>
> I run Google Ads that put ONE electrician at the top of Google the moment someone in {City}
> needs a sparky right now. They tap. Your phone rings. Nobody else gets that lead.
>
> ✅ Exclusive: only 1 electrician per region
> ✅ Inbound calls from people who need a sparky today, not quote-shoppers
> ✅ Your own landing page + call tracking, ads live within 24 hours
>
> Is {City} still open? Tap below, leave your number, and I'll personally give you a call to tell you straight.

Headline: **Only 1 Sparky Per Region** · Description: **Leave your number. Joe will call you.** · CTA: Learn more

Link per ad (region pre-selects the form's dropdown; UTMs land in the enquiry row):
`https://leadhivenz.com/sparkies?region={city}&utm_source=facebook&utm_medium=paid_social&utm_campaign=sparky-partner-nz&utm_content={city}-video`

## Landing page

**Live:** https://leadhivenz.com/sparkies (alias `/sparky-lead-form`). Published 21/10/2026 from
Lovable project **LeadHiveNZ** (ec2c7f2f-8d9a-4f32-86be-af4f0900e61b), page `src/pages/SparkyLeads.tsx`.
Prerendered and noindex. The `?region=` param is applied after hydration (a post-mount effect), which
was needed because the prerendered select otherwise kept Wellington; verified live for all three ad
links on a 390px viewport. Screenshot: `sparkies-page-mobile.png`. Standalone noindex page, same pattern as `/website`. Form fields:
name, business, mobile, region (Wellington / Hamilton / Christchurch / Somewhere else). Saves to
`area_check_enquiries` with trade = Electrician, emails hello@leadhivenz.com through
`send-contact-email`, fires pixel `Lead` (content_name "Sparky lead form") on success. Success
copy tells them Joe will call within one working day.

## Status

**Enabled 21/10/2026** on Joe's instruction ("press go"): the sparky campaign (5 ad sets, 10 ads)
and the handyman campaign (4 ad sets, 4 ads) are both live at $20 NZD/day CBO each.

## Pre-launch notes (kept for reference)

1. Open https://leadhivenz.com/sparkies?region=hamilton on a phone, submit a test enquiry, confirm the
   email arrives and the Lead event shows in Events Manager (pixel 2212898842912576).
2. Each ad set now holds two ads: the raw 53s cut and the edited 26s cut (captions, Wellington
   37-lead and Tauranga 25-lead report graphics, "Unlike Builderscrack", "Guaranteed"). Same copy
   and link, `utm_content` ends in `-video-edited` for the second. Let both run; expect the edited
   cut to win on hook rate and pause the loser per city after ~1,000 impressions each.
3. Enable the campaign (`enable_campaign` 120256589869770460); ad sets and ads were created paused
   too, so enable those (or just the cities that are open).
4. Budget is $20 NZD/day CBO across three cities. The old electrician campaign ran $10/day on one
   ad set; if the learning phase stalls, cut to one ad set with all three cities.

---

## Update 21/10/2026 (later): Hawke's Bay + Dunedin for sparkies, new handyman campaign

Joe's instruction: make the ads, model them on the existing handyman ad, and press go. So unlike
the first build, everything below was **enabled** after the landing pages were verified live.

### Sparky campaign additions (campaign 120256589869770460, still $20/day CBO)

| Ad set | ID | Geo |
|---|---|---|
| Hawke's Bay Sparkies | 120256590438890460 | region key 2728 (Hawke's Bay) |
| Dunedin Sparkies | 120256590439300460 | city key 1670988, 25 mi |

Ads (same copy/headline/link pattern, `?region=hawke's bay` / `?region=dunedin`):
Hawke's Bay raw 120256590446410460, Hawke's Bay edited 120256590446880460,
Dunedin raw 120256590447270460, Dunedin edited 120256590447910460.
`/sparkies` region dropdown extended to include Hawke's Bay and Dunedin.

### Handyman campaign (new)

Template: "Handyman Partner Campaigns" → "Handymen Ad" (120255503280100460, $604 spend / 989 clicks,
instant form). Replaced the instant form with **https://leadhivenz.com/handymen** (alias
`/handyman-lead-form`), built from the same shared trade-lead-page component as `/sparkies`,
trade saved as "Handyman", regions Tauranga / Hamilton / Dunedin / Hawke's Bay / Somewhere else,
pixel content_name "Handyman lead form". Screenshot: `handymen-page-mobile.png`.

| Object | Name | ID |
|---|---|---|
| Campaign (CBO $20/day NZD, OUTCOME_LEADS) | Handyman Partner Campaign - Tauranga / Hamilton / Dunedin / Hawke's Bay | 120256590435020460 |
| Ad set | Tauranga Handymen (city 1672707, 25 mi) | 120256590437530460 |
| Ad set | Hamilton Handymen (city 1671146, 25 mi) | 120256590438000460 |
| Ad set | Dunedin Handymen (city 1670988, 25 mi) | 120256590438290460 |
| Ad set | Hawke's Bay Handymen (region 2728) | 120256590438590460 |
| Ad | Tauranga Handymen - Joe video v2 | 120256590451720460 |
| Ad | Hamilton Handymen - Joe video v2 | 120256590452380460 |
| Ad | Dunedin Handymen - Joe video v2 | 120256590452660460 |
| Ad | Hawke's Bay Handymen - Joe video v2 | 120256590452900460 |
| Video ("Handymen - edited - PREVIEW.mp4" v2, 28s, captions + Auckland 33 / Wellington 40 lead reports) | Handymen - edited v2 - LeadHive NZ (Oct 2026) | 3053923604944254 |
| Thumbnail image hash | handymen-v2-thumb.jpg ("1 handyman per region" badge frame) | 582cf7931a8f6cc6a146f27afb7c8ef4 |

Ad set settings identical to the sparky ones (Lead-event optimisation on pixel 2212898842912576,
age 25–65, home + recent, Advantage+ audience). Primary text:

> {City} handymen: tired of chasing quotes that go nowhere?
>
> I run Google Ads that put ONE handyman at the top of Google the moment someone in {City} needs a
> job done. They tap. Your phone rings. No competing with 5 other handymen on Builderscrack for the
> same job.
>
> ✅ Exclusive: only 1 handyman per region
> ✅ Inbound calls from people who need the work done now, not quote-shoppers
> ✅ Your own landing page + call tracking, ads live within 24 hours
>
> Is {City} still open? Tap below, leave your number, and I'll personally give you a call to tell you straight.

Headline **Only 1 Handyman Per Region** · Description **Leave your number. Joe will call you.** · CTA Learn more.
Link: `https://leadhivenz.com/handymen?region={city}&utm_source=facebook&utm_medium=paid_social&utm_campaign=handyman-partner-nz&utm_content={city}-video-v2`
