---
name: leadhive-playbook
description: LeadHive's operating playbook distilled from the best YouTube training on Google Ads for trades, Local Services Ads, Meta ads for home services, the pay-per-lead model and tradie objections, agency sales calls, and scaling. Use whenever Joe asks how to set up, fix or scale campaigns for a tradie client, price or pitch LeadHive packages, handle a client objection, run a sales or onboarding call, improve lead quality or retention, or decide what to systemise next. Also use when Joe shares a new YouTube video to add to the playbook.
---

# LeadHive Playbook

A reference library for LeadHive NZ / LeadHive AU: inbound lead generation for emergency and home-service trades (plumbers, electricians, etc.). Clients pay a $500 setup fee plus a monthly retainer (NZ: Starter $1,500 for 15–25 leads, Growth $2,000 for 25–35; AU: Starter $1,500 for 15–20, Growth $2,200 for 25–35, Dominator $3,400 for 40–60). One client per trade per region.

The knowledge here comes from YouTube videos watched in full by Gemini and summarised. Treat creator numbers as directional: most are US/USD, and many creators sell a course or service, which each brief flags.

## How to use this skill

1. Identify the topic and read only the reference file you need:

| Question is about… | Read |
|---|---|
| Google Search ads, conversion/call tracking, keywords, landing pages, SERP, Local Services Ads | `references/google-ads-trades.md` |
| Facebook/Instagram ads, instant forms, creative, lead quality on Meta | `references/meta-ads-home-services.md` |
| The pay-per-lead / retainer model, pricing, what tradies think of lead buying, objections, retention | `references/lead-gen-model.md` |
| Sales calls, discovery, closing, objection handling, scripts | `references/sales-process.md` |
| Systems, hiring, scaling, offers, getting more leads for LeadHive itself | `references/scaling.md` |
| Which video taught what, links, quality rating | `references/video-library.md` |
| Exact detail, timestamps, verbatim scripts from one video | `references/sources/<NN>-<topic>-<videoId>.md` |

2. Answer as Joe's business partner: direct, practical, step-by-step. Apply the material to LeadHive's model specifically (exclusive leads, one client per region, emergency trades, NZ/AU markets). Don't just recite the video.
3. Flag when a tactic is US-specific (for example, Local Services Ads availability, US cost-per-click figures) or comes from a creator pitching a paid product.
4. Cite the source video (title + link from `video-library.md`) when a recommendation leans on it.

## Core principles across all sources

- **Tracking first.** No campaign spends before calls and forms are tracked as conversions. You can't prove quality, optimise bids, or defend renewals without it.
- **Speed and answer rate decide lead quality.** Missed calls and slow callbacks kill more leads than bad targeting. Measure and report the client's answer rate.
- **Offer + landing page match.** The ad's offer must be the first thing on the page.
- **Google captures demand; Meta creates it.** Emergency work = Google. Planned work = Meta + Google.
- **Real people beat stock.** Owner/crew photos, job-site video, real reviews.
- **Volume of creative tests wins on Meta** (5–7 variations), and broad targeting with exclusion pins beats micro-targeting.
- **Own the asset, rent the result.** Tradies fear lead-gen because they own nothing when they stop paying. Answer this head-on in sales.

## Adding a new video to the playbook

When Joe shares a YouTube link to learn from:
1. Run the `watch` skill with the Gemini engine and the extraction prompt in `references/extraction-prompt.md`.
2. Save the brief as `references/sources/<next NN>-<topic>-<videoId>.md`.
3. Merge the actionable parts into the relevant topic file under a LeadHive application section.
4. Add a row to `references/video-library.md`.
