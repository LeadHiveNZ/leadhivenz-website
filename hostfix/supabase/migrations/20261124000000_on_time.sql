-- =============================================================================
-- HostFix: paid for what happened, and an on-time record
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds: nothing is dropped, and
-- old rows (including old missed-promise credits) are left as they are.
--
-- DECISIONS.md, 2026-11-18, "Missing the time no longer costs HostFix; the
-- owner pays for what actually happened".
--
-- 1. Two market settings: how long before the owner and the team are told
--    nobody has taken a normal job (3 hours), and how long the owner has to
--    answer a chosen tradie's "can't make that time, I can come then" (2 hours).
-- 2. On each job: the arrival window the tradie chose when accepting, the
--    "nobody has taken it yet" alert, a no-show, what the app made of the
--    Arrived tap's location, and the owner saying the tradie is not there.
-- 3. A chosen tradie's suggested later time, and the owner's answer.
-- 4. New kinds in the dispatcher's queue.
-- =============================================================================


-- 1. MARKET SETTINGS -----------------------------------------------------------

alter table public.markets add column if not exists unaccepted_alert_hours integer not null default 3;
alter table public.markets drop constraint if exists markets_unaccepted_alert_hours_check;
alter table public.markets add constraint markets_unaccepted_alert_hours_check check (unaccepted_alert_hours between 1 and 23);

alter table public.markets add column if not exists counter_offer_hours integer not null default 2;
alter table public.markets drop constraint if exists markets_counter_offer_hours_check;
alter table public.markets add constraint markets_counter_offer_hours_check check (counter_offer_hours between 1 and 12);


-- 2. ON EACH JOB ------------------------------------------------------------

-- The window the tradie picked when they accepted. On time means arrived by the end of it.
alter table public.jobs add column if not exists arrival_window_start timestamptz;
alter table public.jobs add column if not exists arrival_window_end timestamptz;
-- Set once when a normal job has gone 3 hours with nobody accepting.
alter table public.jobs add column if not exists unaccepted_alerted_at timestamptz;
-- Set once when an accepted job reaches its promised time with nobody on site.
alter table public.jobs add column if not exists no_show_at timestamptz;
-- What the app made of the Arrived tap: ok, far, no_location, no_reference.
alter table public.jobs add column if not exists arrival_check text;
alter table public.jobs drop constraint if exists jobs_arrival_check_check;
alter table public.jobs add constraint jobs_arrival_check_check
  check (arrival_check is null or arrival_check in ('ok', 'far', 'no_location', 'no_reference'));
-- How far, in metres, the Arrived tap was from the property's reference point.
alter table public.jobs add column if not exists arrival_distance_m integer;
-- The owner pressed "The tradie isn't here".
alter table public.jobs add column if not exists owner_says_absent_at timestamptz;

create index if not exists jobs_tradie_arrived_idx on public.jobs (tradie_id, arrived_at desc) where arrived_at is not null;
create index if not exists jobs_tradie_no_show_idx on public.jobs (tradie_id, no_show_at) where no_show_at is not null;


-- 3. A CHOSEN TRADIE SUGGESTS A LATER TIME ---------------------------------------

create table if not exists public.arrival_proposals (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  offer_id    uuid not null references public.offers (id) on delete cascade,
  tradie_id   uuid not null references public.tradies (id),
  -- The window the tradie can come in.
  window_start timestamptz not null,
  window_end   timestamptz not null,
  -- waiting: the owner has not answered. accepted: the owner will wait.
  -- declined: the owner sent it on. expired: no answer in time, so it was sent on.
  status      text not null default 'waiting' check (status in ('waiting', 'accepted', 'declined', 'expired')),
  -- When the owner's answer is due. After this it is sent on to other tradies.
  answer_by   timestamptz not null,
  decided_at  timestamptz,
  decided_by  text,
  constraint arrival_proposals_window check (window_end > window_start)
);

create index if not exists arrival_proposals_job_idx on public.arrival_proposals (job_id, created_at);
create unique index if not exists arrival_proposals_one_waiting on public.arrival_proposals (job_id) where status = 'waiting';
create index if not exists arrival_proposals_due_idx on public.arrival_proposals (answer_by) where status = 'waiting';

alter table public.arrival_proposals enable row level security;


-- 4. THE DISPATCHER'S QUEUE ---------------------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring',
  'not_taken_yet', 'arrival_unverified', 'owner_says_absent', 'no_show', 'tradie_review'));
