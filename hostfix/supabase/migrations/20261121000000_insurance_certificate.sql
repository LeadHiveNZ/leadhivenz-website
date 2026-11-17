-- =============================================================================
-- HostFix: the insurance certificate, and the LBP number
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- DECISIONS.md, 2026-11-17, "Free to join", the sub-section "Tradies: the
-- insurance certificate is uploaded, the LBP number is optional".
--
-- 1. A new kind of file: a tradie's public liability certificate of currency.
--    The newest one on file is the current one. Older ones are kept.
-- 2. A certificate sent with the public sign-up form belongs to the lead until
--    the lead is turned into a tradie, then it moves to the tradie.
-- 3. A Licensed Building Practitioner (LBP) number, optional, on the tradie
--    and on the sign-up form. Nothing depends on it.
-- =============================================================================


-- 1. THE CERTIFICATE IS A KIND OF FILE ----------------------------------------
-- 'insurance' stays allowed so the check never refuses an older row. New
-- certificates use 'insurance_certificate'.

alter table public.uploads drop constraint if exists uploads_kind_check;
alter table public.uploads add constraint uploads_kind_check check (kind in (
  'property', 'report', 'completion', 'quote', 'receipt', 'licence', 'insurance', 'dispute',
  'insurance_certificate'));

create index if not exists uploads_tradie_kind_idx on public.uploads (tradie_id, kind, created_at) where tradie_id is not null;


-- 2. A CERTIFICATE SENT WITH THE SIGN-UP FORM ---------------------------------

alter table public.uploads add column if not exists lead_id uuid references public.leads (id) on delete set null;
create index if not exists uploads_lead_idx on public.uploads (lead_id) where lead_id is not null;


-- 3. THE LBP NUMBER, OPTIONAL -------------------------------------------------

alter table public.tradies add column if not exists lbp_number text;
alter table public.tradies drop constraint if exists tradies_lbp_number_check;
alter table public.tradies add constraint tradies_lbp_number_check
  check (lbp_number is null or char_length(lbp_number) between 1 and 40);

alter table public.leads add column if not exists lbp_number text;
alter table public.leads drop constraint if exists leads_lbp_number_check;
alter table public.leads add constraint leads_lbp_number_check
  check (lbp_number is null or char_length(lbp_number) between 1 and 40);
