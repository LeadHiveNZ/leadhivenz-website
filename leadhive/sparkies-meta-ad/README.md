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
| Video (raw "Sparkies" from Drive, 1080x1920, 53s) | Sparkies - LeadHive NZ (Oct 2026) | 1590949935448010 |
| Thumbnail image hash | sparkies-thumb.jpg (frame at 1s) | 9056e963229e12be5caef3a39a6bc0ee |

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

## Before enabling

1. Open https://leadhivenz.com/sparkies?region=hamilton on a phone, submit a test enquiry, confirm the
   email arrives and the Lead event shows in Events Manager (pixel 2212898842912576).
2. "Sparkies - edited - PREVIEW.mp4" in Drive is still private to hello@leadhivenz.com, so only the
   raw "Sparkies" video is in the ad account. Set the edited file to "Anyone with the link", then
   upload it (Windsor `create_ad_video` with the Drive direct-download URL) and add it as a second
   ad in each ad set for an A/B test.
3. Enable the campaign (`enable_campaign` 120256589869770460); ad sets and ads were created paused
   too, so enable those (or just the cities that are open).
4. Budget is $20 NZD/day CBO across three cities. The old electrician campaign ran $10/day on one
   ad set; if the learning phase stalls, cut to one ad set with all three cities.
