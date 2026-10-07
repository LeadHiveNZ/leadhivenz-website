import { Link, useParams } from "react-router-dom";
import { useReveal } from "@/components/leadhive/useReveal";
import SiteHeader from "@/components/leadhive/SiteHeader";
import Seo, { breadcrumbSchema, faqSchema } from "@/components/leadhive/Seo";
import CoverageCarousel from "@/components/leadhive/CoverageCarousel";
import { JoeSection } from "@/components/leadhive/Sections";
import { SiteFooter, StickyBar } from "@/components/leadhive/SiteFooter";
import NotFound from "@/pages/NotFound";
import { abs } from "@/lib/site";
import {
  SLOTS,
  Slot,
  slotBySlug,
  tradeHubByPlural,
  tradeByKey,
  regionByKey,
  slotPath,
  tradeHubPath,
  mailtoFor,
  STATUS_LABEL,
  STATUS_CTA,
  TOTALS,
} from "@/data/coverage";

/* ------------------------------------------------------------------ */
/* /leads/:slug resolves to either a trade hub (plumbers) or a         */
/* trade+region slot (plumber-christchurch).                           */
/* ------------------------------------------------------------------ */

const SlotPage = () => {
  const { slug = "" } = useParams();
  const hub = tradeHubByPlural(slug);
  if (hub) return <TradeHub tradeKey={hub.key} />;
  const slot = slotBySlug(slug);
  if (!slot) return <NotFound />;
  return <SlotDetail slot={slot} />;
};

export default SlotPage;

/* ----------------------------- slot ------------------------------- */

const statusCopy = (s: Slot, trade: string, region: string) => {
  switch (s.status) {
    case "open":
      return `The ${trade.toLowerCase()} spot in ${region} is open. The page, the Google Ads campaign and the tracking number are already built from the last partner, so your first calls land within days of signing.`;
    case "opening":
      return `The ${trade.toLowerCase()} spot in ${region} reopens ${s.opensOn ?? "soon"}. Reserve it now and the campaign switches straight over to your number.`;
    case "built":
      return `The ${region} ${trade.toLowerCase()} page is built and waiting for its first partner. You'd be the first business the ads ever run for.`;
    case "taken":
      return `A ${trade.toLowerCase()} in ${region} already holds this spot, so I can't sell it twice. Join the waitlist and you're first in line the moment it frees up. I'll also tell you if a neighbouring area is open.`;
    default:
      return `I haven't built ${region} for ${trade.toLowerCase()}s yet. If you're interested, I'll check the search volume and tell you straight whether it stacks up.`;
  }
};

