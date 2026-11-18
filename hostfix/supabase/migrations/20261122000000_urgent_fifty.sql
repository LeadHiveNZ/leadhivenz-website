-- =============================================================================
-- HostFix: urgent drops to NZ$50 in Queenstown
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- DECISIONS.md, 2026-11-18, "Urgent is NZ$50, and both surcharges carry the
-- 15% fee".
--
-- Queenstown's urgent surcharge goes from NZ$90 to NZ$50. Only changes the
-- row if it still says NZ$90, so a second run does nothing, and a price the
-- admin has since set by hand is left alone. After hours stays NZ$140.
--
-- Jobs already logged keep the surcharge they were quoted: each job's prices
-- are copied onto its own lines (job_lines) when it is logged, and nothing
-- here touches them.
--
-- The 15% fee on surcharges is not stored here: it is worked out from the
-- market's platform fee when a job is logged (src/lib/jobs/pricing.ts).
-- =============================================================================

update public.markets
   set urgent_surcharge_cents = 5000
 where slug = 'queenstown'
   and urgent_surcharge_cents = 9000;
