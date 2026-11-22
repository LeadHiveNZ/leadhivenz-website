-- =============================================================================
-- HostFix: a hold on the owner's card at booking, pattern flags, the payout
-- guarantee capped at NZ$1,000, simpler parts, and the 5% own-client rate
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds (and moves the launch
-- market's small-parts amount from NZ$30 to NZ$20 where it was still NZ$30).
--
-- DECISIONS.md, 2026-11-23.
--
-- 1. Holds on the owner's card: one row per hold placed for a job.
-- 2. What a job's charge took from a hold, and the second charge for the rest.
-- 3. The payout guarantee: the most of a job's uncollected price HostFix pays
--    the tradie ahead of the owner's card, and the part of a payout that waits.
-- 4. A big quote charged when the owner approves it.
-- 5. Parts priced by the tradie, and receipts the team asks for.
-- 6. Tradie + property pairs at the own-client rate, and the invite links.
-- 7. The dispatcher's queue: pattern flags, a part priced well over the list,
--    a hold that could not be renewed.
-- =============================================================================


-- 1. HOLDS ON THE OWNER'S CARD -------------------------------------------------

-- Why a job is waiting before it goes out: no_card, expired, unpaid (as before),
-- declined (the hold was declined), placing (the hold is being placed right now).
alter table public.jobs drop constraint if exists jobs_card_hold_check;
alter table public.jobs add constraint jobs_card_hold_check check (card_hold is null or card_hold in ('no_card', 'expired', 'unpaid', 'declined', 'placing'));

-- A job whose visit is further away than a hold can last gets its hold placed
-- a day before the visit instead (the timer places it at this time).
alter table public.jobs add column if not exists hold_due_at timestamptz;

create table if not exists public.card_holds (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  owner_id    uuid not null references public.owners (id),
  -- 1 for the first hold on a job, 2 for the one that replaced it, and so on. Part of the idempotency key.
  seq         integer not null check (seq >= 1),
  -- booking: when the job went out. refresh: replacing one about to run out. scheduled: a day before a far-off visit.
  reason      text not null check (reason in ('booking', 'refresh', 'scheduled')),
  amount_cents integer not null check (amount_cents > 0),
  currency    text not null,
  provider    text check (provider is null or provider in ('stripe', 'demo')),
  -- placing: being asked for. held: on the card. declined: the card said no. cancel_due: to be released.
  -- cancelled: released, nothing charged. captured: the job's charge was taken from it. expired: ran out.
  status      text not null default 'placing'
    check (status in ('placing', 'held', 'declined', 'cancel_due', 'cancelled', 'captured', 'expired')),
  payment_intent_id text,
  charge_id   text,
  -- When the card network lets go of the hold (Stripe: payment_method_details.card.capture_before on the charge).
  capture_before timestamptz,
  captured_cents integer not null default 0 check (captured_cents >= 0),
  captured_at timestamptz,
  cancelled_at timestamptz,
  claimed_until timestamptz,
  last_error  text,
  unique (job_id, seq),
  constraint card_holds_capture_within check (captured_cents <= amount_cents)
);

create index if not exists card_holds_job_idx on public.card_holds (job_id, seq desc);
create index if not exists card_holds_live_idx on public.card_holds (capture_before) where status = 'held';
create index if not exists card_holds_cancel_idx on public.card_holds (created_at) where status = 'cancel_due';


-- 2. A JOB'S CHARGE: TAKEN FROM THE HOLD, THE REST CHARGED SEPARATELY -----------

-- payment_intent_id / charge_id stay the first payment (the hold when there was one).
alter table public.payments add column if not exists hold_id uuid references public.card_holds (id);
alter table public.payments add column if not exists hold_captured_cents integer not null default 0;
alter table public.payments drop constraint if exists payments_hold_captured_check;
alter table public.payments add constraint payments_hold_captured_check check (hold_captured_cents >= 0 and hold_captured_cents <= amount_cents);
-- The separate charge for anything beyond the hold (approved parts or work, surcharges that grew).
alter table public.payments add column if not exists extra_payment_intent_id text;
alter table public.payments add column if not exists extra_charge_id text;


-- 3. THE PAYOUT GUARANTEE ------------------------------------------------------

-- The most of a job's price, not yet collected from the owner, that the tradie
-- is paid ahead of the card. NZ$1,000. Above it, their share waits.
alter table public.markets add column if not exists payout_guarantee_cents integer not null default 100000;
alter table public.markets drop constraint if exists markets_payout_guarantee_cents_check;
alter table public.markets add constraint markets_payout_guarantee_cents_check check (payout_guarantee_cents >= 0);

-- The part of a payout held back until the owner's card pays, worked out once
-- on the payout's first try. Sent separately once the card pays.
alter table public.payouts add column if not exists waits_cents integer not null default 0;
alter table public.payouts drop constraint if exists payouts_waits_check;
alter table public.payouts add constraint payouts_waits_check check (waits_cents >= 0 and waits_cents <= amount_cents);
-- waiting: for the owner's card. due: the card paid, send it. sent. cancelled: refunded away.
alter table public.payouts add column if not exists rest_status text;
alter table public.payouts drop constraint if exists payouts_rest_status_check;
alter table public.payouts add constraint payouts_rest_status_check check (rest_status is null or rest_status in ('waiting', 'due', 'sent', 'cancelled'));
alter table public.payouts add column if not exists rest_transfer_id text;
alter table public.payouts add column if not exists rest_sent_at timestamptz;
alter table public.payouts add column if not exists rest_error text;


-- 4. A BIG QUOTE CHARGED WHEN THE OWNER APPROVES IT ------------------------------

create table if not exists public.job_prepayments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  quote_id    uuid not null unique references public.quotes (id),
  owner_id    uuid not null references public.owners (id),
  amount_cents integer not null check (amount_cents > 0),
  currency    text not null,
  provider    text check (provider is null or provider in ('stripe', 'demo')),
  -- charging: being charged. succeeded. failed: the card said no (the quote is not approved).
  -- refund_due: the work did not happen, refund it. refunding. refunded.
  status      text not null check (status in ('charging', 'succeeded', 'failed', 'refund_due', 'refunding', 'refunded')),
  payment_intent_id text,
  charge_id   text,
  attempts    integer not null default 0,
  claimed_until timestamptz,
  last_error  text,
  paid_at     timestamptz,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  constraint job_prepayments_refund_within check (refunded_cents <= amount_cents)
);