const SlotDetail = ({ slot }: { slot: Slot }) => {
  useReveal();
  const t = tradeByKey(slot.trade)!;
  const r = regionByKey(slot.region)!;
  const hasNums = (slot.totalLeads ?? 0) > 0;
  const title = `${t.label} Leads ${r.short} | Exclusive Google Ads Leads for ${r.short} ${t.plural} | LeadHive NZ`;
  const desc = hasNums
    ? `Exclusive ${t.label.toLowerCase()} leads in ${r.short}. This area averaged ${slot.avgLeads} tracked enquiries a month (best month ${slot.bestMonth}). One ${t.label.toLowerCase()} per area. Status: ${STATUS_LABEL[slot.status]}.`
    : `Exclusive ${t.label.toLowerCase()} leads in ${r.short} from Google Ads, with your own landing page and call tracking. One ${t.label.toLowerCase()} per area. Status: ${STATUS_LABEL[slot.status]}.`;

  const faqs = [
    {
      q: `How many ${t.label.toLowerCase()} leads can I expect in ${r.short}?`,
      a: hasNums
        ? `When this campaign last ran it averaged ${slot.avgLeads} tracked calls and web enquiries per full month, with a best month of ${slot.bestMonth}. Starter is sold on 15 to 25 leads a month and Growth on 25 to 35, and dud calls don't count toward your tally.`
        : `Starter is sold on 15 to 25 leads a month and Growth on 25 to 35. Across all LeadHive campaigns we've tracked ${TOTALS.callsTracked.toLocaleString("en-NZ")} calls and ${TOTALS.webEnquiries} web enquiries since ${TOTALS.firstCampaign}. If the month falls short, your month gets extended until it isn't.`,
    },
    {
      q: `What kind of ${t.noun} jobs come through in ${r.short}?`,
      a: `${t.jobs.join(", ")}. Urgent, maintenance and repair work from homeowners in ${r.suburbs.slice(0, 5).join(", ")} and surrounding suburbs. Not full renovations and not nine-quote bidding wars.`,
    },
    {
      q: `Is the lead exclusive to me?`,
      a: `Yes. One ${t.label.toLowerCase()} per area. The tracking number on the ${r.short} page forwards only to your mobile, every call is recorded, and I never sell the same lead twice.`,
    },
    {
      q: `What does it cost?`,
      a: `Starter is $1,500 a month with ad spend included and Growth is $2,000. There's a one-off $500 setup and a three-month minimum so Google has time to learn, then month to month with 14 days notice.`,
    },
    {
      q: `How fast can ${r.short} go live?`,
      a:
        slot.status === "open" || slot.status === "opening"
          ? `Fast. The page and campaign for ${r.short} already exist, so it's a matter of swapping in your number and branding. Usually live within 24 hours of sign-up.`
          : `Ads go live within 24 hours of sign-up. First calls usually land in the first two to three days.`,
    },
  ];

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${t.label} lead generation in ${r.name}`,
      serviceType: `Google Ads lead generation for ${t.plural.toLowerCase()}`,
      provider: { "@type": "Organization", name: "LeadHive NZ", url: abs("/") },
      areaServed: { "@type": "Place", name: `${r.name}, New Zealand` },
      audience: { "@type": "BusinessAudience", audienceType: `${t.plural} in ${r.short}` },
      offers: {
        "@type": "Offer",
        priceCurrency: "NZD",
        price: "1500",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "1500", priceCurrency: "NZD", unitText: "MONTH" },
        availability:
          slot.status === "taken" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        url: abs(slotPath(slot)),
      },
    },
    faqSchema(faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: `${t.label} leads NZ`, path: tradeHubPath(t.key) },
      { name: r.short, path: slotPath(slot) },
    ]),
  ];

  const siblings = SLOTS.filter((s) => s.trade === slot.trade && s.region !== slot.region && s.status !== "unbuilt");
  const sameRegion = SLOTS.filter((s) => s.region === slot.region && s.trade !== slot.trade && s.status !== "unbuilt");

  return (
    <>
      <Seo title={title} description={desc} path={slotPath(slot)} schema={schema} />
      <SiteHeader />
      <main id="top">
        <section className="slot-hero">
          <div className="hex" />
          <div className="glow a" />
          <div className="wrap">
            <nav className="crumbs rv" aria-label="Breadcrumb">
              <Link to="/">Home</Link> / <Link to={tradeHubPath(t.key)}>{t.label} leads</Link> /{" "}
              <span>{r.short}</span>
            </nav>
            <span className={`st big ${slot.status}`}>{STATUS_LABEL[slot.status]}</span>
            <h1 className="rv">
              {t.label} leads in <span className="gold">{r.short}.</span>
            </h1>
            <p className="lede rv">{statusCopy(slot, t.label, r.short)}</p>
            <div className="hero-ctas rv">
              <a className={`btn btn-lg ${slot.status === "taken" ? "btn-ghost" : "btn-gold"}`} href={mailtoFor(slot, t, r)}>
                {STATUS_CTA[slot.status]}
              </a>
              <Link className="btn btn-ghost btn-lg" to="/how-it-works">
                See how it works
              </Link>
            </div>
            {hasNums && (
              <div className="hero-proof rv">
                <div>
                  <b>{slot.avgLeads}</b>avg enquiries a month
                </div>
                <div>
                  <b>{slot.bestMonth}</b>best month
                </div>
                <div>
                  <b>{slot.totalLeads}</b>tracked since {slot.since}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="slot-body">
          <div className="wrap slot-grid">
            <div className="slot-main">
              <h2 className="rv">What a {r.short} {t.label.toLowerCase()} gets</h2>
              <p className="rv">
                I put one {t.label.toLowerCase()} at the top of Google across {r.name} the moment a
                homeowner searches for {t.searches[0].replace("[region]", r.short)},{" "}
                {t.searches[1].replace("[region]", r.short)} or {t.searches[2].replace("[region]", r.short)}.
                They tap the ad, land on a page built for a panic moment, and ring a tracking number
                that forwards straight to your mobile. Nobody else in {r.short} gets that call.
              </p>
              <h3 className="rv">Jobs that come through</h3>
              <div className="jobs rv">
                {t.jobs.map((j) => (
                  <span key={j}>{j}</span>
                ))}
              </div>
              <h3 className="rv">Service area</h3>
              <p className="rv">
                {r.suburbs.join(", ")} and the suburbs around them. We lock the exact radius on the
                onboarding call so you're not driving across the region for a tap washer.
              </p>
              {hasNums && (
                <>
                  <h3 className="rv">The history in {r.short}</h3>
                  <p className="rv">
                    This campaign ran from {slot.since}
                    {slot.until ? ` to ${slot.until}` : " and is still running"}. Over {slot.months} full{" "}
                    {slot.months === 1 ? "month" : "months"} it averaged {slot.avgLeads} tracked enquiries a
                    month and peaked at {slot.bestMonth}. {slot.note ?? ""}
                  </p>
                </>
              )}
              <h3 className="rv">Pricing</h3>
              <p className="rv">
                Starter is $1,500 a month (15 to 25 leads, ad spend included). Growth is $2,000 a
                month (25 to 35 leads, two service areas). $500 one-off setup, three-month minimum, then
                month to month. <Link to="/pricing">Run your own numbers</Link>.
              </p>
            </div>
            <aside className="slot-side rv">
              <span className="k">Straight answers for {r.short}</span>
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <div className="a">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
              <a className={`btn ${slot.status === "taken" ? "btn-ghost" : "btn-gold"}`} href={mailtoFor(slot, t, r)}>
                {STATUS_CTA[slot.status]}
              </a>
            </aside>
          </div>
        </section>

        <section className="slot-links">
          <div className="wrap">
            <div className="link-cols">
              <div>
                <span className="eyebrow">Other {t.plural.toLowerCase()} areas</span>
                <div className="links col">
                  {siblings.map((s) => (
                    <Link key={slotPath(s)} to={slotPath(s)}>
                      {t.label} leads {regionByKey(s.region)!.short} <em>{STATUS_LABEL[s.status]}</em>
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <span className="eyebrow">Other trades in {r.short}</span>
                <div className="links col">
                  {sameRegion.map((s) => (
                    <Link key={slotPath(s)} to={slotPath(s)}>
                      {tradeByKey(s.trade)!.label} leads {r.short} <em>{STATUS_LABEL[s.status]}</em>
                    </Link>
                  ))}
                  <Link to="/areas">All areas &rarr;</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CoverageCarousel compact />
        <JoeSection />
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};

/* --------------------------- trade hub ---------------------------- */

const TradeHub = ({ tradeKey }: { tradeKey: Slot["trade"] }) => {
  useReveal();
  const t = tradeByKey(tradeKey)!;
  const slots = SLOTS.filter((s) => s.trade === tradeKey);
  const live = slots.filter((s) => s.status !== "unbuilt");
  const open = slots.filter((s) => s.status === "open" || s.status === "opening" || s.status === "built");
  const totalLeads = slots.reduce((n, s) => n + (s.totalLeads ?? 0), 0);
  const path = tradeHubPath(tradeKey);
  const title = `${t.label} Leads NZ | Google Ads & Lead Generation for ${t.plural} | LeadHive NZ`;
  const desc = `Exclusive ${t.label.toLowerCase()} leads across New Zealand. ${totalLeads.toLocaleString("en-NZ")} tracked enquiries delivered to ${t.plural.toLowerCase()} since ${TOTALS.firstCampaign}. One ${t.label.toLowerCase()} per area. See which areas are open.`;
  const faqs = [
    {
      q: `How does LeadHive get leads for ${t.plural.toLowerCase()}?`,
      a: `Google Search Ads on urgent and repair searches like ${t.searches.slice(0, 3).map((s) => `"${s.replace("[region]", "your city")}"`).join(", ")}, pointed at a dedicated landing page with a tracking number that forwards to one ${t.label.toLowerCase()}'s mobile. Every call is logged and recorded.`,
    },
    {
      q: `How many leads do ${t.plural.toLowerCase()} get per month?`,
      a: `Starter is sold on 15 to 25 a month and Growth on 25 to 35. Live ${t.label.toLowerCase()} areas have averaged between ${Math.min(...live.filter((s) => s.avgLeads).map((s) => s.avgLeads!))} and ${Math.max(...live.filter((s) => s.avgLeads).map((s) => s.avgLeads!))} tracked enquiries a month depending on the region.`,
    },
    {
      q: `Which areas are open for ${t.plural.toLowerCase()}?`,
      a: open.length
        ? `Right now: ${open.map((s) => regionByKey(s.region)!.short).join(", ")}. Taken areas have a waitlist.`
        : `Every built area is taken at the moment. Join the waitlist for your region or ask me to build a new one.`,
    },
  ];
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${t.label} lead generation New Zealand`,
      serviceType: `Google Ads lead generation for ${t.plural.toLowerCase()}`,
      provider: { "@type": "Organization", name: "LeadHive NZ", url: abs("/") },
      areaServed: "New Zealand",
      offers: { "@type": "Offer", priceCurrency: "NZD", price: "1500", url: abs(path) },
    },
    faqSchema(faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: `${t.label} leads NZ`, path },
    ]),
  ];

  return (
    <>
      <Seo title={title} description={desc} path={path} schema={schema} />
      <SiteHeader />
      <main id="top">
        <section className="slot-hero">
          <div className="hex" />
          <div className="glow a" />
          <div className="wrap">
            <nav className="crumbs rv" aria-label="Breadcrumb">
              <Link to="/">Home</Link> / <span>{t.label} leads</span>
            </nav>
            <span className="eyebrow rv">Lead generation for NZ {t.plural.toLowerCase()}</span>
            <h1 className="rv">
              {t.label} leads, <span className="gold">exclusively yours.</span>
            </h1>
            <p className="lede rv">
              {totalLeads.toLocaleString("en-NZ")} tracked calls and enquiries delivered to{" "}
              {t.plural.toLowerCase()} since {TOTALS.firstCampaign}. One {t.label.toLowerCase()} per area:{" "}
              {live.filter((s) => s.status === "taken").length} areas taken, {open.length} open.
            </p>
            <div className="hero-ctas rv">
              <Link className="btn btn-gold btn-lg" to="/contact">
                Check if my area is open
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/pricing">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="slot-body">
          <div className="wrap">
            <div className="sec-head rv">
              <span className="eyebrow">Areas</span>
              <h2>Every {t.label.toLowerCase()} area, with the numbers.</h2>
            </div>
            <div className="trade-grid">
              {live
                .sort((a, b) => (b.avgLeads ?? 0) - (a.avgLeads ?? 0))
                .map((s) => {
                  const r = regionByKey(s.region)!;
                  return (
                    <Link key={slotPath(s)} to={slotPath(s)} className={`trade rv slot-card ${s.status}`}>
                      <span className={`st ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                      <h3>{r.short}</h3>
                      {s.totalLeads ? (
                        <p>
                          <b>{s.avgLeads}</b> avg enquiries a month, best {s.bestMonth}, {s.totalLeads} tracked since {s.since}.
                        </p>
                      ) : (
                        <p>{s.note ?? "Built and ready."}</p>
                      )}
                      <span className="mini">{STATUS_CTA[s.status]} &rarr;</span>
                    </Link>
                  );
                })}
            </div>
            <p className="trade-note rv">
              Not listed: {slots.filter((s) => s.status === "unbuilt").map((s) => regionByKey(s.region)!.short).join(", ")}.
              I build new areas when a {t.label.toLowerCase()} asks and the search volume is there.
            </p>
          </div>
        </section>

        <section className="faq">
          <div className="wrap">
            <div className="sec-head rv">
              <span className="eyebrow">Straight answers</span>
              <h2>{t.plural} ask me this.</h2>
            </div>
            <div className="qs">
              {faqs.map((f, i) => (
                <details key={f.q} open={i === 0} className="rv">
                  <summary>{f.q}</summary>
                  <div className="a">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
        <JoeSection />
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};
