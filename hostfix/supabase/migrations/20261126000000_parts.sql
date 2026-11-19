-- =============================================================================
-- HostFix: parts. A fixed-price parts list, receipts plus 20% for anything
-- else, and asking the owner first above the no-ask limit
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice. It only adds: nothing is dropped, and
-- old rows are left as they are (parts added before this change stay at cost).
--
-- DECISIONS.md, 2026-11-20, "Parts: a fixed price list, receipts plus 20%,
-- and asking first".
--
-- 1. The parts price list, one per market, edited on the admin Markets screen.
--    The first prices are loaded from seed/parts-<market>.json the first time
--    the database is brought up to date after this change.
-- 2. Each part added to a job: from the list, or off the list with a receipt.
-- 3. On each photo: a fingerprint of the file, so the same receipt cannot be
--    used twice without anyone noticing.
-- 4. A job line can say which part it charges for.
-- 5. A new kind in the dispatcher's queue: a receipt to check.
-- =============================================================================


-- 1. THE PARTS PRICE LIST ----------------------------------------------------

create table if not exists public.price_list_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  market      text not null references public.markets (slug) on update cascade,
  code        text not null check (code ~ '^[A-Z]{2,4}-[0-9]{2,3}$'),
  name        text not null check (char_length(name) between 2 and 80),
  -- What the owner pays for one, including GST. The tradie gets this less 3%.
  price_cents integer not null check (price_cents > 0 and price_cents <= 1000000),
  active      boolean not null default true,
  sort        integer not null default 0,
  -- Where the price came from, for whoever checks it next.
  source      text not null default '',
  unique (market, code)
);


-- 2. PARTS ON A JOB ----------------------------------------------------------

create table if not exists public.job_parts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  tradie_id   uuid not null references public.tradies (id),
  -- The quote that carries this part's lines (asked first, or added without asking).
  quote_id    uuid references public.quotes (id) on delete set null,
  -- list: from the price list, at its fixed price. receipt: off the list, merchant's price plus 20%.
  kind        text not null check (kind in ('list', 'receipt')),
  price_list_item_id uuid references public.price_list_items (id),
  description text not null check (char_length(description) between 2 and 200),
  quantity    integer not null default 1 check (quantity between 1 and 50),
  -- List parts: the price of one. Receipt parts: null.
  unit_cents  integer check (unit_cents is null or unit_cents > 0),
  -- Receipt parts: the whole receipt, including GST, and the part of it used on this job.
  receipt_total_cents integer check (receipt_total_cents is null or receipt_total_cents > 0),
  amount_cents integer not null check (amount_cents > 0),
  owner_cents  integer not null check (owner_cents >= 0),
  tradie_cents integer not null check (tradie_cents >= 0),
  -- pending: waiting for the owner's yes. active: charged. void: declined, withdrawn or refunded.
  status      text not null default 'active' check (status in ('pending', 'active', 'void')),
  -- not_needed: a list part. needed: no receipt yet. attached. to_follow: the job is done and the
  -- receipt is promised. refunding / refunded: no receipt came in 7 days, so the owner got the money back.
  receipt_status text not null default 'not_needed'
    check (receipt_status in ('not_needed', 'needed', 'attached', 'to_follow', 'refunding', 'refunded')),
  receipt_upload_id uuid references public.uploads (id) on delete set null,
  receipt_date date,
  -- What the checks found: old_receipt, over_receipt, reused_receipt.
  receipt_flags text[] not null default '{}',
  -- flagged: waiting for the team. approved: the team said it is fine. held: the team is holding the payment.
  check_status text check (check_status is null or check_status in ('flagged', 'approved', 'held')),
  checked_at  timestamptz,
  checked_by  text,
  constraint job_parts_list_shape check (kind <> 'list' or (price_list_item_id is not null and unit_cents is not null)),
  constraint job_parts_receipt_shape check (kind <> 'receipt' or receipt_total_cents is not null)
);

create index if not exists job_parts_job_idx on public.job_parts (job_id, created_at);
create index if not exists job_parts_to_follow_idx on public.job_parts (created_at) where receipt_status = 'to_follow';
create index if not exists job_parts_receipt_idx on public.job_parts (receipt_upload_id) where receipt_upload_id is not null;
create index if not exists job_parts_tradie_receipt_idx on public.job_parts (tradie_id, receipt_total_cents, receipt_date) where kind = 'receipt';


-- 3. A FINGERPRINT OF EACH FILE -----------------------------------------------

alter table public.uploads add column if not exists sha256 text;
create index if not exists uploads_sha256_idx on public.uploads (sha256) where sha256 is not null;


-- 4. WHICH PART A LINE CHARGES FOR --------------------------------------------

alter table public.job_lines add column if not exists part_id uuid references public.job_parts (id) on delete set null;


-- 5. THE DISPATCHER'S QUEUE ---------------------------------------------------

alter table public.exceptions drop constraint if exists exceptions_kind_check;
alter table public.exceptions add constraint exceptions_kind_check check (kind in (
  'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
  'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
  'referral_due', 'chargeback', 'credit_failed', 'needs_review', 'portfolio_band',
  'insurance_expiring',
  'not_taken_yet', 'arrival_unverified', 'owner_says_absent', 'no_show', 'tradie_review',
  'job_check', 'tradie_flags',
  'receipt_check'));


-- 6. THE MENU'S OWN WORDS ABOUT PARTS ------------------------------------------
-- Four jobs loaded from seed/menu-queenstown.json said parts were "at cost". Only
-- the exact words as loaded are changed; a description edited on the admin screen
-- is left alone.

update public.menu_items set description = replace(description, ' Parts at cost.', ' Parts: the price list, or the receipt plus 20%.')
  where description like '% Parts at cost.';
update public.menu_items set description = replace(description, 'The fitting itself is a part at cost.', 'The fitting itself is a part: the price list, or the receipt plus 20%.')
  where description like '%The fitting itself is a part at cost.';
update public.menu_items set description = 'Items on top: the receipt plus 20%.' where description = 'Items at cost on top.';
update public.menu_items set description = 'Wood on top: the receipt plus 20%.' where description = 'Wood at cost on top.';


-- 7. LOCK IT DOWN -------------------------------------------------------------

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['price_list_items', 'job_parts'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
