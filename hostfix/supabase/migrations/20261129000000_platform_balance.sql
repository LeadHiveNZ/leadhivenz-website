-- =============================================================================
-- HostFix: paying a tradie ahead when the Stripe balance is too low
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds.
--
-- DECISIONS.md, 2026-11-21.
-- =============================================================================


-- 1. A PAYOUT WAITING FOR THE PLATFORM BALANCE -------------------------------

-- How many times Stripe has said the platform's available balance was too low
-- for this payout. Each such "no" is definite (nothing was sent), so the next
-- try uses a new idempotency key: Stripe replays a saved error for the same key.
alter table public.payouts add column if not exists balance_waits integer not null default 0;
alter table public.payouts drop constraint if exists payouts_balance_waits_check;
alter table public.payouts add constraint payouts_balance_waits_check check (balance_waits >= 0);


-- 2. THE DISPATCHER'S QUEUE ---------------------------------------------------

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
  'platform_balance'));
