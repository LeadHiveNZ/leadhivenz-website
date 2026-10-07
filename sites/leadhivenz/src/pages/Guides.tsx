import { Link } from "react-router-dom";
import { useReveal } from "@/components/leadhive/useReveal";
import SiteHeader from "@/components/leadhive/SiteHeader";
import Seo, { breadcrumbSchema } from "@/components/leadhive/Seo";
import { SiteFooter, StickyBar } from "@/components/leadhive/SiteFooter";
import { GUIDES } from "@/data/guides";

const GuidesPage = () => {
  useReveal();
  return (
    <>
      <Seo
        title="Tradie Marketing Guides NZ | Google Ads, Leads & Growth for Plumbers, Sparkies, Handymen | LeadHive NZ"
        description="Plain-English guides for New Zealand tradies on marketing, Google Ads, lead generation and growing a trade business, backed by real call-tracking data from LeadHive campaigns."
        path="/guides"
        schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])}
      />
      <SiteHeader />
      <main id="top">
        <section className="slot-hero">
          <div className="hex" />
          <div className="wrap">
            <span className="eyebrow rv">Guides</span>
            <h1 className="rv">
              Marketing for tradies, <span className="gold">without the fluff.</span>
            </h1>
            <p className="lede rv">
              Short, honest guides written from real campaign data. No theory, no agency speak. Read
              them, use them, and if you want it done for you, you know where I am.
            </p>
          </div>
        </section>
        <section>
          <div className="wrap">
            <div className="guide-grid">
              {GUIDES.map((g) => (
                <Link key={g.slug} to={`/guides/${g.slug}`} className="trade rv guide-card">
                  <span className="eyebrow">{g.readMins} min read</span>
                  <h3>{g.title}</h3>
                  <p>{g.description}</p>
                  <span className="mini">Read the guide &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};

export default GuidesPage;
