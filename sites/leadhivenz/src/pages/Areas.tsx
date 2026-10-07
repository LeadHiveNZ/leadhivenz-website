import { Link } from "react-router-dom";
import { useReveal } from "@/components/leadhive/useReveal";
import SiteHeader from "@/components/leadhive/SiteHeader";
import Seo, { breadcrumbSchema, faqSchema } from "@/components/leadhive/Seo";
import OpenSpots from "@/components/leadhive/OpenSpots";
import CoverageCarousel from "@/components/leadhive/CoverageCarousel";
import AreaCheck from "@/components/leadhive/AreaCheck";
import { SiteFooter, StickyBar } from "@/components/leadhive/SiteFooter";
import { REGIONS, SLOTS, TRADES, slotPath, STATUS_LABEL } from "@/data/coverage";

const faqs = [
  {
    q: "What does 'one tradie per trade per area' actually mean?",
    a: "Each region on this page has one plumber slot, one electrician slot, one handyman slot and so on. When a business takes a slot, nobody else in that trade can buy into that area until they leave. Big cities can be split into two areas (for example Auckland and South Auckland).",
  },
  {
    q: "How are the open areas chosen?",
    a: "An area is listed as open when the landing page, Google Ads campaign and call tracking already exist and no partner currently holds it. Most open areas ran for a previous partner, so the numbers shown are from real tracked calls and web enquiries, not estimates.",
  },
  {
    q: "My area isn't built yet. Can you build it?",
    a: "Yes, if the search volume is there. Tell me the trade and the region and I'll check the numbers and give you a straight yes or no within a day.",
  },
];

const AreasPage = () => {
  useReveal();
  const built = SLOTS.filter((s) => s.status !== "unbuilt");
  const taken = built.filter((s) => s.status === "taken").length;
  const open = built.length - taken;
  const title = "Open Areas for Tradies NZ | Which Regions Are Taken and Which Are Open | LeadHive NZ";
  const desc = `Live coverage map for exclusive trade leads across New Zealand. ${taken} areas taken, ${open} built and open, updated monthly. Plumbers, electricians, handymen and roofers by region.`;

  return (
    <>
      <Seo
        title={title}
        description={desc}
        path="/areas"
        schema={[faqSchema(faqs), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Open areas", path: "/areas" }])]}
      />
      <SiteHeader />
      <main id="top">
        <section className="slot-hero">
          <div className="hex" />
          <div className="glow a" />
          <div className="wrap">
            <span className="eyebrow rv">Coverage, updated monthly</span>
            <h1 className="rv">
              Every area. <span className="gold">Who&rsquo;s got it, who hasn&rsquo;t.</span>
            </h1>
            <p className="lede rv">
              {taken} areas are taken by a partner. {open} are built, proven and waiting. If yours is
              taken, the waitlist is free and I tell you the moment it opens.
            </p>
          </div>
        </section>

        <OpenSpots />
        <CoverageCarousel compact />

        <section className="area-table">
          <div className="wrap">
            <div className="sec-head rv">
              <span className="eyebrow">The full grid</span>
              <h2>Region by region, trade by trade.</h2>
            </div>
            <div className="grid-scroll rv">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    {TRADES.map((t) => (
                      <th key={t.key}>{t.plural}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <b>{r.short}</b>
                        <span>{r.island} Island</span>
                      </td>
                      {TRADES.map((t) => {
                        const s = SLOTS.find((x) => x.trade === t.key && x.region === r.key);
                        if (!s || s.status === "unbuilt")
                          return (
                            <td key={t.key}>
                              <span className="st unbuilt">Ask</span>
                            </td>
                          );
                        return (
                          <td key={t.key}>
                            <Link to={slotPath(s)} className={`st ${s.status}`}>
                              {STATUS_LABEL[s.status]}
                              {s.avgLeads ? <em>{s.avgLeads}/mo</em> : null}
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="wrap">
            <div className="sec-head rv">
              <span className="eyebrow">Straight answers</span>
              <h2>About the areas.</h2>
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

        <AreaCheck />
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};

export default AreasPage;
