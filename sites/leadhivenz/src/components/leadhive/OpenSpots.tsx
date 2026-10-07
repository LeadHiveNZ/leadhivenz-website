import { Link } from "react-router-dom";
import {
  featuredOpenSlots,
  regionByKey,
  tradeByKey,
  slotPath,
  STATUS_LABEL,
  TOTALS,
} from "@/data/coverage";

/**
 * Front-and-centre section for areas that are built, have real history
 * and currently have no partner. Reads from src/data/coverage.ts.
 */
const OpenSpots = () => {
  const spots = featuredOpenSlots();
  if (!spots.length) return null;
  return (
    <section className="open" id="open">
      <div className="hex" />
      <div className="wrap">
        <div className="sec-head rv">
          <span className="eyebrow">Open right now</span>
          <h2>These areas are built, proven and waiting for a tradie.</h2>
          <p className="lede">
            Each one ran for a previous partner. The landing page, the Google Ads account and the
            call tracking already exist, so the first calls land within days, not weeks. The numbers
            are real tracked calls and web enquiries, not projections.
          </p>
        </div>
        <div className="open-grid">
          {spots.map((s) => {
            const t = tradeByKey(s.trade)!;
            const r = regionByKey(s.region)!;
            return (
              <Link key={slotPath(s)} to={slotPath(s)} className={`open-card rv ${s.status}`}>
                <div className="open-top">
                  <span className={`st ${s.status === "open" ? "open" : "soon"}`}>{STATUS_LABEL[s.status]}</span>
                  {s.opensOn && <span className="when">{s.opensOn}</span>}
                </div>
                <h3>
                  {t.label} <span>·</span> {r.short}
                </h3>
                <div className="open-nums">
                  <div>
                    <b>{s.avgLeads}</b>
                    <span>avg enquiries / month</span>
                  </div>
                  <div>
                    <b>{s.bestMonth}</b>
                    <span>best month</span>
                  </div>
                  <div>
                    <b>{s.totalLeads}</b>
                    <span>tracked so far</span>
                  </div>
                </div>
                <p>{s.note}</p>
                <span className="mini">See the {r.short} {t.label.toLowerCase()} page &rarr;</span>
              </Link>
            );
          })}
        </div>
        <p className="trade-note rv">
          Figures are tracked calls plus web enquiries per full month while each campaign ran
          (Nimbata call tracking, updated {TOTALS.updated}). Dud calls are removed from your monthly
          tally when you partner with me, so your count will be a little lower than the raw number.
        </p>
      </div>
    </section>
  );
};

export default OpenSpots;
