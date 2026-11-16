-- =============================================================================
-- HostFix: Portfolio, the second tier, for property managers
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- DECISIONS.md, 2026-11-17. Essential is priced per property. Portfolio is one
-- monthly retainer for the whole account, banded by how many properties are
-- on it. The 15% fee on every job is the same in both.
--
-- 1. A membership tier says how it is charged (per property or per account)
--    and, for per account, its bands.
-- 2. A portfolio: the one retainer a manager pays, holding the subscription
--    and the band it is billed at. Properties under it point at it.
-- 3. A membership payment belongs to a property or to a portfolio.
-- 4. A new kind of problem for the dispatcher's queue: a portfolio whose band
--    needs a person (fewer than 10 properties, or 100 and more).
-- 5. Queenstown gets the Portfolio tier if it already exists. A database
--    built from scratch gets it from config/markets.ts instead.
-- =============================================================================


-- 1. HOW A TIER IS CHARGED ----------------------------------------------------

alter table public.membership_tiers add column if not exists billing_basis text not null default 'per_property';
alter table public.membership_tiers drop constraint if exists membership_tiers_billing_basis_check;
alter table public.membership_tiers add constraint membership_tiers_billing_basis_check
  check (billing_basis in ('per_property', 'per_account'));

-- The bands, lowest first: [{"from": 10, "to": 24, "cents": 60000}, ...].
-- "to": null means "and up". "cents": null means "by arrangement".
-- Checked in full by the admin screen (src/lib/markets/bands.ts).
alter table public.membership_tiers add column if not exists bands jsonb not null default '[]'::jsonb;
alter table public.membership_tiers drop constraint if exists membership_tiers_bands_check;
alter table public.membership_tiers add constraint membership_tiers_bands_check
  check (jsonb_typeof(bands) = 'array' and (billing_basis = 'per_property' or jsonb_array_length(bands) > 0));


-- 2. PORTFOLIOS ---------------------------------------------------------------

create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  owner_id    uuid not null references public.owners (id),
  market      text not null references public.markets (slug) on update cascade,
  tier_id     uuid not null references public.membership_tiers (id),
  -- setup: chosen, retainer not started. active: paying. past_due: the last
  -- payment failed. cancelled: ended.
  status      text not null default 'setup' check (status in ('setup', 'active', 'past_due', 'cancelled')),
  subscription_provider text check (subscription_provider is null or subscription_provider in ('stripe', 'demo')),
  subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  member_since timestamptz,
  cancelled_at timestamptz,
  -- What the retainer is billed at from the next payment, and how many
  -- properties that was worked out from. Changed only by the band check.
  band_cents  integer check (band_cents is null or band_cents > 0),
  property_count_billed integer not null default 0 check (property_count_billed >= 0),
  -- Goes up by one each time the band changes. Part of the payment company's
  -- repeat-safe key, so moving back to an earlier band is a new change.
  band_version integer not null default 0 check (band_version >= 0),
  -- A retainer a person agreed with the manager (100 and more properties are
  -- "by arrangement"). While it is set, the band check never changes the
  -- price: it only tells the queue when the property count moves.
  agreed_cents integer check (agreed_cents is null or agreed_cents > 0)
);

-- In case the table was made by an earlier draft of this file.
alter table public.portfolios add column if not exists agreed_cents integer;

create index if not exists portfolios_owner_idx on public.portfolios (owner_id);
create index if not exists portfolios_market_idx on public.portfolios (market, status);
-- One open portfolio per owner per market.
create unique index if not exists portfolios_open_key on public.portfolios (owner_id, market) where status <> 'cancelled';
create unique index if not exists portfolios_subscription_key
  on public.portfolios (subscription_provider, subscription_id) where subscription_id is not null;

alter table public.properties add column if not exists portfolio_id uuid references public.portfolios (id);
create index if not exists properties_portfolio_idx on public.properties (portfolio_id) where portfolio_id is not null;


-- 3. A PAYMENT IS FOR A PROPERTY OR FOR A PORTFOLIO ---------------------------

alter table public.membership_invoices alter column property_id drop not null;
alter table public.membership_invoices add column if not exists portfolio_id uuid references public.portfolios (id) on delete cascade;
alter table public.membership_invoices drop constraint if exists membership_invoices_for_check;
alter table public.membership_invoices add constraint membership_invoices_for_check
  check ((property_id is null) <> (portfolio_id is null));
create index if not exists membership_invoices_portfolio_idx on public.membership_invoices (portfolio_id, created_at desc);


-- 4. THE QUEUE: A PORTFOLIO BAND THAT NEEDS A PERSON --------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band'));


-- 5. QUEENSTOWN'S PORTFOLIO TIER (the same values as config/markets.ts) --------

insert into public.membership_tiers
  (market, key, name, price_cents, billing_basis, bands, response_hours, urgent_response_hours, urgent_included, quarterly_check, blurb, sort)
select m.slug, 'portfolio', 'Portfolio', 60000, 'per_account',
       '[{"from": 10, "to": 24, "cents": 60000}, {"from": 25, "to": 49, "cents": 90000},
         {"from": 50, "to": 99, "cents": 120000}, {"from": 100, "to": null, "cents": null}]'::jsonb,
       24, 4, false, false,
       'For managers with 10 or more properties. One monthly retainer for the whole portfolio, plus the same fixed job prices.',
       (select coalesce(max(t.sort), 0) + 10 from public.membership_tiers t where t.market = m.slug)
  from public.markets m
 where m.slug = 'queenstown'
   and not exists (select 1 from public.membership_tiers t where t.market = m.slug and t.key = 'portfolio');


-- 6. LOCK IT DOWN -------------------------------------------------------------
-- Row Level Security on, and nothing for the public roles, like every table.

alter table public.portfolios enable row level security;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.portfolios from %I', r);
    end if;
  end loop;
end
$$;
