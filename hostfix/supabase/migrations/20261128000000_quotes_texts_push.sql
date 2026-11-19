-- =============================================================================
-- HostFix: "not the job described", quote rates, fixed hourly rates, the
-- call-out credit, STOP replies, shorter texts and app notifications
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds.
--
-- DECISIONS.md, 2026-11-20 (the third entry that day).
-- =============================================================================


-- 1. "NOT THE JOB DESCRIBED" ON A MENU JOB -----------------------------------

-- The tradie found something other than the job described: their reason (one line, with photos), and
-- where the call-out stands. waiting: the owner may still say "This was the job I described".
-- approved: the owner approved the quote. no_objection: the owner did not object in time.
-- owner_objects: with the team. staff_paid / staff_no_callout: the team decided from the photos.
alter table public.jobs add column if not exists not_described_at timestamptz;
alter table public.jobs add column if not exists not_described_reason text;
alter table public.jobs add column if not exists not_described_status text;
alter table public.jobs add column if not exists not_described_by timestamptz;
alter table public.jobs drop constraint if exists jobs_not_described_status_check;
alter table public.jobs add constraint jobs_not_described_status_check check (not_described_status is null or not_described_status in (
  'waiting', 'approved', 'no_objection', 'owner_objects', 'staff_paid', 'staff_no_callout'));

-- How long the owner has to say "This was the job I described" before the call-out is paid.
alter table public.markets add column if not exists not_described_hours integer not null default 24;
alter table public.markets drop constraint if exists markets_not_described_hours_check;
alter table public.markets add constraint markets_not_described_hours_check check (not_described_hours between 1 and 168);


-- 2. QUOTES BY THE HOUR, AND THE CALL-OUT CREDIT -------------------------------

-- Work up to NZ$1,000 is quoted in hours at the market's fixed rate for the trade.
alter table public.quotes add column if not exists hours numeric(6, 2);
alter table public.quotes add column if not exists rate_cents integer;
-- An off-menu job's call-out taken off the first approved quote.
alter table public.quotes add column if not exists credit_cents integer not null default 0;
alter table public.quotes add column if not exists not_described boolean not null default false;
-- With the call-out credit, an approved quote can come to nothing more for the owner (the work cost the call-out).
alter table public.quotes drop constraint if exists quotes_owner_total_cents_check;
alter table public.quotes add constraint quotes_owner_total_cents_check check (owner_total_cents >= 0);

-- The fixed hourly rate per market and trade, what the owner pays, GST included.
-- A trade with no row uses the default in the code (src/lib/jobs/rates.ts).
create table if not exists public.trade_rates (
  market      text not null references public.markets (slug) on delete cascade,
  trade       text not null,
  hourly_cents integer not null check (hourly_cents between 1000 and 100000),
  updated_at  timestamptz not null,
  primary key (market, trade)
);


-- 3. TEXTS: STOP, PUSH FIRST FOR OFFERS ------------------------------------------

-- A phone number that replied STOP gets no more texts (except sign-in codes) until it replies START.
create table if not exists public.sms_opt_outs (
  phone       text primary key,
  opted_out_at timestamptz not null,
  keyword     text not null,
  resumed_at  timestamptz
);

-- When the tradie opened the offer's page. A text held back behind an app notification is only sent if not.
alter table public.offers add column if not exists opened_at timestamptz;

alter table public.notifications drop constraint if exists notifications_channel_check;
alter table public.notifications add constraint notifications_channel_check check (channel in ('sms', 'email', 'push'));
-- A text sent only if this offer has not been opened by then.
alter table public.notifications add column if not exists unless_offer_opened uuid references public.offers (id) on delete set null;

-- Minutes to wait after an app notification before the offer's text goes too.
alter table public.markets add column if not exists offer_push_sms_minutes integer not null default 3;
alter table public.markets drop constraint if exists markets_offer_push_sms_minutes_check;
alter table public.markets add constraint markets_offer_push_sms_minutes_check check (offer_push_sms_minutes between 0 and 15);


-- 4. APP NOTIFICATIONS (WEB PUSH) ----------------------------------------------

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);


-- 5. THE DISPATCHER'S QUEUE ---------------------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring',
  'not_taken_yet', 'arrival_unverified', 'owner_says_absent', 'no_show', 'tradie_review',
  'job_check', 'tradie_flags',
  'receipt_check',
  'card_needed', 'owner_owes', 'chargeback_lost',
  'not_described', 'quote_rate', 'sms_opted_out'));


-- 6. LOCK IT DOWN -------------------------------------------------------------

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['trade_rates', 'sms_opt_outs', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
