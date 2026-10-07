/**
 * Long-form guides. Written to rank for generic searches NZ tradies make
 * ("marketing for tradies nz", "google ads for plumbers", "tradie leads")
 * and to be quotable by AI answer engines: short, factual paragraphs,
 * real numbers, and a clear answer near the top.
 *
 * Body format: "## " = heading, "- " = bullet, blank line = new paragraph.
 */
export type Guide = {
  slug: string;
  title: string;      // H1 + <title>
  short: string;      // footer / card label
  description: string;
  published: string;  // ISO date
  updated: string;
  readMins: number;
  answer: string;     // one-paragraph direct answer shown at the top (and used for AI snippets)
  body: string;
  faqs: { q: string; a: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "marketing-for-tradies-nz",
    title: "Marketing for tradies in NZ: what actually works in 2026",
    short: "Marketing for tradies NZ",
    description:
      "A straight guide to tradie marketing in New Zealand: what brings in urgent jobs (Google Ads, Google Business Profile, reviews), what wastes money, and what a plumber or sparky should do first.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 7,
    answer:
      "For a New Zealand plumber, electrician or handyman who wants more jobs this month, the marketing that works is the kind that catches people the moment something breaks: Google Search Ads on urgent keywords, a Google Business Profile with recent reviews, and a phone that gets answered. Social media, SEO and websites help over years. Search ads and reviews help this week.",
    body: `## Start with how your customers actually find a tradie

Nobody browses for a plumber. A pipe bursts at 7pm, the power trips on a Sunday, the back door won't lock. The homeowner grabs their phone, types "emergency plumber Christchurch" or "electrician near me", and rings whoever is at the top. That whole decision takes under two minutes.

So the question for a tradie isn't "how do I get my name out there". It's "who is at the top of Google in my area at 7pm on a Tuesday, and is it me?"

## The channels, ranked by how fast they pay

- Google Search Ads: live in 24 hours, phone rings in days. You only pay when someone searching for your trade in your area clicks. This is the fastest lever a small trade business has, and it's what LeadHive runs for partners.
- Google Business Profile (the map listing): free. Keep it accurate, add photos monthly, and ask every happy customer for a review. The map pack sits right under the ads and people trust the star rating.
- Referrals and word of mouth: the best quality jobs you'll ever get, but there's no volume knob. Most NZ tradies rely on this almost entirely, which is why a quiet month hurts so much.
- Local SEO (ranking your own website): real, but slow. Six to twelve months of consistent work before it moves the phone, and the big directories already own most of the first page.
- Social media: great for brand and recruitment, poor for urgent jobs. Nobody with water through the ceiling is scrolling Instagram for a plumber.
- Lead directories and marketplaces: fast, but the same lead usually goes to three to five businesses and you're quoting against all of them.

## What we see across LeadHive campaigns

Since February 2026 we've tracked 1,361 inbound calls and 249 web enquiries across 17 trade campaigns in New Zealand. A few patterns hold up everywhere:

- Urgent and repair searches convert far better than "best plumber" or "plumbing company" searches. We only bid on the panic words.
- Calls beat forms roughly five to one. A tradie landing page needs a giant tap-to-call button, not a quote form.
- A live, well-tuned area produces between 15 and 50 tracked enquiries a month depending on the trade and the city. Handymen and electricians in Wellington and Auckland sit at the top of that range.
- About 18% of tracked calls go unanswered. Every one of those is a job that went to the next tradie down the page.

## What to do first if you're flat out already

Being busy isn't a reason to skip marketing, it's a reason to be choosier. Good inbound flow lets you take the hot water cylinder swap and pass on the dripping tap. The goal isn't more work, it's more of the work you want, on days you want it.

## What to do first if you're quiet

Fix the phone before you spend a dollar. Answer, or call back within an hour. Then put a search campaign live on urgent keywords in a tight radius, with a dedicated landing page and call tracking so you can hear every call. If you'd rather not build that yourself, that's exactly what a tradie lead generation service should do for you, exclusively.

## The one rule that protects your money

Exclusivity. If the business sending you leads also sends the same lead to your competitors, you're not buying leads, you're buying a bidding war. Ask any marketer or lead company one question: "does anyone else in my trade in my area get this lead?" If the answer is anything but a flat no, walk.`,
    faqs: [
      { q: "What's the best marketing for a tradie in NZ?", a: "For urgent, repair and maintenance work, Google Search Ads on emergency keywords plus a well-kept Google Business Profile. For long-term brand, add reviews and a simple website. Social media is useful for recruiting and brand, not for the 7pm burst-pipe call." },
      { q: "How much should a tradie spend on marketing?", a: "A useful benchmark for a one-van trade business is 5 to 10% of revenue. A $300k plumbing business putting $1,500 to $2,500 a month into a channel that returns 15 to 35 jobs-worth of enquiries is well inside that." },
      { q: "Do tradies need a website?", a: "A basic one, yes, mostly so your Google Business Profile has somewhere to point. For paid search you're better off with a dedicated landing page built for one job: making the phone ring." },
    ],
  },
  {
    slug: "google-ads-for-tradies-nz",
    title: "Google Ads for tradies in NZ: real numbers from 17 campaigns",
    short: "Google Ads for tradies NZ",
    description:
      "How Google Ads works for plumbers, electricians and handymen in New Zealand, with real monthly lead numbers from 17 LeadHive campaigns, the keywords that convert and the mistakes that burn budget.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 8,
    answer:
      "Google Ads works for NZ tradies when it's search-only, bid on urgent keywords in a tight radius, pointed at a mobile landing page with click-to-call, and tracked call by call. Done that way, a single trade area in a New Zealand city typically produces 15 to 50 tracked enquiries a month. Done the default way (broad match, display, pointed at your homepage) it mostly produces regret.",
    body: `## What a tradie Google Ads campaign looks like when it works

- Search ads only. No display, no YouTube, no Performance Max for a one-van business.
- Keywords are the panic words: "emergency plumber", "no hot water", "blocked drain", "no power", "electrician near me", "handyman near me". Phrase and exact match, with a long negative list.
- A tight radius. Christchurch, not Canterbury. Tauranga, Mount and Papamoa, not the Bay of Plenty.
- Ads run when you can answer. If you don't take calls after 9pm, the ads shouldn't run after 9pm.
- A dedicated mobile landing page with one job: get the tap on the call button.
- A tracking number on the ad and the page so every call is logged, timed and recorded.

## The numbers from LeadHive campaigns

These are tracked calls plus web enquiries per full month, from Nimbata call tracking and website forms, across live LeadHive partner areas in 2026. They're raw counts before dud calls are removed.

- Wellington handyman: 42 a month average, best month 50.
- Wellington electrician: 39 a month average, best month 48.
- Auckland handyman: 39 a month average, best month 58.
- Hamilton electrician: 34 a month average, best month 42.
- Wellington plumber: 29 a month average, best month 49.
- Tauranga electrician: 27 a month average, best month 47.
- Christchurch handyman: 26 a month average, best month 33.
- Christchurch plumber: 21 a month average, best month 35.
- Hawke's Bay plumber: 21 a month average, best month 28.

Smaller or newer areas (Auckland electrician, South Auckland, Tauranga plumber) sit in the 10 to 20 range while the campaign learns. The first two months are always the slowest.

## The keywords that convert

Across every campaign, the searches that turn into real jobs are the ones with a problem in them. "Hot water cylinder leaking". "Switchboard tripping". "Fence blown down". "Toilet blocked". People searching "plumber" on its own are often looking for a price list, a job, or the number of a plumber they already use. We still bid on them, but lower.

## Where tradies waste money on Google Ads

- Broad match keywords. Google will happily show your plumbing ad to someone searching "plumbing course".
- Sending clicks to your homepage. A homepage has twelve things on it. A landing page has one.
- No call tracking. If you can't hear the calls you can't tell which keywords are paying and which are parts enquiries.
- Running 24/7 when the phone isn't answered 24/7.
- Quitting in week three. Google's bidding needs a few dozen conversions to settle. Three months is the honest minimum.

## Should you run it yourself?

You can. The Google Ads interface is free and the help docs are decent. The honest cost is time: a well-run trade campaign needs search-term reviews every week, call reviews, bid changes and ad copy rotation. Most tradies who try it stop after a couple of months because they're on the tools all day. If you'd rather hand it off, the thing to insist on is exclusivity in your area and the ability to listen to every call yourself.`,
    faqs: [
      { q: "How much does Google Ads cost for a plumber in NZ?", a: "Clicks on urgent plumbing searches in NZ cities commonly cost between $5 and $20 each. With a tight campaign, a monthly ad budget around $800 to $1,100 produces 15 to 35 tracked enquiries in most NZ cities. LeadHive includes that ad spend in the monthly fee." },
      { q: "How long before Google Ads brings in jobs?", a: "Ads go live within a day. First calls usually land inside two to three days. Consistent volume takes four to eight weeks as Google learns which searches turn into calls." },
      { q: "Is Google Ads better than Facebook ads for tradies?", a: "For urgent and repair work, yes, by a wide margin, because search catches people while they have the problem. Facebook and Instagram are better for brand, recruiting, and bigger planned jobs like renovations." },
    ],
  },
  {
    slug: "exclusive-vs-shared-leads",
    title: "Exclusive leads vs shared leads: what NZ tradies need to know before paying for either",
    short: "Exclusive vs shared leads",
    description:
      "The difference between exclusive tradie leads and shared directory leads in New Zealand, why shared leads turn into bidding wars, and the questions to ask any lead generation company.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 5,
    answer:
      "A shared lead is one enquiry sold to several tradies at once, so you compete on price and speed with everyone else who bought it. An exclusive lead goes to one business only. Shared leads look cheap per lead but close far less often; exclusive leads cost more per lead and close at a rate that makes the maths work. For urgent trade work, exclusive is the only model where the homeowner isn't fielding five calls.",
    body: `## How shared leads actually work

A homeowner fills in a form on a directory or marketplace: "need a plumber, blocked drain, Hornby". The platform sells that one form to three, four or five plumbers. Each pays. All five ring the homeowner inside ten minutes. The homeowner picks the cheapest or the first, and four plumbers paid for nothing.

That's not a lead. That's an auction, and you're the product.

## How exclusive leads work

The homeowner searches, sees one ad, lands on one page, and rings one number. That number forwards to one plumber. There's no form to sell on, because the lead is a phone call. Nobody else gets it. The plumber isn't competing on price because the homeowner hasn't spoken to anyone else.

Exclusive leads cost more per lead because the business generating them can only sell each one once. They also close at two to four times the rate of shared leads, in our experience, because the homeowner is talking to one tradie, not five.

## The maths most tradies skip

Say shared leads cost $40 each and you close one in five. That's $200 per job. Say exclusive leads work out at $75 each and you close one in two. That's $150 per job, with far less quoting, fewer wasted calls and no racing the next guy to the phone. Cheaper per lead is not cheaper per job.

## Questions to ask any lead company

- Does anyone else in my trade in my area receive the same lead? (Only "no" is acceptable.)
- Is the lead a phone call or a form? (Calls close. Forms get shopped.)
- Can I hear the calls? (If they won't let you listen, assume the worst.)
- What counts as a lead? (Parts enquiries and wrong numbers shouldn't.)
- What's the minimum term and the notice period?
- Who owns the landing page and the phone number when I leave?

## How LeadHive does it

One tradie per trade per area. The tracking number forwards only to you, every call is recorded, and you get the same log I do. Dud calls are taken off your monthly tally. If the month falls short of what was promised, the month gets extended. The landing page is yours while you're a partner and the spot can't be sold to a competitor behind your back.`,
    faqs: [
      { q: "Are shared leads worth it for tradies?", a: "Occasionally, for planned work where the homeowner expects multiple quotes. For urgent repair work they rarely stack up, because the job goes to whoever rings first and cheapest." },
      { q: "What does an exclusive lead cost in NZ?", a: "Depends on trade and city. LeadHive doesn't charge per lead: Starter is $1,500 a month with ad spend included for 15 to 25 leads, which works out between $60 and $100 per exclusive enquiry." },
    ],
  },
  {
    slug: "how-many-leads-does-a-tradie-need",
    title: "How many leads does a plumber or electrician need each month? A simple way to work it out",
    short: "How many leads do you need?",
    description:
      "Work out how many leads a one-van NZ trade business needs per month from your average job value, close rate and revenue target, with worked examples for a plumber, an electrician and a handyman.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 5,
    answer:
      "Take your monthly revenue target, divide by your average job value to get jobs needed, then divide by your close rate to get leads needed. A plumber wanting $25,000 a month at a $325 average job and a 60% close rate needs about 128 jobs' worth of enquiries a year from all sources, or roughly 20 to 25 new inbound leads a month on top of repeat and referral work.",
    body: `## The formula

Leads needed per month = (revenue target ÷ average job value) ÷ close rate.

Then subtract the jobs you already get from repeat customers and referrals. What's left is the gap a paid channel has to fill.

## Worked example: a Christchurch plumber

- Revenue target: $25,000 a month.
- Average job: $325 (a mix of callouts, cylinder work and small installs).
- Jobs needed: about 77.
- Close rate on inbound urgent calls: 60%.
- Enquiries needed: about 128.
- Already getting from repeat and referral: say 100.
- Gap: about 28 new inbound enquiries a month. That's a Growth plan.

## Worked example: a Hamilton electrician

- Revenue target: $18,000 a month.
- Average job: $350.
- Jobs needed: about 51.
- Close rate: 55%.
- Enquiries needed: about 93.
- Repeat and referral: 70.
- Gap: about 23 a month. Starter to Growth.

## Worked example: a Wellington handyman

- Revenue target: $12,000 a month.
- Average job: $220.
- Jobs needed: about 55.
- Close rate: 70% (handyman enquiries close well, the homeowner just wants it done).
- Enquiries needed: about 78.
- Repeat and referral: 55.
- Gap: about 23 a month.

## Two things that move the answer more than ad spend

Your answer rate and your close rate. Across LeadHive campaigns around 18% of tracked calls go unanswered. If you answer 95% instead of 82%, you need 15% fewer leads for the same revenue. And a 60% close rate versus 40% is the difference between needing 20 leads and needing 30.

## What this means when you're choosing a plan

Don't buy more leads than you can answer. A Starter plan at 15 to 25 enquiries a month is plenty for a one-van business that's already got referral work. Growth at 25 to 35 suits a two-van operation or someone building toward a second van. Use the calculator on the pricing page with your own numbers.`,
    faqs: [
      { q: "What's a good close rate for tradie leads?", a: "For urgent inbound calls from a dedicated landing page, 50 to 70% is normal if the phone is answered. For shared directory leads it's often 15 to 25%." },
      { q: "What's the average job value for a plumber in NZ?", a: "For callout and repair work, $250 to $450 is typical. Hot water cylinder replacements and bigger repairs push the average up. Use your own invoices from the last three months." },
    ],
  },
  {
    slug: "answer-the-phone-missed-call-data",
    title: "The cheapest marketing fix for any tradie: answer the phone (what 1,361 tracked calls showed)",
    short: "Missed calls: the data",
    description:
      "Call tracking data from 1,361 inbound calls to NZ tradies in 2026: how many go unanswered, when they happen, and what a missed call actually costs a plumber or electrician.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 4,
    answer:
      "Of 1,361 tracked inbound calls to LeadHive trade partners in 2026, 1,115 were answered and 222 weren't. That's roughly one in six calls going to voicemail. Emergency callers almost never leave a message; they ring the next business. For a plumber whose average job is $325, a month with ten missed calls is a few thousand dollars walking down the page.",
    body: `## The numbers

Between February and October 2026, LeadHive call tracking logged 1,361 inbound calls to partner tradies across New Zealand.

- Answered: 1,115 (82%).
- Not answered: 222 (16%).
- Blocked or spam: 24 (2%).

The unanswered rate varies a lot by partner. The best answer more than 95% of calls. The worst answer under 60%, and their lead counts look bad even when the campaign is producing.

## Why missed calls hurt more for tradies than for anyone else

A homeowner with no hot water isn't going to wait for a call back. They rang you because you were at the top of Google. If it rings out, they tap the next result, and that business gets the job. Our call recordings show it over and over: a caller tries once, maybe twice, then disappears. Very few leave a voicemail.

## When the missed calls happen

- Early evening, 5pm to 8pm, when you're driving home or at dinner.
- Mid-morning on a job, when the phone's in the van.
- Weekends.

None of those are surprising. The fix isn't to answer every call personally. It's to make sure something sensible happens.

## Five fixes, cheapest first

- Turn on call notifications and a 60-second callback habit. The job is still there if you ring back inside a minute or two.
- Put a text auto-reply on missed calls: "On a job, calling you back in 10 minutes, Joe." Cheap, and it stops them ringing the next guy.
- Get a second person on the line for the hours you can't: a partner, an office number, a mate's business. The tracking number can forward to two numbers in sequence.
- Only run ads during the hours you'll answer. If 9pm calls go to voicemail, don't pay for 9pm clicks.
- Listen to your missed-call log once a week. Every tracked call has a time and a number. Ring them back; some are still waiting.

## Why this matters for your marketing spend

Every lead you miss still cost money to generate. Lifting your answer rate from 80% to 95% does the same for your revenue as a 19% bigger ad budget, for free. It's the first thing we look at when a partner says the leads are slow.`,
    faqs: [
      { q: "Do emergency callers leave voicemails?", a: "Rarely. In our call recordings most unanswered callers hang up without a message and don't ring again. A text auto-reply or a fast callback is the only reliable way to keep them." },
      { q: "Can a tracking number forward to more than one phone?", a: "Yes. LeadHive tracking numbers can ring one number first and roll to a second if there's no answer, so an office line or a second tradie can catch the call." },
    ],
  },
  {
    slug: "open-areas-exclusive-trade-leads-nz",
    title: "Which NZ regions are open for exclusive tradie leads right now (updated monthly)",
    short: "Open regions this month",
    description:
      "Monthly-updated list of which New Zealand regions are open or taken for exclusive plumber, electrician, handyman and roofer leads, with real enquiry numbers for each.",
    published: "2026-10-07",
    updated: "2026-10-07",
    readMins: 3,
    answer:
      "As of October 2026, exclusive plumber slots are open in Hawke's Bay, Christchurch, Tauranga and Auckland, the Christchurch electrician slot is open, and the Tauranga handyman slot reopens in November. Wellington, Hamilton, Auckland and South Auckland electricians, and Auckland, Wellington, Christchurch and South Auckland handymen are taken. Full list on the Open Areas page.",
    body: `## How to read this list

LeadHive runs one tradie per trade per area. When an area is taken, I can't sell it again until the partner leaves. When it's open, the page, campaign and tracking already exist, so it can be live for a new partner within a day.

The numbers are average tracked calls plus web enquiries per full month while the campaign ran.

## Open now

- Hawke's Bay plumber: ran April to July 2026, averaged 21 a month, best month 28.
- Christchurch plumber: ran February to September 2026, averaged 21 a month, best month 35.
- Tauranga plumber: ran April to July 2026, averaged 18 a month.
- Auckland plumber: short run in autumn 2026, 14 in its one full month. Auckland can be split in two.
- Christchurch electrician: ran August to September 2026, 18 calls in the first half of September.

## Opening soon

- Tauranga handyman: 33 enquiries in its first month. Reopens November 2026.

## Built, waiting for a first partner

- Dunedin plumber.
- Auckland roofer.

## Taken

- Electricians: Wellington, Hamilton, Tauranga, Auckland, South Auckland.
- Plumbers: Wellington.
- Handymen and builders: Auckland, Wellington, Christchurch, South Auckland, Northland.

## Not built yet

Palmerston North, Nelson, New Plymouth, Rotorua, Queenstown, Invercargill, and most trades outside plumber, electrician, handyman and roofer. If you're a locksmith, glazier, drainlayer, gas fitter, heat pump tech or painter in a city with decent search volume, ask. The machine is the same, only the keywords change.

Check the live grid on the Open Areas page, or email hello@leadhivenz.com with your trade and region.`,
    faqs: [
      { q: "How often is the open areas list updated?", a: "Monthly, alongside partner reports, and whenever a partner joins or leaves." },
      { q: "Can I reserve an area before I'm ready?", a: "Only with a signed agreement and the setup fee paid. I don't hold spots on a handshake, because the next tradie who asks gets told it's open." },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
