# Google Ads for Trades — LeadHive Playbook

Distilled from: Surfside PPC (conversion tracking, ep. 31), Mammoth for Plumbers (SERP tour), Josh Nelson / Plumbing & HVAC SEO (LSA webinar), Leonid Kaplan (electrician search campaign). Full briefs are in `sources/`. Figures are mostly USD and US-market; treat them as directional for NZ/AU.

## 1. Conversion tracking — do this before spending a dollar

Without it, Google's bidding is blind and you can't prove lead quality to clients. Source: Surfside PPC, `sources/01-*`.

**Stack:** Google Tag Manager (GTM) on the landing page → Google Ads tag + Conversion Linker → one conversion action per lead type.

Setup order:
1. Install GTM on the site (WordPress: free **WPCode** plugin → Header box = GTM head script, Footer box = GTM body script). Verify with the **Google Tag Assistant** Chrome extension.
2. GTM → New Tag → Google Ads → **Google Tag** with your `AW-XXXXXXXXX` ID, trigger **Initialization – All Pages**.
3. GTM → New Tag → **Conversion Linker**, trigger All Pages. *Missing this breaks attribution.*
4. **Form leads:** Google Ads → Create conversion → Website → category "Submit lead form", **Primary**, Count = **One**. In GTM fire a Google Ads Conversion Tracking tag on Page View where URL contains `thank-you`. (Forms must redirect to a thank-you page.)
5. **Three separate call conversions** (the core of emergency-trade tracking):
   - **Calls from ads** (call assets + Google Business Profile location asset) — Primary.
   - **Calls from website** (Google forwarding number swap). The "displayed number" in Google Ads must match the site's formatting *exactly* (spaces, brackets, dashes) or the swap fails. GTM tag type "Google Ads Calls from Website Conversion", trigger All Pages.
   - **Mobile click-to-call** — GTM: enable built-in Click variables → trigger "Click – Just Links", Click URL contains `tel:`. Warning: counts taps, not completed calls, so it over-counts (especially in Performance Max). Use it as a secondary signal.
   - Default call-length threshold is ~60s. For emergency trades consider setting the qualified-call threshold deliberately (e.g. 60–90s) so wrong numbers don't train the algorithm.
6. Debug with GTM **Preview** before publishing.
7. Campaign → Settings → Goals → **Use campaign-specific goals** → select only the lead form + call goals.
8. Bidding: start **Maximize Conversions**, move to **Target CPA** once there's enough conversion data.

Warning from the video: too many different root domains inside one Google Ads account can trigger automated suspension. Relevant to LeadHive running many client landing pages — use a consistent domain structure (e.g. LeadHive-owned sub-pages or one domain per client per account) and consider separate accounts per region/brand.

**LeadHive application**
- Every client page gets all three call conversions + form conversion before launch. Make this a launch checklist item.
- Use a call-tracking number per client so you own the call log, can play recordings in disputes, and can show "X calls, Y over 60s" in monthly reports. This is your retention weapon.

## 2. What the plumber SERP actually looks like (who you compete with)

Source: Mammoth for Plumbers SERP tour, `sources/03-*`.

Top to bottom for "plumber" / "plumber near me":
1. **Local Services Ads** ("Sponsored plumbers in [city]") — pay per call, ~$30–$100/call (US). Google refunds invalid calls.
2. **Search ads** ("Sponsored results") — ~**$60/click** in his market; **2–4 clicks per phone call** typical (range 2–10).
3. **Map Pack** (4 Google Business Profiles) — proximity to the searcher dominates. Paid "location asset" can sponsor a listing into the pack.
4. People-also-ask / directories (Yelp, aggregators).
5. Organic results — pushed far down; ~7 sponsored placements on page 1 and only 3–4 true organic slots out of ~16 company placements.

