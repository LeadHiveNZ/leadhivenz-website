-- =============================================================================
-- 26 November 2026 (DECISIONS.md, 2026-11-26, second entry): Emergency, and
-- each tradie's own working hours.
-- Applied automatically when the site is deployed. Safe to run twice.
--
-- 1. A third urgency level, Emergency: a tradie on site within 1 hour for
--    NZ$150 more, charged (and the tradie's share paid) only if they tap
--    Arrived within the hour. It stacks with the after-hours call-out.
--    If nobody accepts in 10 minutes the owner is offered "within 4 hours,
--    NZ$100 less" with one tap. Three market settings, editable on
--    Admin > Markets. A job line of kind 'emergency'.
-- 2. Tradies no longer tick "takes after-hours call-outs". Each one has the
--    hours they want jobs (hours_from to hours_to, 7 and 16.5 like the
--    market's hours) on their days. Those who took after-hours work get
--    6am to 10pm; everyone else gets their market's working hours.
-- =============================================================================

alter table public.markets add column if not exists emergency_surcharge_cents integer not null default 15000
  check (emergency_surcharge_cents >= 0);
alter table public.markets add column if not exists emergency_response_minutes integer not null default 60
  check (emergency_response_minutes between 15 and 240);
alter table public.markets add column if not exists emergency_step_down_minutes integer not null default 10
  check (emergency_step_down_minutes between 1 and 60);

alter table public.jobs drop constraint if exists jobs_urgency_check;
alter table public.jobs add constraint jobs_urgency_check check (urgency in ('standard', 'urgent', 'emergency'));

-- When the owner was offered "within 4 hours instead" on an emergency nobody took, and when they took it.
alter table public.jobs add column if not exists step_down_offered_at timestamptz;
alter table public.jobs add column if not exists stepped_down_at timestamptz;

-- A standard job with nobody inside their hours right now waits, and is offered when someone's hours begin.
alter table public.jobs add column if not exists waiting_for_hours_at timestamptz;
create index if not exists jobs_waiting_for_hours_idx on public.jobs (waiting_for_hours_at) where waiting_for_hours_at is not null;

alter table public.job_lines drop constraint if exists job_lines_kind_check;
alter table public.job_lines add constraint job_lines_kind_check check (kind in (
  'menu', 'diagnosis', 'urgent', 'emergency', 'after_hours', 'quote', 'parts', 'no_access', 'adjustment'));

-- Each tradie's hours, on the half hour, from 0 (midnight) to 24 (midnight).
alter table public.tradies add column if not exists hours_from real;
alter table public.tradies add column if not exists hours_to real;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tradies' and column_name = 'after_hours') then
    update public.tradies t
       set hours_from = case when t.after_hours then 6 else m.hours_start end,
           hours_to   = case when t.after_hours then 22 else m.hours_end end
      from public.markets m
     where m.slug = t.market and (t.hours_from is null or t.hours_to is null);
    alter table public.tradies drop column after_hours;
  end if;
end $$;

update public.tradies set hours_from = 7 where hours_from is null;
update public.tradies set hours_to = 16.5 where hours_to is null;
alter table public.tradies alter column hours_from set default 7;
alter table public.tradies alter column hours_to set default 16.5;
alter table public.tradies alter column hours_from set not null;
alter table public.tradies alter column hours_to set not null;

alter table public.tradies drop constraint if exists tradies_hours_window;
alter table public.tradies add constraint tradies_hours_window check (
  hours_from >= 0 and hours_to <= 24 and hours_to > hours_from
  and hours_from * 2 = round(hours_from * 2) and hours_to * 2 = round(hours_to * 2));
