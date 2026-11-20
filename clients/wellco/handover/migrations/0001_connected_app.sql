-- =============================================================================
--  Wellco project brain: migration 0001 (connected app, 20 Nov 2026)
--  Run AFTER supabase-schema.sql (v3), once per Supabase project
--  (wellco-test first, then Dan's live project).  Safe to run twice: every
--  statement checks first ("if not exists").  Adds columns only; nothing is
--  dropped or rewritten, and no existing data changes.
--
--  Why: the screens Dan signed off in the demo keep a few things v3 has no
--  column for.
--    1. Australian states beyond NSW and QLD (the "State" pick list on sites).
--    2. Settings > Wellco details: director, established, trustee, the
--       management fee amount and note, accountant, letter sign-off and footer.
--    3. Documents: the title Dan types when uploading ("Updated stormwater plan").
--    4. Sales invoices: who the invoice is to when the buyer isn't a contact.
--    5. Letters of offer: the letter date, and the DD expiry and settlement
--       dates worked out when an offer is accepted (they become the project's
--       key dates when the deal is converted).
-- =============================================================================

-- 1. More states (new enum values; existing NSW / QLD rows are untouched)
alter type public.au_state add value if not exists 'VIC';
alter type public.au_state add value if not exists 'SA';
alter type public.au_state add value if not exists 'WA';
alter type public.au_state add value if not exists 'TAS';
alter type public.au_state add value if not exists 'ACT';
alter type public.au_state add value if not exists 'NT';

-- 2. Settings > Wellco details
alter table public.wellco_settings add column if not exists director        text;
alter table public.wellco_settings add column if not exists established     text;
alter table public.wellco_settings add column if not exists trustee         text;
alter table public.wellco_settings add column if not exists fee_amount      numeric(14,2);
alter table public.wellco_settings add column if not exists fee_note        text;
alter table public.wellco_settings add column if not exists accountant      text;
alter table public.wellco_settings add column if not exists letter_signoff  text;
alter table public.wellco_settings add column if not exists letter_footer   text;

-- 3. Document title (the file keeps its standard name; this is the description)
alter table public.documents add column if not exists title text;

-- 4. Sales invoice addressee (free text, e.g. "R & T Nguyen (buyer)")
alter table public.invoices_out add column if not exists bill_to text;

-- 5. Letters of offer
alter table public.deal_offers add column if not exists letter_date   date;
alter table public.deal_offers add column if not exists dd_expiry_on  date;
alter table public.deal_offers add column if not exists settlement_on date;

-- Check (optional):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'deal_offers' and column_name like '%_on';
