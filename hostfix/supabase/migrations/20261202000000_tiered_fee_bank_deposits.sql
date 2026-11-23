-- =============================================================================
-- HostFix: the tiered platform fee, and big work paid by a 50% deposit
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds.
--
-- DECISIONS.md, 2026-11-23 (second entry).
--
-- 1. The tiered fee: 15% on the first NZ$1,000 of a job's price, 3% above it.
-- 2. The owner's NZ bank account, saved once for direct debits.
-- 3. A 50% deposit when approved work takes a job over NZ$1,000, by bank debit
--    (the default) or card, and the other 50% at Job done.
-- 4. The dispatcher's queue: a deposit that did not go through.
-- =============================================================================


-- 1. THE TIERED FEE ------------------------------------------------------------

-- Of a job's price (parts aside), the part up to this amount pays the job's own fee
-- (15%, or 5% for an own client); the part above it pays above_tier_fee_bps (3%).
alter table public.markets add column if not exists tier_threshold_cents integer not null default 100000;
alter table public.markets drop constraint if exists markets_tier_threshold_cents_check;
alter table public.markets add constraint markets_tier_threshold_cents_check check (tier_threshold_cents >= 0);
alter table public.markets add column if not exists above_tier_fee_bps integer not null default 300;
alter table public.markets drop constraint if exists markets_above_tier_fee_bps_check;
alter table public.markets add constraint markets_above_tier_fee_bps_check check (above_tier_fee_bps between 0 and 5000);

-- What the lower fee above the line adds to the tradie's share of this job, kept with the totals
-- (tradie_total_cents already includes it). Worked out again whenever the job's lines change.
alter table public.jobs add column if not exists tier_relief_cents integer not null default 0;
alter table public.jobs drop constraint if exists jobs_tier_relief_check;
alter table public.jobs add constraint jobs_tier_relief_check check (tier_relief_cents >= 0);


-- 2. THE OWNER'S BANK ACCOUNT ----------------------------------------------------

-- A NZ bank account saved with a Direct Debit Authority (Stripe: a PaymentMethod of type nz_bank_account with
-- an active mandate, saved by a SetupIntent). One per owner per country, beside the card.
alter table public.owner_billing add column if not exists bank_payment_method_id text;
alter table public.owner_billing add column if not exists bank_name text;
alter table public.owner_billing add column if not exists bank_last4 text;
alter table public.owner_billing add column if not exists bank_mandate_id text;
alter table public.owner_billing add column if not exists bank_saved_at timestamptz;


-- 3. THE 50% DEPOSIT, AND THE REST AT JOB DONE -------------------------------------

-- A quote that takes the job over NZ$1,000: approving it takes a 50% deposit first.
alter table public.quotes add column if not exists deposit boolean not null default false;

-- job_prepayments now holds the deposit. bank: a direct debit, processing for a few working days.
-- card: charged on the saved card at once.
alter table public.job_prepayments add column if not exists method text not null default 'card';
alter table public.job_prepayments drop constraint if exists job_prepayments_method_check;
alter table public.job_prepayments add constraint job_prepayments_method_check check (method in ('card', 'bank'));
-- Who approved the quote, so the quote is approved in their name once the deposit clears.
alter table public.job_prepayments add column if not exists approved_by text;
-- When the timer last asked the payment company about a debit still processing.
alter table public.job_prepayments add column if not exists checked_at timestamptz;
alter table public.job_prepayments drop constraint if exists job_prepayments_status_check;
alter table public.job_prepayments add constraint job_prepayments_status_check
  check (status in ('charging', 'processing', 'succeeded', 'failed', 'refund_due', 'refunding', 'refunded'));

-- The job's charge beyond the hold is taken the way the deposit was: bank or card.
-- processing: a bank debit has been made and has not cleared yet.
alter table public.payments add column if not exists method text not null default 'card';
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('card', 'bank'));
alter table public.payments add column if not exists checked_at timestamptz;
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'part_refunded'));

create index if not exists job_prepayments_processing_idx on public.job_prepayments (created_at) where status = 'processing';
create index if not exists payments_processing_idx on public.payments (created_at) where status = 'processing';


-- 4. THE DISPATCHER'S QUEUE -------------------------------------------------------

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
  'pattern_pair', 'pattern_cancels', 'part_price', 'hold_failed',
  'deposit_failed'));
