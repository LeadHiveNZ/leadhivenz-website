---
name: hostfix-playbook
description: HostFix's launch, sales, onboarding and setup playbook, distilled from YC, marketplace and short-term-rental founder videos. Use whenever Joe asks about HostFix (the fixed-price maintenance app connecting Airbnb hosts and property managers with vetted tradies): launching or onboarding founding properties, signing tradies, onboarding property managers or cleaners, pricing and fees, sales calls and outreach to hosts, ad copy, growth channels, competitors (Turno, Breezeway, Hospitable), metrics, or what to do next. Also use when Joe shares a new video to add to the HostFix playbook.
---

# HostFix Playbook

## What HostFix is (as of 19 Nov 2026)

- **Product:** an app that connects Airbnb/short-term-rental owners and property managers with fully vetted tradies (public liability insured) for common maintenance jobs at **fixed prices, with no call-out fee**. The owner sets up each property once (lockbox code, water mains and switchboard locations, house details). Jobs can be logged by the owner, their **cleaner** or their **guests via a QR code** (with owner approval). A tradie accepts within **15 minutes** and the job is done within **24 hours**. The owner gets a text at every step.
- **Value:** owners get fixed, affordable prices and convenience. Tradies get guaranteed work.
- **Launch:** Queenstown/Wanaka first. Offer: **25 founding properties at half price**. Meta ads running (Queenstown 40 km video, NZ-wide video, "founding partners"). Ad → form → "how it works" video → Joe calls.
- **Traction at 19 Nov 2026:** 9 inbound leads covering at least 121 properties, including two Queenstown property managers with **63** and **30** properties. Waitlist leads outside Queenstown (Tauranga, Dunedin). Live lead status is in Joe's Google Drive sheets "HostFix Launch List" and "HostFix Leads". Read those for current names and status; don't rely on this summary.
- **Founder context:** Joe also runs LeadHive (lead generation for NZ/AU tradies: 12 tradie clients in NZ) and The Tipsy Tui. LeadHive's tradie relationships are HostFix's unfair advantage on the supply side.

## How to use this skill

| Question is about… | Read |
|---|---|
| Launching, first customers, the MVP, doing it manually, waitlist to paid | `references/launch-and-first-customers.md` |
| Getting and keeping tradies (supply), cold start, quality, the 15-minute promise | `references/marketplace-supply.md` |
| Selling to hosts and managers, pricing, fees, offers, call and message scripts | `references/sales-and-pricing.md` |
| Onboarding a property manager, owner, tradie or cleaner (step by step) | `references/onboarding.md` |
| Turno, Breezeway, Hospitable, host tools, market statistics, positioning | `references/competitors-and-market.md` |
| Marketing channels, Facebook groups, cleaner partnerships, referrals, ads, app store | `references/growth-channels.md` |
| What to do this week, metrics and product-market fit | `references/launch-plan.md` |
| Which video said what, with links | `references/video-library.md` |
| Exact detail, scripts or timestamps from one video | `references/sources/<NN>-<topic>-<videoId>.md` |

Answer as Joe's business partner: direct, practical, step by step, with challenges where needed. Apply the material to HostFix specifically (a two-sided local marketplace in a NZ resort town with a tradie shortage). Flag US-specific numbers, and creators who are pitching their own product.

## Core principles

1. **Launch = the first job completed, not the app going live.** Run jobs by hand (text in, Joe dispatches) before the app is finished.
2. **Supply first.** Tradies are the harder, rarer side. Never advertise "15 minutes / 24 hours" in an area without at least 2–3 committed tradies per trade.
3. **Seed with the best.** The best-reviewed tradies and the biggest property managers create trust for everyone else.
4. **Paid, not free.** Founding discounts are fine; free pilots aren't. A paid plan with a 30–60 day money-back guarantee beats a free trial.
5. **Founder-led sales and speed to lead.** Joe calls or texts every lead the same day. Don't hire sales until Joe knows the script works.
6. **Use the customer's words.** Interview hosts about how they handle repairs today and write the ads in their phrases.
7. **Measure repeat usage.** Jobs per property per month and repeat jobs are the product-market fit signal, not sign-ups.
8. **Simple at one door.** 85% of hosts are small (fewer than 7 properties). Onboarding must take minutes, and the tradie and cleaner side must feel as easy as Instagram.

## Adding a new video
1. Run the `watch` skill with the Gemini engine, passing `references/extraction-prompt.md` as `--question`. If that fails, run `python3 <this skill dir>/scripts/watch_direct.py "<url>" > brief.md`.
2. Discard any output that says "please provide the link", because Gemini couldn't see the video.
3. Save it as `references/sources/<next NN>-<topic>-<videoId>.md`, merge the useful parts into the right topic file, and add a row to `video-library.md`.
4. The Gemini free tier allows about 20 requests per model per day.
