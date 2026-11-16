-- =============================================================================
-- HostFix: the owner demand test
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- 1. Which button an owner pressed on the landing page: "take a founding spot"
--    (the deposit) or "send me the price list". The split between the two is
--    the main thing the demand test measures.
-- 2. How many founding spots a market offers. The deposit stops being offered
--    once that many have been paid for.
-- =============================================================================

alter table public.leads add column if not exists intent text;
alter table public.leads drop constraint if exists leads_intent_check;
alter table public.leads add constraint leads_intent_check
  check (intent is null or (intent in ('deposit', 'pricelist') and lead_type = 'owner'));

alter table public.markets add column if not exists deposit_spots integer;
alter table public.markets drop constraint if exists markets_deposit_spots_check;
alter table public.markets add constraint markets_deposit_spots_check
  check (deposit_spots is null or deposit_spots between 1 and 1000);

create index if not exists leads_market_created_idx on public.leads (market, created_at desc);