Tactics called out:
- Offer-led search ads win: "$69 diagnostic" beats "$99 diagnostic". **The landing page must show the same offer immediately** or the click is wasted.
- Put a **call asset** ("Call us") on every ad.
- **Business hours**: if GBP/LSA hours end at 4pm, you vanish for 5pm searches. After-hours = less competition, higher urgency.
- Reviews: 100 → 1,000 is a big trust jump; 1,000 → 7,000 matters less.
- Real photos of techs on jobs beat stock/headshots.
- Audit visibility by searching "plumber near me" **~10 miles away** from the shop.
- Track GBP impressions year-on-year (export; Google's UI only shows ~6 months).

**LeadHive application**
- Your search ads compete *under* LSAs. Win on offer + speed + after-hours coverage. Emergency plumbers who answer 24/7 should have ad schedules running nights/weekends.
- Use the "$X call-out / diagnostic" style offer where the client agrees to one. Mirror it on the landing page hero.
- Sales angle: show prospects this SERP breakdown — "organic SEO alone can't win page 1 any more".

## 3. Local Services Ads (LSA) — threat, benchmark, and possible upsell

Source: Josh Nelson webinar, `sources/05-*` (US-focused; check whether LSA is available in your target country and category before relying on it).

- Pay per lead, Google Guaranteed/Screened badge, background checks for owner + field techs.
- Average CPL **$25–$45** (trade/market dependent). Example: $2,000/month at $35 CPL ≈ 57 leads/month.
- Disputable leads: solicitations, spam/robocalls, out-of-area, services not offered.
- **Ranking factors:** proximity; rating + number of *LSA-native* verified reviews; **call answer rate (target 95–100%)**; listed hours; complaints.
- 5-step process: dial in profile/area/budget → mark every lead as booked → dispute invalid leads → drive native verified reviews → target **85% booked rate**.
- Set budget caps above expected spend so the cap never throttles leads; extend hours to evenings/weekends only if someone actually answers (unanswered calls tank ranking).
- Management market price: ~$549–$597/month for up to 75 leads, +$150/month per extra location, $500 setup (Plumbing & HVAC SEO's offer). **Useful as a price anchor in LeadHive sales calls.**

**LeadHive application**
- LSA CPL ($25–$45 US) is your clients' alternative. Your price per lead must be justified by exclusivity, quality filtering, speed, and reporting.
- Possible upsell: "LSA management" for clients in markets where it exists — set up profile, mark leads, dispute, push reviews.
- Borrow the **answer-rate rule** for your own clients: missed calls are the #1 lead-quality complaint that is actually the client's fault. Track and report answer rate.

## 4. Plumber search campaign structure (the most complete build)

Source: Max Conversion, `sources/02-*`. This is the best single template for LeadHive's plumbing clients.

**Settings**
- Campaign without guidance → Search. **Search Partners off, Display off.**
- Location: **Presence only** ("people in or regularly in"). The default "presence or interest" pays for out-of-area clicks.
- City or radius (~20 miles / ~30 km) around the client's base.
- Ad schedule: start with the hours someone actually answers the phone. Go 24/7 only with a night answering service. (For true emergency clients who answer 24/7, after-hours is the gold mine.)
- Bidding: he starts on **Clicks with a max CPC (~US$15 for plumbing)** until there are ~30 days of tracked leads, then moves to Maximize Conversions. Surfside starts on Maximize Conversions directly. **LeadHive rule:** if tracking is live and budget is at least ~$50/day, start on Maximize Conversions; on a small budget or brand-new account, run capped Max Clicks for 2–4 weeks first.
- Budget: minimum US$25–50/day; US$100–200/day is ideal for plumbing.

**Keywords:** no broad match. Use exact (`[plumber auckland]`) and phrase (`"plumber near me"`).

**Six ad groups, one per service:**
1. General plumbing
2. Emergency / 24-hour plumbing
3. Drain cleaning / blocked drains
4. Hot water (water heater) service
5. Leak detection and repair
6. Toilet and fixture repair

**Ad copy formula:** H1 = relevance (DKI `{KeyWord:Plumber Auckland}`), H2 = offer ("$100 Off Emergency Plumbing"), H3 = CTA ("Call Now – Same Day Service").
Example description: "2 plumbers available now, working nightshift. Give us a call – we'll be there within 2 hours."
Callouts: "500+ Five Star Reviews", "Licensed & Insured", "24/7 Emergency Service", "Lifetime Warranty".

**Assets (all of them):** business name + logo, sitelinks (use `?s=1`, `?s=2` when they point to the same page), callouts, structured snippets (Service catalog), **call asset (mandatory)**, **price assets** (at least 3, e.g. "Hot water replacement from $1,500", which pre-qualifies out price shoppers), promotion asset.

**Negatives:** DIY, how to, YouTube, cheap, free, jobs, career, salary, apprenticeship, course, parts, Bunnings/Mitre 10 (NZ/AU versions of Home Depot), plus **competitor names** pulled from Google Maps. Use AI to draft the list, then prune.

**Audiences:** add plumbing/home-improvement segments in **Observation**. Exclude age 18–24. Consider excluding renters.

**Landing page:** a dedicated page per service, not the client's website. **Loads in under 2 seconds on mobile** (check with PageSpeed Insights). Sticky Call Now + Get Estimate buttons, review count, licence/association badges, service-area map, short form (name, phone, email, service needed).

**LeadHive application:** this is the default build for every new plumbing client. Copy the six-ad-group structure for electricians (emergency/power out, switchboard, lighting, smoke alarms, EV chargers, general).

## 5. Search campaign build for a trade (electrician example)

Source: Leonid Kaplan, `sources/04-*`. Note: this creator runs pay-per-call style campaigns and sells a plugin; treat some settings as aggressive.

Useful settings:
- Campaign without guidance → **Search**. Naming convention like `elec - MaxClicks - generic - CBA300%`.
- **Turn off Display Network and Search Partners.**
- Locations: bulk-paste postcodes **and set the country restriction** so codes don't match other countries. Use **Presence: people in or regularly in** your locations.
- Ad schedule matches when calls get answered.
- Keywords: `[trade] near me`, `emergency [trade]`, `licensed [trade]`, `24 hour [trade]`, `[service] repair`, etc.
- Use dynamic keyword insertion `{KeyWord:Default}` in 1–2 headlines; **never** with brand keywords.
- Logo asset must match the landing page logo or it gets rejected.

Treat with caution:
- Max Clicks with a $1.25 CPC cap — fine for cheap test traffic, but for LeadHive optimise for conversions once tracking is live.
- Setting the in-market audience "Home & Garden Services" to **Targeting** narrows reach a lot. Default to **Observation** unless volume is too high and junk.
- AI Max for Search: test it, but watch the search terms report closely.
- Big image assets increase clicks but can cut conversion rate (accidental taps).

## 6. LeadHive Google Ads launch checklist

1. Landing page: one trade, one city, phone number above the fold, offer that matches the ads, thank-you page redirect.
2. GTM + Google tag + Conversion Linker.
3. Conversions: form (Primary), calls from ads (Primary), calls from website (Primary), click-to-call (Secondary).
4. Call tracking number per client; recordings on.
5. Search only (no Display, no Search Partners), presence-only location targeting, country restriction.
6. Emergency + near-me + service keyword groups; negative keywords for jobs, DIY, courses, salary, cheap/free (adjust per trade).
7. Call asset + location asset (client GBP) + sitelinks + offer callout.
8. Ad schedule = hours the client actually answers.
9. Bid: Maximize Conversions → Target CPA after ~30 conversions.
10. Weekly: search-terms review, call log review, answer-rate check, report to client.
