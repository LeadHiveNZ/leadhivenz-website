import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import {
  REGIONS,
  SLOTS,
  TRADES,
  TradeKey,
  Slot,
  regionByKey,
  tradeByKey,
  slotPath,
  mailtoFor,
  STATUS_LABEL,
  STATUS_CTA,
} from "@/data/coverage";

type Filter = TradeKey | "all";
const ORDER: Record<Slot["status"], number> = { open: 0, opening: 1, built: 2, taken: 3, unbuilt: 4 };

/**
 * Interactive coverage carousel. Filter by trade, swipe or arrow through
 * regions, tap a card to expand. Taken areas show real numbers plus a
 * waitlist CTA; open areas show a claim CTA. Nothing here is a blank post.
 */
const CoverageCarousel = ({ compact = false }: { compact?: boolean }) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [emblaRef, embla] = useEmblaCarousel({ align: "start", loop: false, dragFree: true, skipSnaps: true });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const cards = useMemo(() => {
    const base = SLOTS.filter((s) => s.status !== "unbuilt" || filter !== "all");
    const list = filter === "all" ? base : base.filter((s) => s.trade === filter);
    return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.avgLeads ?? 0) - (a.avgLeads ?? 0));
  }, [filter]);

  const onSelect = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    embla.reInit();
  }, [embla, onSelect, cards]);

  const counts = useMemo(() => {
    const taken = SLOTS.filter((s) => s.status === "taken").length;
    const open = SLOTS.filter((s) => s.status === "open" || s.status === "opening" || s.status === "built").length;
    return { taken, open };
  }, []);

  return (
    <section className="cov" id="coverage">
      <div className="wrap">
        <div className="sec-head rv">
          <span className="eyebrow">Coverage · one tradie per trade per area</span>
          <h2>Who&rsquo;s got what, and what&rsquo;s still up for grabs.</h2>
          <p className="lede">
            {counts.taken} areas are taken. {counts.open} are built and open. Pick your trade, swipe
            through the regions, and tap a card for the numbers. If your area&rsquo;s taken, join the
            waitlist and you&rsquo;re first in line when it frees up.
          </p>
        </div>

        <div className="cov-bar rv">
          <div className="tradepick" role="group" aria-label="Filter by trade">
            <button type="button" className={filter === "all" ? "on" : undefined} onClick={() => setFilter("all")}>
              All trades
            </button>
            {TRADES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={filter === t.key ? "on" : undefined}
                onClick={() => setFilter(t.key)}
              >
                {t.plural}
              </button>
            ))}
          </div>
          <div className="cov-arrows">
            <button type="button" aria-label="Previous" disabled={!canPrev} onClick={() => embla?.scrollPrev()}>
              &larr;
            </button>
            <button type="button" aria-label="Next" disabled={!canNext} onClick={() => embla?.scrollNext()}>
              &rarr;
            </button>
          </div>
        </div>

        <div className="cov-viewport rv" ref={emblaRef}>
          <div className="cov-track">
            {cards.map((s) => {
              const t = tradeByKey(s.trade)!;
              const r = regionByKey(s.region)!;
              const id = slotPath(s);
              const isOpen = expanded === id;
              const hasNums = (s.totalLeads ?? 0) > 0;
              return (
                <article
                  key={id}
                  className={`cov-card ${s.status}${isOpen ? " on" : ""}`}
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  <div className="cov-head">
                    <span className={`st ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                    <span className="reg">{r.short}</span>
                  </div>
                  <h3>{t.label}</h3>
                  {hasNums ? (
                    <div className="cov-nums">
                      <div>
                        <b>{s.avgLeads}</b>
                        <span>avg / month</span>
                      </div>
                      <div>
                        <b>{s.bestMonth}</b>
                        <span>best month</span>
                      </div>
                      <div>
                        <b>{s.totalLeads}</b>
                        <span>tracked</span>
                      </div>
                    </div>
                  ) : (
                    <p className="cov-empty">
                      {s.status === "built"
                        ? "Page built. No partner yet, so no numbers yet."
                        : s.status === "taken"
                          ? "Just launched. First month's numbers coming."
                          : `Not built yet. If you're a ${t.label.toLowerCase()} in ${r.short}, I'll build it for you.`}
                    </p>
                  )}
                  <div className="cov-more" aria-hidden={!isOpen}>
                    <p>
                      {s.note ??
                        (s.status === "taken"
                          ? `A ${t.label.toLowerCase()} in ${r.short} has this spot. Since ${s.since}, the page has sent ${s.totalLeads} tracked enquiries to one phone. Nobody else in ${r.short} can buy in while they're a partner.`
                          : `${r.name}: ${r.suburbs.slice(0, 4).join(", ")} and surrounds.`)}
                    </p>
                    <div className="cov-jobs">
                      {t.jobs.slice(0, 3).map((j) => (
                        <span key={j}>{j}</span>
                      ))}
                    </div>
                  </div>
                  <div className="cov-ctas" onClick={(e) => e.stopPropagation()}>
                    {s.status === "taken" ? (
                      <a className="btn btn-ghost" href={mailtoFor(s, t, r)}>
                        {STATUS_CTA.taken}
                      </a>
                    ) : (
                      <a className="btn btn-gold" href={mailtoFor(s, t, r)}>
                        {STATUS_CTA[s.status]}
                      </a>
                    )}
                    {s.status !== "unbuilt" && (
                      <Link className="mini" to={id}>
                        Details &rarr;
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {!compact && (
          <div className="cov-foot rv">
            <p>
              Regions not on the list: {REGIONS.filter((r) => !SLOTS.some((s) => s.region === r.key && s.status !== "unbuilt")).map((r) => r.short).join(", ")}.
              Ask and I&rsquo;ll tell you straight whether the search volume is there.
            </p>
            <Link className="btn btn-ghost" to="/areas">
              See every area and trade
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default CoverageCarousel;
