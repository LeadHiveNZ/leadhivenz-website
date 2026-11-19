-- =============================================================================
-- HostFix: tradies paid even when a card fails, chargebacks decided by fault,
-- guests in the house, property hazards, and the tradie agreement in the app
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds (and moves payouts that were
-- waiting on an owner's card to scheduled: tradies no longer wait for it).
--
-- DECISIONS.md, 2026-11-20 (the second entry that day), "Tradies paid whatever the card does, chargebacks
-- by fault, guests in the house, hazards, the agreement in the app".
-- =============================================================================


-- 1. A JOB NOT SENT OUT UNTIL THE OWNER'S CARD IS USABLE -----------------------

-- Set when a job would have gone straight to tradies but the owner's card was
-- missing, expired, or an earlier charge is unpaid: no_card, expired, unpaid.
alter table public.jobs add column if not exists card_hold text;
alter table public.jobs drop constraint if exists jobs_card_hold_check;
alter table public.jobs add constraint jobs_card_hold_check check (card_hold is null or card_hold in ('no_card', 'expired', 'unpaid'));


-- 2. TRADIES ARE PAID WHATEVER THE CARD DOES ---------------------------------

-- When the tradie was paid although the owner's charge had not gone through: HostFix advanced it, and the owner owes it.
alter table public.payments add column if not exists tradie_paid_ahead_at timestamptz;
-- When the card was last tried, so a new card can be tried at once.
alter table public.payments add column if not exists last_attempt_at timestamptz;
-- Payouts no longer wait for the owner's card.
update public.payouts set status = 'scheduled' where status = 'waiting';
-- What came off a payout to pay back a balance the tradie owes.
alter table public.payouts add column if not exists deducted_cents integer not null default 0;
alter table public.payouts drop constraint if exists payouts_deducted_check;
alter table public.payouts add constraint payouts_deducted_check check (deducted_cents >= 0 and deducted_cents <= amount_cents);


-- 3. CHARGEBACKS ----------------------------------------------------------------

create table if not exists public.chargebacks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  dispute_id  text not null unique,
  job_id      uuid references public.jobs (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency    text not null,
  reason      text not null default '',
  -- open, won, lost (Stripe's warning_closed and prevented count as won: no money lost).
  status      text not null default 'open' check (status in ('open', 'won', 'lost')),
  closed_at   timestamptz,
  -- Once lost, the team decides: the tradie's fault (bad work, a no-show) or not.
  fault       text check (fault is null or fault in ('tradie', 'not_tradie')),
  decided_at  timestamptz,
  decided_by  text
);
create index if not exists chargebacks_job_idx on public.chargebacks (job_id);

-- What a tradie owes HostFix, taken back from later payouts, never more than half of any one.
create table if not exists public.tradie_balances (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  tradie_id   uuid not null references public.tradies (id),
  job_id      uuid references public.jobs (id) on delete set null,
  chargeback_id uuid references public.chargebacks (id) on delete set null,
  reason      text not null,
  amount_cents integer not null check (amount_cents > 0),
  recovered_cents integer not null default 0 check (recovered_cents >= 0),
  currency    text not null,
  status      text not null default 'open' check (status in ('open', 'recovered')),
  constraint tradie_balances_recovered_check check (recovered_cents <= amount_cents)
);
create index if not exists tradie_balances_open_idx on public.tradie_balances (tradie_id, created_at) where status = 'open';

create table if not exists public.balance_recoveries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  balance_id  uuid not null references public.tradie_balances (id),
  payout_id   uuid not null references public.payouts (id),
  amount_cents integer not null check (amount_cents > 0),
  unique (balance_id, payout_id)
);


-- 4. GUESTS IN THE HOUSE --------------------------------------------------------

-- Asked when the owner, a manager or a team member logs a job: yes, no, not_sure. A guest's own report is yes.
alter table public.jobs add column if not exists guest_staying text;
alter table public.jobs drop constraint if exists jobs_guest_staying_check;
alter table public.jobs add constraint jobs_guest_staying_check check (guest_staying is null or guest_staying in ('yes', 'no', 'not_sure'));
-- The staying guest, for this job's texts only.
alter table public.jobs add column if not exists guest_name text;
alter table public.jobs add column if not exists guest_phone text;
-- "If nobody answers, the tradie may let themselves in."
alter table public.jobs add column if not exists may_let_in boolean not null default true;


-- 5. PROPERTY HAZARDS -----------------------------------------------------------

-- "Anything a tradie should know to stay safe?" Shown in the offer and on the job.
alter table public.properties add column if not exists hazards text not null default '';
alter table public.properties drop constraint if exists properties_hazards_check;
alter table public.properties add constraint properties_hazards_check check (char_length(hazards) <= 3000);


-- 6. THE TRADIE AGREEMENT, AGREED IN THE APP ---------------------------------------

alter table public.tradies add column if not exists agreement_version text;
alter table public.tradies add column if not exists agreed_at timestamptz;


-- 7. A FEE CHANGE WAITS 30 DAYS ---------------------------------------------------

alter table public.markets add column if not exists platform_fee_bps_next integer;
alter table public.markets add column if not exists platform_fee_from timestamptz;
alter table public.markets drop constraint if exists markets_platform_fee_next_check;
alter table public.markets add constraint markets_platform_fee_next_check
  check ((platform_fee_bps_next is null and platform_fee_from is null) or (platform_fee_bps_next between 0 and 5000 and platform_fee_from is not null));


-- 8. THE DISPATCHER'S QUEUE ---------------------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring',
  'not_taken_yet', 'arrival_unverified', 'owner_says_absent', 'no_show', 'tradie_review',
  'job_check', 'tradie_flags',
  'receipt_check',
  'card_needed', 'owner_owes', 'chargeback_lost'));


-- 9. LOCK IT DOWN -------------------------------------------------------------

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['chargebacks', 'tradie_balances', 'balance_recoveries'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
