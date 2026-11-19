-- =============================================================================
-- HostFix: a new idempotency key after a payout Stripe definitely refused
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds.
--
-- DECISIONS.md, 2026-11-21, "A payout Stripe refuses for any other reason".
-- =============================================================================

-- How many times Stripe has definitely refused this payout for a reason other
-- than the platform balance (nothing was sent). Like balance_waits, each one
-- moves the payout on to a new idempotency key: Stripe replays a saved error
-- for the same key for 24 hours, so the old key could never succeed. A timeout
-- or a Stripe server error does not count: the money may have moved.
alter table public.payouts add column if not exists refusals integer not null default 0;
alter table public.payouts drop constraint if exists payouts_refusals_check;
alter table public.payouts add constraint payouts_refusals_check check (refusals >= 0);
