-- =============================================================================
-- HostFix: more trades, and "Not sure" jobs go to a person
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds.
--
-- DECISIONS.md, 2026-11-24.
--
-- The new trades (cleaner, window_cleaner, gardener, builder, painter, roofer,
-- pest_control, carpet_cleaner, pool_spa, drainage_septic) need no change here:
-- trades are plain text keys from config/trades.ts. The menu items for them are
-- in seed/menu-queenstown.json, which only fills an empty database.
--
-- 1. The dispatcher's queue: a job whose owner was not sure of the trade.
-- =============================================================================

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
  'deposit_failed',
  'trade_needed'));