create index if not exists job_prepayments_job_idx on public.job_prepayments (job_id);
create index if not exists job_prepayments_refund_idx on public.job_prepayments (created_at) where status = 'refund_due';


-- 5. PARTS PRICED BY THE TRADIE, AND RECEIPTS THE TEAM ASKS FOR -----------------

-- priced: the tradie's own price including GST (from 23 Nov 2026). list and receipt: parts added before then.
alter table public.job_parts drop constraint if exists job_parts_kind_check;
alter table public.job_parts add constraint job_parts_kind_check check (kind in ('list', 'receipt', 'priced'));
alter table public.job_parts drop constraint if exists job_parts_receipt_status_check;
alter table public.job_parts add constraint job_parts_receipt_status_check
  check (receipt_status in ('not_needed', 'needed', 'attached', 'to_follow', 'requested', 'refunding', 'refunded'));
alter table public.job_parts add column if not exists receipt_requested_at timestamptz;
alter table public.job_parts add column if not exists receipt_requested_by text;
-- A priced part picked from the price list keeps the list price it was compared with.
alter table public.job_parts add column if not exists list_price_cents integer;

-- Small parts in every job's price: NZ$20 from 23 Nov 2026 (was NZ$30). Only a market still on NZ$30 moves.
alter table public.markets alter column parts_included_cents set default 2000;
update public.markets set parts_included_cents = 2000 where parts_included_cents = 3000;


-- 6. OWN CLIENTS: TRADIE + PROPERTY PAIRS AT 5% ---------------------------------

-- The fee on this job when it is not the market's (a job between an own-client pair). Null: the market's fee.
alter table public.jobs add column if not exists platform_fee_bps integer;
alter table public.jobs drop constraint if exists jobs_platform_fee_bps_check;
alter table public.jobs add constraint jobs_platform_fee_bps_check check (platform_fee_bps is null or platform_fee_bps between 0 and 5000);
-- An offer to the tradie of an own-client pair. These never count as HostFix introducing that tradie to the property.
alter table public.offers add column if not exists own_client boolean not null default false;

create table if not exists public.own_client_pairs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  tradie_id   uuid not null references public.tradies (id),
  property_id uuid not null references public.properties (id),
  owner_id    uuid not null references public.owners (id),
  -- The property's address, normalised, when the pair was made.
  address_key text not null,
  -- tradie_invite: the tradie invited their client. owner_invite: the owner brought their own tradie.
  via         text not null check (via in ('tradie_invite', 'owner_invite')),
  invite_id   uuid,
  status      text not null default 'active' check (status in ('active', 'ended')),
  ended_at    timestamptz,
  unique (tradie_id, property_id)
);

create index if not exists own_client_pairs_property_idx on public.own_client_pairs (property_id) where status = 'active';

create table if not exists public.client_invites (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  -- The secret in the link. Opening the link changes nothing; pressing the button on its page does.
  token       text not null unique check (char_length(token) between 16 and 64),
  from_side   text not null check (from_side in ('tradie', 'owner')),
  -- A tradie's invite: who sent it. An owner's invite: who it is for, once they have signed up.
  tradie_id   uuid references public.tradies (id),
  -- An owner's invite: who sent it, and for which property.
  owner_id    uuid references public.owners (id),
  property_id uuid references public.properties (id),
  -- Who it was sent to, as typed.
  name        text not null default '' check (char_length(name) <= 80),
  phone       text,
  email       text,
  trade       text,
  status      text not null default 'open' check (status in ('open', 'used', 'cancelled')),
  used_at     timestamptz,
  pair_id     uuid references public.own_client_pairs (id),
  constraint client_invites_shape check (
    (from_side = 'tradie' and tradie_id is not null) or (from_side = 'owner' and owner_id is not null and property_id is not null))
);

create index if not exists client_invites_tradie_idx on public.client_invites (tradie_id, created_at desc);
create index if not exists client_invites_owner_idx on public.client_invites (owner_id, created_at desc);


-- 7. THE DISPATCHER'S QUEUE -----------------------------------------------------

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
  'not_described', 'quote_rate', 'sms_opted_out',
  'platform_balance',
  'pattern_pair', 'pattern_cancels', 'part_price', 'hold_failed'));


-- ROW LEVEL SECURITY: on, with no policies, like every other table -------------

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['card_holds', 'job_prepayments', 'own_client_pairs', 'client_invites'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
