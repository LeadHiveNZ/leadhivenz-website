import { Link } from "react-router-dom";
import { useReveal } from "@/components/leadhive/useReveal";
import SiteHeader from "@/components/leadhive/SiteHeader";
import Seo, { faqSchema } from "@/components/leadhive/Seo";
import Hero from "@/components/leadhive/Hero";
import OpenSpots from "@/components/leadhive/OpenSpots";
import CoverageCarousel from "@/components/leadhive/CoverageCarousel";
import {
  ProblemSection,
  TradesSection,
  ProofSection,
  JoeSection,
} from "@/components/leadhive/Sections";
import Teasers from "@/components/leadhive/Teasers";
import { SiteFooter, StickyBar } from "@/components/leadhive/SiteFooter";
import { FAQ_ITEMS } from "@/components/leadhive/Faq";
import { abs } from "@/lib/site";
import { TOTALS, TRADES, tradeHubPath } from "@/data/coverage";

const orgSchema = {
  "@context": "https://schema.org",
  "@type": ["Organization", "ProfessionalService"],
  "@id": abs("/#org"),
  name: "LeadHive NZ",
  alternateName: ["LeadHiveNZ", "Lead Hive NZ"],
  description:
    "Marketing agency for tradies in New Zealand. Exclusive Google Ads lead generation for plumbers, electricians, handymen, builders and roofers: one business per trade per area, with a dedicated landing page and call tracking.",
  url: abs("/"),
  logo: abs("/leadhive-logo.png"),
  image: abs("/og-leadhive.png"),
  email: "hello@leadhivenz.com",
  founder: { "@type": "Person", name: "Joe Ingram" },
  foundingDate: "2026-02",
  areaServed: { "@type": "Country", name: "New Zealand" },
  knowsAbout: ["Google Ads for tradies", "Lead generation for plumbers", "Lead generation for electricians", "Call tracking", "Landing pages for trade businesses"],
  slogan: "More jobs. Zero effort.",
  priceRange: "$1,500 - $2,000 NZD per month",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Exclusive trade lead packages",
    itemListElement: [
      { "@type": "Offer", name: "Starter", price: "1500", priceCurrency: "NZD", description: "15 to 25 exclusive leads a month, ad spend included, one service area." },
      { "@type": "Offer", name: "Growth", price: "2000", priceCurrency: "NZD", description: "25 to 35 exclusive leads a month, ad spend included, two service areas." },
    ],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": abs("/#website"),
  url: abs("/"),
  name: "LeadHive NZ",
  publisher: { "@id": abs("/#org") },
  inLanguage: "en-NZ",
};

/** Plain-text section so the "marketing agency for tradies" intent is explicit on the page. */
const AgencySection = () => (
  <section className="agency" id="agency">
    <div className="hex" />
    <div className="wrap agency-grid">
      <div className="rv">
        <span className="eyebrow">Marketing agency for tradies, NZ</span>
        <h2>Built for one kind of client: the tradie who wants the phone to ring.</h2>
      </div>
      <div className="agency-copy">
        <p className="rv">
          LeadHive NZ is a marketing agency for tradies in New Zealand. Not a web design shop, not a
          social media agency, not a directory. I do one thing: exclusive inbound leads for plumbers,
          electricians, handymen, builders and roofers through Google Search Ads, a dedicated landing
          page and call tracking, with one business per trade per area.
        </p>
        <p className="rv">
          Since {TOTALS.firstCampaign} that machine has tracked{" "}
          <b>{TOTALS.callsTracked.toLocaleString("en-NZ")} inbound calls</b> and{" "}
          <b>{TOTALS.webEnquiries} web enquiries</b> for {TOTALS.partnersServed} trade partners from
          Northland to Christchurch. Every call is logged, recorded and forwarded to one mobile, so you
          can hear exactly what your marketing is doing.
        </p>
        <div className="links rv">
          {TRADES.map((t) => (
            <Link key={t.key} to={tradeHubPath(t.key)} className="chip">
              {t.label} leads NZ
            </Link>
          ))}
          <Link to="/guides/marketing-for-tradies-nz" className="chip">
            Guide: marketing for tradies
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const Index = () => {
  useReveal();

  return (
    <>
      <Seo
        title="LeadHive NZ | Marketing Agency for Tradies: Exclusive Leads, One Tradie Per Area"
        description="The marketing agency NZ tradies use to get exclusive jobs. Google Ads, your own landing page and call tracking for plumbers, electricians, handymen and roofers. One business per trade per area. See which areas are open."
        path="/"
        schema={[orgSchema, websiteSchema, faqSchema(FAQ_ITEMS.slice(0, 6))]}
      />
      <SiteHeader />
      <main id="top">
        <Hero />
        <OpenSpots />
        <ProblemSection />
        <CoverageCarousel />
        <TradesSection />
        <ProofSection />
        <AgencySection />
        <Teasers />
        <JoeSection />
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};

export default Index;
