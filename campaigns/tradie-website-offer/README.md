# Tradie Website $500 — Meta campaign

Offer: Joe builds a tradie a website for **$500**. A live, personalised demo is built first,
for free, and nothing is paid until the tradie has seen it. Sold on Meta (Facebook + Instagram)
with a 26s vertical talking-head video, sending clicks to a form on leadhivenz.co.

## Landing page

- Live: https://leadhivenz.co/website (Lovable project LeadHiveNZ, `ec2c7f2f-8d9a-4f32-86be-af4f0900e61b`)
- Standalone route, noindex, not in nav/footer/sitemap. Same build pattern as `/workshop`.
- Form fields (all required): name, mobile, email, business name, location (town/city).
- Saves to the `website_demo_enquiries` table (insert-only public access, no public read)
  and emails the enquiry to hello@leadhivenz.com via the `send-contact-email` edge function
  (type `website-demo`). Utm params, fbclid and page URL are stored on each row.
- Meta pixel `2212898842912576`: `ViewContent` on page load (content_name "Tradie website $500"),
  `Lead` only after a successful save (content_name "Website demo").

## Meta Ads (ad account 2069841593323757, NZD)

| Object   | Name                              | ID                  |
|----------|-----------------------------------|---------------------|
| Campaign | Tradie Website $500 - NZ          | 120256460133070460  |
| Ad set   | NZ Tradies - Website Demo Lead    | 120256460133520460  |
| Ad       | Website offer video v1            | 120256460158410460  |
| Video    | Tradie Website offer              | 1879131369738619    |

- Objective `OUTCOME_LEADS`, ad set budget **$20/day**, lowest cost, no cap.
- Optimisation: website conversions on pixel `2212898842912576`, event `LEAD`.
- Page: LeadHive NZ (`1232945516571020`).
- Targeting copied from the live workshop campaign: all of New Zealand (home + recent),
  ages 25–65, Advantage+ audience on, Facebook + Instagram, automatic placements.
- Link: `https://leadhivenz.co/website?utm_source=meta&utm_medium=paid_social&utm_campaign=tradie-website-500&utm_content=video-v1`

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
