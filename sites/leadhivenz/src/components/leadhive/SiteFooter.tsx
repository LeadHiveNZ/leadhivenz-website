import { Link } from "react-router-dom";
import { SLOTS, TRADES, regionByKey, tradeByKey, slotPath, tradeHubPath } from "@/data/coverage";
import { GUIDES } from "@/data/guides";

const topSlots = SLOTS.filter((s) => s.status !== "unbuilt").slice(0, 12);

export const SiteFooter = () => (
  <footer>
    <div className="wrap foot-grid">
      <div className="foot-col">
        <b>LeadHive NZ</b>
        <p>
          A marketing agency for tradies in New Zealand. Exclusive Google Ads leads, one business per
          trade per area, run by Joe Ingram. Email{" "}
          <a href="mailto:hello@leadhivenz.com">hello@leadhivenz.com</a>.
        </p>
        <div className="links">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">Straight answers</Link>
          <Link to="/contact">Contact</Link>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </div>
      <div className="foot-col">
        <b>Leads by trade</b>
        <div className="links col">
          {TRADES.map((t) => (
            <Link key={t.key} to={tradeHubPath(t.key)}>
              {t.label} leads NZ
            </Link>
          ))}
          <Link to="/areas">All areas &amp; trades</Link>
        </div>
      </div>
      <div className="foot-col">
        <b>Areas</b>
        <div className="links col">
          {topSlots.map((s) => (
            <Link key={slotPath(s)} to={slotPath(s)}>
              {tradeByKey(s.trade)!.label} leads {regionByKey(s.region)!.short}
            </Link>
          ))}
        </div>
      </div>
      <div className="foot-col">
        <b>Guides for tradies</b>
        <div className="links col">
          {GUIDES.map((g) => (
            <Link key={g.slug} to={`/guides/${g.slug}`}>
              {g.short}
            </Link>
          ))}
        </div>
      </div>
    </div>
    <div className="wrap foot-base">
      <span>&copy; {new Date().getFullYear()} LeadHive NZ &middot; Exclusively yours. I never share leads.</span>
    </div>
  </footer>
);

export const StickyBar = () => (
  <div className="stickybar">
    <Link className="btn btn-ghost" to="/areas">
      Open areas
    </Link>
    <Link className="btn btn-gold" to="/contact">
      Check my area
    </Link>
  </div>
);
