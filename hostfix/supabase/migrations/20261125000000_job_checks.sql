-- =============================================================================
-- HostFix: a map pin for every property, and checks on every finished job
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds: nothing is dropped, and
-- old rows are left as they are.
--
-- DECISIONS.md, 2026-11-19, "Checking that a job was really done, without
-- the founder looking at every one".
--
-- 1. Market settings: the shortest time on site before a finished job is
--    flagged (10 minutes), how long the owner has to confirm a flagged job
--    (48 hours), and where the map starts for a property with no pin yet.
-- 2. On each property: its map pin, where the pin came from, and when the
--    owner confirmed it.
-- 3. On each job: the Job done tap's location, what the app made of each tap,
--    the minutes on site, the job's flags and the owner's answer.
-- 4. On each photo: the phone's location sent with it and the time the photo
--    says it was taken. A new kind of photo: "before".
-- 5. A tradie's payment can be held while a flagged job is checked.
-- 6. New kinds in the dispatcher's queue.
-- =============================================================================


-- 1. MARKET SETTINGS -----------------------------------------------------------

-- A job finished sooner than this after Arrived is flagged. 0 switches the check off.
alter table public.markets add column if not exists min_minutes_on_site integer not null default 10;
alter table public.markets drop constraint if exists markets_min_minutes_on_site_check;
alter table public.markets add constraint markets_min_minutes_on_site_check check (min_minutes_on_site between 0 and 120);

-- How long the owner has to answer "is it fixed?" on a flagged job.
alter table public.markets add column if not exists owner_confirm_hours integer not null default 48;
alter table public.markets drop constraint if exists markets_owner_confirm_hours_check;
alter table public.markets add constraint markets_owner_confirm_hours_check check (owner_confirm_hours between 1 and 168);

-- Where the map opens for a property that has no pin yet (the middle of town).
alter table public.markets add column if not exists map_lat numeric(9,6);
alter table public.markets add column if not exists map_lng numeric(9,6);
update public.markets set map_lat = -45.031200, map_lng = 168.662600 where slug = 'queenstown' and map_lat is null;


-- 2. THE PROPERTY'S MAP PIN --------------------------------------------------

alter table public.properties add column if not exists pin_lat numeric(9,6);
alter table public.properties add column if not exists pin_lng numeric(9,6);
-- looked_up: found from the address. owner_moved: placed or moved by the owner. none: no pin yet.
alter table public.properties add column if not exists pin_source text not null default 'none';
alter table public.properties drop constraint if exists properties_pin_source_check;
alter table public.properties add constraint properties_pin_source_check check (pin_source in ('looked_up', 'owner_moved', 'none'));
alter table public.properties drop constraint if exists properties_pin_pair_check;
alter table public.properties add constraint properties_pin_pair_check check (
  (pin_lat is null and pin_lng is null and pin_source = 'none')
  or (pin_lat is not null and pin_lng is not null and pin_source <> 'none'));
-- The owner pressed "Yes, the pin is on the house".
alter table public.properties add column if not exists pin_confirmed_at timestamptz;
-- When the address was last looked up, so the timer does not ask twice.
alter table public.properties add column if not exists pin_lookup_at timestamptz;

create index if not exists properties_pin_lookup_idx on public.properties (created_at) where pin_source = 'none' and pin_lookup_at is null;


-- 3. ON EACH JOB ------------------------------------------------------------

-- What the Arrived and Job done taps were compared with: the property's pin, or where earlier trusted arrivals were.
alter table public.jobs add column if not exists check_reference text;
alter table public.jobs drop constraint if exists jobs_check_reference_check;
alter table public.jobs add constraint jobs_check_reference_check check (check_reference is null or check_reference in ('pin', 'earlier_taps', 'own_arrival', 'none'));
-- Where the phone was when the tradie tapped Job done (or Could not get in).
alter table public.jobs add column if not exists finished_lat numeric(9,6);
alter table public.jobs add column if not exists finished_lng numeric(9,6);
alter table public.jobs add column if not exists finish_check text;
alter table public.jobs drop constraint if exists jobs_finish_check_check;
alter table public.jobs add constraint jobs_finish_check_check
  check (finish_check is null or finish_check in ('ok', 'far', 'no_location', 'no_reference'));
alter table public.jobs add column if not exists finish_distance_m integer;
-- Whole minutes from Arrived to Job done.
alter table public.jobs add column if not exists minutes_on_site integer;
-- Why the job was flagged: arrived_far, arrived_no_location, finished_far, finished_no_location, quick_finish, old_photo.
alter table public.jobs add column if not exists check_flags text[] not null default '{}';
-- A flagged job's check: waiting for the owner, then what was decided.
alter table public.jobs add column if not exists confirm_status text;
alter table public.jobs drop constraint if exists jobs_confirm_status_check;
alter table public.jobs add constraint jobs_confirm_status_check check (confirm_status is null or confirm_status in (
  'waiting', 'owner_confirmed', 'owner_problem', 'released_trusted', 'staff_queue', 'staff_approved', 'staff_held'));
-- When the owner's answer is due. After this the timer decides.
alter table public.jobs add column if not exists confirm_by timestamptz;
alter table public.jobs add column if not exists confirm_decided_at timestamptz;
alter table public.jobs add column if not exists confirm_decided_by text;

create index if not exists jobs_confirm_due_idx on public.jobs (confirm_by) where confirm_status = 'waiting';
create index if not exists jobs_tradie_flagged_idx on public.jobs (tradie_id, completed_at) where cardinality(check_flags) > 0;


-- 4. ON EACH PHOTO ----------------------------------------------------------

alter table public.uploads drop constraint if exists uploads_kind_check;
alter table public.uploads add constraint uploads_kind_check check (kind in (
  'property', 'report', 'completion', 'quote', 'receipt', 'licence', 'insurance', 'dispute',
  'insurance_certificate', 'before'));
-- Where the phone said it was when the photo was sent (the time is created_at, the server's clock).
alter table public.uploads add column if not exists lat numeric(9,6);
alter table public.uploads add column if not exists lng numeric(9,6);
-- The time the photo file itself says it was taken, when the phone put one in it.
alter table public.uploads add column if not exists taken_at timestamptz;


-- 5. A PAYMENT HELD WHILE A FLAGGED JOB IS CHECKED ---------------------------

alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in ('waiting', 'scheduled', 'paused', 'held', 'sent', 'failed', 'cancelled', 'reversed'));


-- 6. THE DISPATCHER'S QUEUE ---------------------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring',
  'not_taken_yet', 'arrival_unverified', 'owner_says_absent', 'no_show', 'tradie_review',
  'job_check', 'tradie_flags'));
