-- =============================================================================
-- 26 November 2026 (DECISIONS.md, 2026-11-26): compliance certificates on a job.
-- A tradie attaches a Certificate of Compliance, Electrical Safety Certificate,
-- gas certificate or the like to a job (a PDF, JPG or PNG). The owner of the
-- property sees and downloads it on the job page; it stays with the job.
-- =============================================================================

alter table public.uploads drop constraint if exists uploads_kind_check;
alter table public.uploads add constraint uploads_kind_check check (kind in (
  'property', 'report', 'completion', 'quote', 'receipt', 'licence', 'insurance', 'dispute',
  'insurance_certificate', 'before', 'certificate'));

-- What a certificate is ("Certificate of Compliance (electrical)"), chosen by the tradie.
alter table public.uploads add column if not exists label text check (label is null or char_length(label) <= 80);
