-- =============================================================================
-- 25 November 2026 (DECISIONS.md, 2026-11-25): Queenstown and Wānaka hourly
-- rates up NZ$10 for the owner, after the meeting with a Queenstown electrician
-- (travel across town and local rates). What the owner pays, GST included:
-- plumber and electrician NZ$170, gasfitter NZ$180, handyman NZ$120. The tradie
-- gets 85%. Other towns keep the defaults in src/lib/jobs/rates.ts. Saved as
-- each market's own rate, so the Markets screen shows and can change them.
-- Only for markets that exist; a rate already set by hand is left alone.
-- =============================================================================

insert into public.trade_rates (market, trade, hourly_cents, updated_at)
select m.slug, r.trade, r.cents, now()
  from public.markets m
  cross join (values ('plumber', 17000), ('electrician', 17000), ('gasfitter', 18000), ('handyman', 12000)) as r(trade, cents)
 where m.slug in ('queenstown', 'wanaka')
on conflict (market, trade) do nothing;
