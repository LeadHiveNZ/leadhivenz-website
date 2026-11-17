-- =============================================================================
-- HostFix: free to join
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- DECISIONS.md, 2026-11-17, "Free to join. The money is the 15% on every job."
--
-- 1. A per-property membership may cost nothing. A Portfolio retainer still
--    needs a price.
-- 2. Queenstown's Essential becomes free, with the new line under its name.
--    A database built from scratch gets the same from config/markets.ts.
-- 3. Tradies: who insures them and the policy number, beside the expiry date
--    that was already there. No insurance on file, no offers.
-- 4. A new kind of problem for the dispatcher's queue: a tradie's insurance
--    running out.
-- =============================================================================


-- 1. A FREE MEMBERSHIP IS ALLOWED --------------------------------------------

alter table public.membership_tiers drop constraint if exists membership_tiers_price_cents_check;
alter table public.membership_tiers add constraint membership_tiers_price_cents_check
  check (price_cents >= 0 and (billing_basis = 'per_property' or price_cents > 0));


-- 2. QUEENSTOWN'S ESSENTIAL IS FREE -------------------------------------------
-- Only changes the row if it still differs, so a second run does nothing.

update public.membership_tiers
   set price_cents = 0,
       blurb = 'Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it''s urgent.'
 where market = 'queenstown'
   and key = 'essential'
   and (price_cents <> 0
        or blurb <> 'Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it''s urgent.');


-- 2b. NO NEW FOUNDING DEPOSITS ------------------------------------------------
-- The deposit button is gone from the owner page, and the admin's switch for
-- it goes off too, so the price-list email and the Markets screen agree.

update public.markets set deposit_enabled = false where slug = 'queenstown' and deposit_enabled;


-- 3. TRADIES' PUBLIC LIABILITY INSURANCE --------------------------------------

alter table public.tradies add column if not exists insurer text;
alter table public.tradies add column if not exists insurance_policy_number text;
alter table public.tradies drop constraint if exists tradies_insurer_check;
alter table public.tradies add constraint tradies_insurer_check
  check (insurer is null or char_length(insurer) between 1 and 120);
alter table public.tradies drop constraint if exists tradies_insurance_policy_number_check;
alter table public.tradies add constraint tradies_insurance_policy_number_check
  check (insurance_policy_number is null or char_length(insurance_policy_number) between 1 and 80);


-- 4. THE QUEUE: INSURANCE RUNNING OUT -----------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring'));
