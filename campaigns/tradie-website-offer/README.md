# Tradie Website $500 — Meta campaign

Offer: Joe builds a tradie a website for **$500**. A live, personalised demo is built first,
for free, and nothing is paid until the tradie has seen it.
Hosting is **$20/month** on top. Joe's call: it's raised on the sales call, not in the ad or on
the page. Sold on Meta (Facebook + Instagram)
with a 26s vertical talking-head video, sending clicks to a form on leadhivenz.co.

## Landing page

- Live: https://leadhivenz.com/website (Lovable project LeadHiveNZ, `ec2c7f2f-8d9a-4f32-86be-af4f0900e61b`).
  The site moved from leadhivenz.co to leadhivenz.com on 13/10; .co redirects to .com (302) and
  keeps the query string, so the ad's utm tags and fbclid still arrive. The ad still links to
  .co; switch it to .com only when the creative is next changed (a link edit resets learning).
- Standalone route, noindex, not in nav/footer/sitemap. Same build pattern as `/workshop`.
- Promise on the page: "See your free website demo within 24 hours" (Joe's call, 13/10).
- Form sits in the hero (first screen on a 390x844 phone) and has two steps (since 13/10,
  Lovable commit e33f097):
  - Step 1: name + mobile → saved to `website_demo_starts` (insert-only, no public read).
  - Step 2: business name, location, email (all required) → saved to `website_demo_enquiries`
    and emailed to hello@leadhivenz.com via `send-contact-email` (type `website-demo`).
  - Both rows carry the same `session_id`. Utm params, fbclid and page URL are stored too.
- "Didn't finish" alert: `notify-unfinished-website-demos` runs every 10 minutes (pg_cron).
  A step-1 start older than 15 minutes with no matching enquiry gets one email
  "⏳ Didn't finish the website form: {name}" with a Call now button.
- Meta pixel `2212898842912576`: `ViewContent` on page load (content_name "Tradie website $500"),
  custom `WebsiteFormStart` (first field focus) and `WebsiteStep1` (step 1 passed), and
  `Lead` only after step 2 saves (content_name "Website demo"). Ad set still optimises on `Lead`.

## Meta Ads (ad account 2069841593323757, NZD)

| Object   | Name                              | ID                  |
|----------|-----------------------------------|---------------------|
| Campaign | Tradie Website $500 - NZ          | 120256460133070460  |
| Ad set   | NZ Tradies - Website Demo Lead    | 120256460133520460  |
| Ad       | Website offer video v1            | 120256460158410460  |
| Video    | Tradie Website offer              | 1879131369738619    |

- Objective `OUTCOME_LEADS`, ad set budget **$25/day** (raised from $20 on 13/10), lowest cost, no cap.
- Optimisation: website conversions on pixel `2212898842912576`, event `LEAD`.
- Page: LeadHive NZ (`1232945516571020`).
- Targeting copied from the live workshop campaign: all of New Zealand (home + recent),
  ages 25–65, Advantage+ audience on, Facebook + Instagram, automatic placements.
- Link (redirects to .com): `https://leadhivenz.co/website?utm_source=meta&utm_medium=paid_social&utm_campaign=tradie-website-500&utm_content=video-v1`

### Creative

- Video: Google Drive "Tradie Website offer" (`1ydAykZpFawbOVLyNIHcoO_7oW41MoC49`),
  1080x1920, 25.9s, burned-in captions.
- Thumbnail: frame at 9.8s ("$10,000 → $500, pay after you see it"), `thumb.jpg` in this
  folder, hosted at https://leadhivenz.co/ads/website-offer-thumb.jpg.

Primary text:

> I was speaking to a tradie who got charged $10,000 for his website. Ten grand. I even hear
> of $3–5k, which is just ridiculous.
>
> I'll build yours for $500. And you don't pay me a cent until you've seen it.
>
> ✅ Free live demo, personalised to your business
> ✅ Shows up on Google (built SEO-ready)
> ✅ Ready to plug Google Ads into
> ✅ Send it to your customers for reviews
>
> Tap the link, fill out the quick form, and I'll build your live demo for free.

- Headline: `Your Tradie Website for $500`
- Description: `Free live demo first. Pay after you see it.`
- Button: Get offer

## Launch log

- 12/10/2026 (NZT): page published (Lovable commits 5dde153, 2a43a23); live checks returned 200
  for `/website` and the thumbnail. Test insert accepted, public read returned nothing, test
  row deleted. Test email ("TEST - Claude launch check") landed in the hello@leadhivenz.com
  inbox, so the Resend key works.
- Campaign, ad set and ad switched on at $20/day. The ad goes through Meta review before it
  delivers.

## Reading the numbers

At $20/day expect Meta to stay in the learning phase (it wants ~50 Leads a week per ad set).
Judge it on cost per lead and lead quality over 7 days / ~$140, not day by day:

- Cost per lead under ~$25 and real businesses in the form: keep running, add a second video.
- No leads after ~$100: check the form email arrives, then test a new first 3 seconds of video.
- Lots of leads but junk (no real business name): add a "What trade are you?" field.

## Audit 13/10/2026 (first ~36 hours, Windsor + leads table)

| Metric | Value |
|---|---|
| Spend | $35.66 |
| Impressions / frequency | 1,329 / ~1.2 |
| CPM | $26.83 |
| 3-second view rate (hook) | 28% (373 views) |
| Link clicks / CTR | 28 / 2.1% |
| Landing page views | 25 (89% of clicks) |
| Leads (pixel = table = inbox) | 4 |
| Page view → lead | 16% |
| Cost per lead | $8.92 |

- Video: 54% of 3s viewers reach 25% (6.5s), 33% reach 50% (13s). The $500 offer lands at
  ~9.8s, so fewer than half of the people who stop hear the price.
- Placements: Facebook Reels took 62% of spend for 1 lead; Facebook + Instagram feeds took
  22% for 3 leads. Too few leads to cut anything; recheck at 10 leads.
- Age: Meta credits 3 of 4 leads to 55–64s (14% of spend). Men 25–54 took 66% of spend for 1.
- Lead mix: 1 tiler, 1 charity, 2 to qualify. No spam; every lead came from an ad click.
- Rankings still UNKNOWN (not enough data). No edits made to the ad set.

## Form change 13/10/2026: how to judge it

Baseline before the change: 4 leads from 25 Meta landing page views (16%), or ~10% against
the site's own page-view count. Compare the next ~150 landing page views against that. The new
`WebsiteFormStart` and `WebsiteStep1` events show where people drop: page → start → step 1 →
lead. Count step-1-only people Joe reaches by phone as leads too.

## Budget log

| Date (NZT) | Daily budget | Why |
|---|---|---|
| 12/10/2026 | $20 | Launch |
| 13/10/2026 7:30pm | $25 | Joe's call after 4 leads at ~$9.65. Next step ~$30 in 2–3 days if cost per lead stays under ~$15 and at least one lead has paid. |
