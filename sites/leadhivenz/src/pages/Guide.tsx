import { Link, useParams } from "react-router-dom";
import { useReveal } from "@/components/leadhive/useReveal";
import SiteHeader from "@/components/leadhive/SiteHeader";
import Seo, { breadcrumbSchema, faqSchema } from "@/components/leadhive/Seo";
import { JoeSection } from "@/components/leadhive/Sections";
import { SiteFooter, StickyBar } from "@/components/leadhive/SiteFooter";
import NotFound from "@/pages/NotFound";
import { abs } from "@/lib/site";
import { GUIDES, guideBySlug } from "@/data/guides";

/** Tiny renderer for the guide body format (## heading, - bullet, paragraphs). */
const Body = ({ text }: { text: string }) => {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines[0].startsWith("## ")) return <h2 key={i}>{lines[0].slice(3)}</h2>;
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{lines.join(" ")}</p>;
      })}
    </>
  );
};

const GuidePage = () => {
  useReveal();
  const { slug = "" } = useParams();
  const g = guideBySlug(slug);
  if (!g) return <NotFound />;
  const path = `/guides/${g.slug}`;
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: g.description,
      datePublished: g.published,
      dateModified: g.updated,
      author: { "@type": "Person", name: "Joe Ingram", url: abs("/contact") },
      publisher: { "@type": "Organization", name: "LeadHive NZ", url: abs("/") },
      mainEntityOfPage: abs(path),
      inLanguage: "en-NZ",
    },
    faqSchema(g.faqs),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: g.short, path },
    ]),
  ];
  return (
    <>
      <Seo title={`${g.title} | LeadHive NZ`} description={g.description} path={path} type="article" schema={schema} />
      <SiteHeader />
      <main id="top">
        <article className="guide">
          <div className="wrap">
            <nav className="crumbs rv" aria-label="Breadcrumb">
              <Link to="/">Home</Link> / <Link to="/guides">Guides</Link> / <span>{g.short}</span>
            </nav>
            <span className="eyebrow rv">
              {g.readMins} min read · Updated {new Date(g.updated).toLocaleDateString("en-NZ", { month: "long", year: "numeric" })}
            </span>
            <h1 className="rv">{g.title}</h1>
            <p className="answer rv">
              <b>Short answer.</b> {g.answer}
            </p>
            <div className="guide-body rv">
              <Body text={g.body} />
              <h2>Questions people ask</h2>
              {g.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <div className="a">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className="guide-cta rv">
              <div>
                <b>Want it done for you?</b>
                <p>One tradie per trade per area. Check whether yours is still open.</p>
              </div>
              <Link className="btn btn-gold" to="/contact">
                Check my area
              </Link>
            </div>
            <div className="guide-more rv">
              <span className="eyebrow">More guides</span>
              <div className="links col">
                {others.map((o) => (
                  <Link key={o.slug} to={`/guides/${o.slug}`}>
                    {o.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>
        <JoeSection />
      </main>
      <SiteFooter />
      <StickyBar />
    </>
  );
};

export default GuidePage;
