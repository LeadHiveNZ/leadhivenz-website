-- =============================================================================
-- HostFix, the product (Phases 1 to 4)
--
-- Markets, membership tiers, the fixed-price menu, people (owners, tradies,
-- staff), properties, jobs, offers, quotes, payments, payouts, credits,
-- disputes, referrals, exceptions, uploads and the message outbox.
--
-- HOW IT IS APPLIED: automatically, every time the site is built, by
-- scripts/migrate.ts. You never paste this anywhere. It is safe to run twice.
--
-- SECURITY MODEL: the same as Phase 0. Every table has Row Level Security on
-- with NO policies, so the public key can read and write nothing. Only the
-- server touches these tables. Who may see which rows is decided in the
-- server code (src/lib/access) and tested there.
--
-- MONEY: whole cents plus a currency. Never a decimal.
-- =============================================================================


-- 1. MARKETS ------------------------------------------------------------------
-- One row per town or region. Everything that differs by place lives here.

create table if not exists public.markets (
  slug        text primary key check (slug ~ '^[a-z][a-z0-9-]{1,38}[a-z0-9]$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 2 and 60),
  country     text not null check (country in ('NZ', 'AU')),
  currency    text not null check (currency in ('NZD', 'AUD')),
  timezone    text not null,

  -- draft: being set up. waitlist: landing pages collect leads.
  -- live: owners can sign up and log jobs. paused: no new sign-ups or jobs.
  stage       text not null default 'waitlist' check (stage in ('draft', 'waitlist', 'live', 'paused')),

  -- Tax. Prices shown to owners always include tax. "tax_registered" says
  -- whether the business is registered for it, which decides whether a tax
  -- amount is shown on statements.
  tax_rate        numeric(6,4) not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  tax_name        text not null default 'GST',
  tax_registered  boolean not null default false,
  tax_number      text,

  -- The platform's share of a job, in hundredths of a percent. 1500 = 15%.
  platform_fee_bps             integer not null default 1500 check (platform_fee_bps between 0 and 5000),
  urgent_surcharge_cents       integer not null default 8000 check (urgent_surcharge_cents >= 0),
  after_hours_surcharge_cents  integer not null default 12000 check (after_hours_surcharge_cents >= 0),
  -- Off-menu work: a fixed fee to come and look, then a quote.
  diagnosis_fee_cents          integer not null default 12000 check (diagnosis_fee_cents >= 0),
  diagnosis_payout_cents       integer not null default 10200 check (diagnosis_payout_cents >= 0),
  -- A quote above this needs the owner's yes before work starts.
  approval_threshold_cents     integer not null default 40000 check (approval_threshold_cents >= 0),
  -- Parts: small consumables are included; above the second figure the owner must approve.
  parts_included_cents         integer not null default 3000 check (parts_included_cents >= 0),
  parts_approval_cents         integer not null default 15000 check (parts_approval_cents >= 0),

  -- How long each tradie has to accept an offer.
  offer_minutes   integer not null default 15 check (offer_minutes between 1 and 240),
  -- Normal working hours, in the market's own time. Outside them is after-hours.
  hours_start     integer not null default 7 check (hours_start between 0 and 23),
  hours_end       integer not null default 18 check (hours_end between 1 and 24),
  work_days       text[] not null default '{mon,tue,wed,thu,fri,sat}',
  -- How long after completion the tradie's money is held, as the dispute window.
  payout_hold_hours integer not null default 24 check (payout_hold_hours between 0 and 48),

  referral_reward_cents integer not null default 10000 check (referral_reward_cents >= 0),
  referral_paid_months  integer not null default 3 check (referral_paid_months between 1 and 24),

  -- Founding member deposit, used while the market is a waitlist.
  deposit_enabled boolean not null default false,
  deposit_cents   integer not null default 0 check (deposit_cents >= 0),
  deposit_terms   text[] not null default '{}',

  -- True once this market has a number tradies can reply YES to.
  reply_by_text   boolean not null default false,

  constraint markets_hours check (hours_end > hours_start)
);


-- 2. MEMBERSHIP TIERS ---------------------------------------------------------

create table if not exists public.membership_tiers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  market      text not null references public.markets (slug) on update cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null check (char_length(name) between 2 and 40),
  -- Per property, per month, including tax.
  price_cents integer not null check (price_cents > 0),
  response_hours        integer not null default 24 check (response_hours between 1 and 168),
  urgent_response_hours integer not null default 4 check (urgent_response_hours between 1 and 48),
  -- When true the owner is not charged the urgent surcharge. The tradie still
  -- gets it, so the platform pays. The limit caps how often per month
  -- (null = no limit).
  urgent_included           boolean not null default false,
  urgent_included_per_month integer check (urgent_included_per_month is null or urgent_included_per_month >= 0),
  quarterly_check boolean not null default false,
  blurb       text not null default '',
  sort        integer not null default 0,
  active      boolean not null default true,
  -- The matching product in the payment company's system, created on first use.
  provider_product_id text,
  unique (market, key)
);


-- 3. THE FIXED-PRICE MENU -----------------------------------------------------

create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  market      text not null references public.markets (slug) on update cascade,
  code        text not null check (code ~ '^[A-Z]{2,4}-[0-9]{2,3}$'),
  trade       text not null,
  name        text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  -- A plain "try this first" tip shown before a job is logged. Often saves a call-out.
  try_first   text not null default '',
  owner_price_cents   integer not null check (owner_price_cents > 0),
  tradie_payout_cents integer not null check (tradie_payout_cents >= 0),
  licence_required boolean not null default false,
  -- Whether guests see this on the property's guest link.
  guest_visible boolean not null default true,
  sort        integer not null default 0,
  active      boolean not null default true,
  unique (market, code),
  constraint menu_items_payout_within_price check (tradie_payout_cents <= owner_price_cents)
);

create index if not exists menu_items_market_idx on public.menu_items (market, active, sort);


-- 4. PEOPLE -------------------------------------------------------------------
-- A user is anyone who signs in. What they are (owner, tradie, staff) is held
-- in the tables below, so one person can be more than one thing.

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  -- Always stored lower-case.
  email       text check (email is null or (char_length(email) <= 254 and email = lower(email))),
  -- International format, for example +64211234567.
  phone       text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  last_sign_in_at timestamptz,
  disabled_at timestamptz,
  constraint users_contact check (email is not null or phone is not null)
);

create unique index if not exists users_email_key on public.users (email) where email is not null;
create unique index if not exists users_phone_key on public.users (phone) where phone is not null;

-- A signed-in browser. Only a fingerprint of the cookie is kept here, so a
-- copy of this table cannot be used to sign in as anyone.
create table if not exists public.sessions (
  token_hash   text primary key,
  user_id      uuid not null references public.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  user_agent   text
);

create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists sessions_expiry_idx on public.sessions (expires_at);

-- One-time sign-in codes sent by email or text. Only a fingerprint is kept.
create table if not exists public.sign_in_codes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  identifier  text not null,
  channel     text not null check (channel in ('email', 'sms')),
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  used_at     timestamptz
);

create index if not exists sign_in_codes_lookup_idx on public.sign_in_codes (identifier, created_at desc);

create table if not exists public.staff (
  user_id     uuid primary key references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- dispatcher: the exceptions queue and jobs. admin: everything.
  role        text not null check (role in ('dispatcher', 'admin')),
  disabled_at timestamptz
);

create table if not exists public.owners (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null unique references public.users (id),
  lead_id     uuid references public.leads (id) on delete set null,
  home_location text
);

-- The owner's card on file. One row per country, because each country has its
-- own payment account.
create table if not exists public.owner_billing (
  owner_id    uuid not null references public.owners (id) on delete cascade,
  country     text not null check (country in ('NZ', 'AU')),
  provider    text not null check (provider in ('stripe', 'demo')),
  customer_id text not null,
  payment_method_id text,
  card_brand  text,
  card_last4  text,
  card_exp_month integer,
  card_exp_year  integer,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, country)
);

create unique index if not exists owner_billing_customer_key on public.owner_billing (provider, customer_id);

-- Cleaners and co-hosts who bring in a property. They have no account.
create table if not exists public.referrers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  phone       text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email       text,
  code        text not null unique check (code ~ '^[A-Z0-9]{5,12}$')
);

create unique index if not exists referrers_phone_key on public.referrers (phone);


-- 5. PROPERTIES ---------------------------------------------------------------

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  owner_id    uuid not null references public.owners (id),
  market      text not null references public.markets (slug) on update cascade,
  name        text not null check (char_length(name) between 1 and 80),
  address_line1 text not null check (char_length(address_line1) between 3 and 160),
  address_line2 text,
  suburb      text not null default '',
  postcode    text not null default '',
  -- Lockbox code, alarm, parking, where the water shuts off. Only shown to
  -- the tradie who has accepted a job here.
  access_notes text not null default '',

  tier_id     uuid references public.membership_tiers (id),
  -- setup: added, membership not started. active: paying member.
  -- past_due: the last membership payment failed. cancelled: ended.
  status      text not null default 'setup' check (status in ('setup', 'active', 'past_due', 'cancelled')),
  subscription_provider text check (subscription_provider is null or subscription_provider in ('stripe', 'demo')),
  subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  member_since timestamptz,
  cancelled_at timestamptz,

  -- Two report links. The team link is for cleaners and co-hosts and sends a
  -- tradie straight away. The guest link goes on the QR code in the property.
  team_token  text not null unique check (char_length(team_token) >= 16),
  guest_token text not null unique check (char_length(guest_token) >= 16),
  -- Guest reports wait for the owner's go-ahead unless this is on.
  guest_auto_dispatch boolean not null default false,
  -- The owner's own pre-approved limit for quotes. Null uses the market's.
  spend_limit_cents integer check (spend_limit_cents is null or spend_limit_cents >= 0),

  referrer_id uuid references public.referrers (id) on delete set null
);

create index if not exists properties_owner_idx on public.properties (owner_id);
create index if not exists properties_market_idx on public.properties (market, status);
create unique index if not exists properties_subscription_key
  on public.properties (subscription_provider, subscription_id) where subscription_id is not null;

-- One referral per property. "due" means it is time to pay the referrer.
create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  referrer_id uuid not null references public.referrers (id),
  property_id uuid not null unique references public.properties (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'due', 'paid', 'void')),
  reward_cents integer not null check (reward_cents >= 0),
  currency    text not null,
  due_at      timestamptz,
  paid_at     timestamptz,
  paid_by     text,
  paid_note   text
);

-- Each membership payment, as reported by the payment company.
create table if not exists public.membership_invoices (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id    uuid not null references public.owners (id),
  provider    text not null,
  provider_invoice_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  -- What the tier cost that month, before any credit was taken off.
  list_cents  integer not null default 0 check (list_cents >= 0),
  tax_cents   integer not null default 0 check (tax_cents >= 0),
  currency    text not null,
  status      text not null check (status in ('paid', 'failed', 'refunded')),
  period_start timestamptz,
  period_end   timestamptz,
  paid_at      timestamptz,
  unique (provider, provider_invoice_id)
);

create index if not exists membership_invoices_property_idx on public.membership_invoices (property_id, created_at desc);
create index if not exists membership_invoices_owner_idx on public.membership_invoices (owner_id, created_at desc);


-- 6. TRADIES ------------------------------------------------------------------

create table if not exists public.tradies (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null unique references public.users (id),
  market      text not null references public.markets (slug) on update cascade,
  business_name text not null check (char_length(business_name) between 1 and 120),
  trades      text[] not null check (cardinality(trades) >= 1),
  -- applied: waiting for you to check them. approved: gets offers.
  -- paused: no offers for now. removed: off the network.
  status      text not null default 'applied' check (status in ('applied', 'approved', 'paused', 'removed')),
  approved_at timestamptz,
  approved_by text,
  days_available text[] not null default '{mon,tue,wed,thu,fri}',
  after_hours boolean not null default false,
  gst_registered boolean not null default false,
  gst_number  text,
  insurance_expires_on date,
  -- Where their money goes.
  payout_provider   text check (payout_provider is null or payout_provider in ('stripe', 'demo')),
  payout_account_id text,
  payouts_enabled   boolean not null default false,
  payout_checked_at timestamptz,
  lead_id     uuid references public.leads (id) on delete set null,
  notes       text not null default ''
);

create index if not exists tradies_market_idx on public.tradies (market, status);

-- Licences. A licensed job is only ever offered to a tradie whose licence for
-- that trade has a number and an expiry date that has not passed.
create table if not exists public.tradie_licences (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  tradie_id   uuid not null references public.tradies (id) on delete cascade,
  trade       text not null,
  licence_number text not null check (char_length(licence_number) between 2 and 60),
  expires_on  date not null,
  -- Set when a person has checked the number against the public register.
  verified_at timestamptz,
  verified_by text,
  unique (tradie_id, trade)
);

-- Who is first choice (rank 1) and backup (rank 2) for a trade in a market.
-- The fee columns are for paid slots later. They are switched off.
create table if not exists public.tradie_slots (
  market      text not null references public.markets (slug) on update cascade,
  trade       text not null,
  rank        smallint not null check (rank in (1, 2)),
  tradie_id   uuid not null references public.tradies (id) on delete cascade,
  since       timestamptz not null default now(),
  fee_cents   integer not null default 0 check (fee_cents >= 0),
  fee_active  boolean not null default false,
  primary key (market, trade, rank),
  unique (market, trade, tradie_id)
);


-- 7. JOBS ---------------------------------------------------------------------

create sequence if not exists public.job_number_seq start with 1001;

create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  -- The short number people say out loud: "job 1042".
  number      bigint not null unique default nextval('public.job_number_seq'),
  created_at  timestamptz not null default now(),
  property_id uuid not null references public.properties (id),
  owner_id    uuid not null references public.owners (id),
  market      text not null references public.markets (slug) on update cascade,

  menu_item_id uuid references public.menu_items (id),
  off_menu    boolean not null default false,
  trade       text not null,
  licence_required boolean not null default false,
  title       text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  urgency     text not null default 'standard' check (urgency in ('standard', 'urgent')),
  after_hours boolean not null default false,

  reported_by text not null check (reported_by in ('owner', 'team', 'guest', 'staff')),
  reporter_name  text,
  reporter_phone text,

  -- awaiting_owner: a guest report waiting for the owner's go-ahead.
  -- offering: being offered to tradies. unfilled: nobody took it, with the dispatcher.
  -- accepted: a tradie is booked. on_site: the tradie has arrived.
  -- awaiting_approval: a quote is waiting for the owner. completed. cancelled.
  status      text not null check (status in (
                'awaiting_owner', 'offering', 'unfilled', 'accepted', 'on_site',
                'awaiting_approval', 'completed', 'cancelled')),
  -- How far the offer cascade has got: 1 first choice, 2 backup, 3 everyone, 4 dispatcher.
  stage       smallint not null default 0 check (stage between 0 and 4),
  -- Goes up by one each time the dispatcher starts the offers again.
  offer_round smallint not null default 1,
  tradie_id   uuid references public.tradies (id),

  tier_key       text,
  response_hours integer not null check (response_hours between 1 and 168),
  dispatched_at  timestamptz,
  -- The promise: a tradie on site by this time.
  respond_by     timestamptz,
  accepted_at    timestamptz,
  en_route_at    timestamptz,
  arrived_at     timestamptz,
  arrived_lat    numeric(9,6),
  arrived_lng    numeric(9,6),
  completed_at   timestamptz,
  cancelled_at   timestamptz,
  cancelled_by   text,
  cancel_reason  text,
  -- Set once if the promise was missed.
  window_missed_at timestamptz,
  at_risk_flagged_at timestamptz,
  owner_reminded_at timestamptz,

  outcome     text check (outcome is null or outcome in ('done', 'diagnosis_only', 'no_access')),
  completion_note text,

  -- Totals of the lines below, kept in step inside the same database step.
  currency    text not null,
  owner_total_cents  integer not null default 0 check (owner_total_cents >= 0),
  tradie_total_cents integer not null default 0 check (tradie_total_cents >= 0),
  tax_cents   integer not null default 0 check (tax_cents >= 0),

  constraint jobs_cancelled_has_time check (status <> 'cancelled' or cancelled_at is not null),
  constraint jobs_completed_has_time check (status <> 'completed' or completed_at is not null)
);

create index if not exists jobs_property_idx on public.jobs (property_id, created_at desc);
create index if not exists jobs_owner_idx on public.jobs (owner_id, created_at desc);
create index if not exists jobs_tradie_idx on public.jobs (tradie_id, created_at desc) where tradie_id is not null;
create index if not exists jobs_market_status_idx on public.jobs (market, status, created_at desc);
create index if not exists jobs_open_deadline_idx on public.jobs (respond_by)
  where arrived_at is null and window_missed_at is null
    and status in ('offering', 'unfilled', 'accepted');

-- Every amount on a job, so the maths can be checked line by line.
create table if not exists public.job_lines (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  kind        text not null check (kind in (
                'menu', 'diagnosis', 'urgent', 'after_hours', 'quote', 'parts', 'no_access', 'adjustment')),
  label       text not null,
  -- What the owner pays and what the tradie gets for this line.
  owner_cents  integer not null,
  tradie_cents integer not null,
  -- pending: waiting for the owner's approval. void: declined or withdrawn.
  status      text not null default 'active' check (status in ('active', 'pending', 'void')),
  quote_id    uuid
);

create index if not exists job_lines_job_idx on public.job_lines (job_id, created_at);

-- Each time a job is offered to one tradie.
create sequence if not exists public.offer_number_seq start with 1001;

create table if not exists public.offers (
  id          uuid primary key default gen_random_uuid(),
  -- A short number used in the one-tap link in the text. The link also carries
  -- a signature made with the app's secret, so it cannot be guessed or forged.
  number      bigint not null unique default nextval('public.offer_number_seq'),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  tradie_id   uuid not null references public.tradies (id),
  stage       smallint not null check (stage between 1 and 4),
  round       smallint not null default 1,
  -- superseded: someone else took the job, or it was cancelled, before they answered.
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'passed', 'expired', 'superseded')),
  sent_at     timestamptz not null,
  expires_at  timestamptz not null,
  responded_at timestamptz,
  responded_via text check (responded_via is null or responded_via in ('link', 'text', 'app', 'staff')),
  -- What the tradie was told the job pays.
  payout_cents integer not null check (payout_cents >= 0)
);

create unique index if not exists offers_one_pending_per_tradie on public.offers (job_id, tradie_id) where status = 'pending';
create index if not exists offers_pending_expiry_idx on public.offers (expires_at) where status = 'pending';
create index if not exists offers_tradie_idx on public.offers (tradie_id, sent_at desc);
create index if not exists offers_job_idx on public.offers (job_id, sent_at);

-- Extra or off-menu work the tradie has priced.
create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  tradie_id   uuid not null references public.tradies (id),
  description text not null check (char_length(description) between 3 and 1000),
  -- The price of the work to the owner, and parts at cost.
  labour_cents integer not null check (labour_cents >= 0),
  parts_cents  integer not null default 0 check (parts_cents >= 0),
  owner_total_cents  integer not null check (owner_total_cents > 0),
  tradie_total_cents integer not null check (tradie_total_cents >= 0),
  needs_approval boolean not null,
  status      text not null check (status in ('pending', 'approved', 'auto_approved', 'declined', 'withdrawn')),
  decided_at  timestamptz,
  decided_by  text,
  reminded_at timestamptz
);

create index if not exists quotes_job_idx on public.quotes (job_id, created_at);
create unique index if not exists quotes_one_pending_per_job on public.quotes (job_id) where status = 'pending';


-- 8. MONEY --------------------------------------------------------------------

-- Money in: the owner's card charged for a job. One row per job.
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid not null unique references public.jobs (id),
  owner_id    uuid not null references public.owners (id),
  amount_cents integer not null check (amount_cents > 0),
  tax_cents   integer not null default 0 check (tax_cents >= 0),
  currency    text not null,
  status      text not null check (status in ('pending', 'succeeded', 'failed', 'refunded', 'part_refunded')),
  provider    text not null check (provider in ('stripe', 'demo')),
  payment_intent_id text,
  charge_id   text,
  -- How many tries have ended in a definite "no". A try that was cut off
  -- half-way is not counted, so it is repeated with the same key and can
  -- never become a second charge.
  attempts    integer not null default 0,
  -- Set while one server is talking to the payment company about this charge,
  -- so no other server starts the same charge at the same moment.
  claimed_until timestamptz,
  last_error  text,
  next_retry_at timestamptz,
  paid_at     timestamptz,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  constraint payments_refund_within_amount check (refunded_cents <= amount_cents)
);

create index if not exists payments_owner_idx on public.payments (owner_id, created_at desc);
create index if not exists payments_retry_idx on public.payments (next_retry_at) where status = 'failed';
create unique index if not exists payments_intent_key on public.payments (provider, payment_intent_id) where payment_intent_id is not null;

-- Money out: the tradie's share of a job. One row per job.
create table if not exists public.payouts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid not null unique references public.jobs (id),
  tradie_id   uuid not null references public.tradies (id),
  amount_cents integer not null check (amount_cents > 0),
  currency    text not null,
  -- waiting: the owner's payment has not gone through yet.
  -- scheduled: will be sent at release_at. paused: a dispute is open.
  -- sent. failed: sending went wrong. cancelled: nothing to pay. reversed: pulled back.
  status      text not null check (status in ('waiting', 'scheduled', 'paused', 'sent', 'failed', 'cancelled', 'reversed')),
  release_at  timestamptz not null,
  provider    text check (provider is null or provider in ('stripe', 'demo')),
  transfer_id text,
  sent_at     timestamptz,
  attempts    integer not null default 0,
  last_error  text
);

create index if not exists payouts_tradie_idx on public.payouts (tradie_id, created_at desc);
create index if not exists payouts_due_idx on public.payouts (release_at) where status = 'scheduled';

-- Money given back to an owner as credit against their membership.
create table if not exists public.credits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  owner_id    uuid not null references public.owners (id),
  property_id uuid references public.properties (id) on delete set null,
  job_id      uuid references public.jobs (id) on delete set null,
  reason      text not null check (reason in ('missed_window', 'goodwill', 'founding_deposit')),
  amount_cents integer not null check (amount_cents > 0),
  currency    text not null,
  -- The calendar month it belongs to, in the market's own time: 2026-11.
  month       text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  -- pending: recorded, not yet passed to the payment company. applied. failed. void.
  status      text not null check (status in ('pending', 'applied', 'failed', 'void')),
  provider_ref text,
  note        text,
  created_by  text not null
);

create index if not exists credits_owner_idx on public.credits (owner_id, created_at desc);
-- The guarantee credit is capped at one per property per calendar month.
create unique index if not exists credits_one_guarantee_per_month
  on public.credits (property_id, month) where reason = 'missed_window' and status <> 'void';
create unique index if not exists credits_one_per_job on public.credits (job_id) where reason = 'missed_window';

create table if not exists public.disputes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  job_id      uuid not null unique references public.jobs (id),
  raised_by   text not null,
  reason      text not null check (char_length(reason) between 3 and 2000),
  -- open, then: paid (tradie paid in full), refund (owner refunded), redo (tradie going back).
  status      text not null default 'open' check (status in ('open', 'resolved_paid', 'resolved_refund', 'resolved_redo')),
  refund_cents integer check (refund_cents is null or refund_cents >= 0),
  resolution_note text,
  resolved_at timestamptz,
  resolved_by text
);


-- 9. THE DISPATCHER'S QUEUE ---------------------------------------------------
-- One row per thing that needs a person. The dispatcher sees only these.

create table if not exists public.exceptions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  market      text,
  kind        text not null check (kind in (
                'nobody_accepted', 'at_risk', 'missed_window', 'dispute', 'payment_failed',
                'payout_failed', 'quote_waiting', 'licence_expiring', 'message_failed',
                'referral_due', 'chargeback', 'credit_failed')),
  job_id      uuid references public.jobs (id) on delete cascade,
  tradie_id   uuid references public.tradies (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  summary     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  -- Stops the same problem being raised twice.
  dedupe_key  text unique
);

create index if not exists exceptions_open_idx on public.exceptions (status, created_at desc);
create index if not exists exceptions_job_idx on public.exceptions (job_id);


-- 10. PHOTOS AND FILES --------------------------------------------------------

create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('property', 'report', 'completion', 'quote', 'receipt', 'licence', 'insurance', 'dispute')),
  storage_key text not null unique,
  content_type text not null,
  bytes       integer not null check (bytes > 0),
  property_id uuid references public.properties (id) on delete cascade,
  job_id      uuid references public.jobs (id) on delete cascade,
  tradie_id   uuid references public.tradies (id) on delete cascade,
  -- Who sent the file: "owner:<id>", "tradie:<id>", "report:<property id>", "staff:<id>".
  uploaded_by text not null,
  -- False until the form it belongs to is submitted. Unattached files are cleared out.
  attached    boolean not null default false
);

create index if not exists uploads_job_idx on public.uploads (job_id) where job_id is not null;
create index if not exists uploads_property_idx on public.uploads (property_id) where property_id is not null;
create index if not exists uploads_unattached_idx on public.uploads (created_at) where attached = false;


-- 11. MESSAGES ----------------------------------------------------------------
-- The notifications table from Phase 0 becomes the outbox for every text and
-- email. A message is written here in the same step as the change that caused
-- it, then sent. If sending fails it is tried again.

alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists subject text;
alter table public.notifications add column if not exists job_id uuid references public.jobs (id) on delete set null;
alter table public.notifications add column if not exists user_id uuid references public.users (id) on delete set null;
alter table public.notifications add column if not exists audience text;
alter table public.notifications add column if not exists attempts integer not null default 0;
alter table public.notifications add column if not exists send_after timestamptz;
alter table public.notifications add column if not exists sent_at timestamptz;
alter table public.notifications add column if not exists dedupe_key text;

alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('queued', 'sent', 'failed', 'skipped', 'demo'));

create unique index if not exists notifications_dedupe_key on public.notifications (dedupe_key) where dedupe_key is not null;
create index if not exists notifications_queue_idx on public.notifications (send_after) where status = 'queued';
create index if not exists notifications_job_idx on public.notifications (job_id) where job_id is not null;

grant update on table public.notifications to service_role;

-- Texts that arrive from tradies (YES / NO replies).
create table if not exists public.sms_inbound (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  provider    text not null,
  from_phone  text,
  body        text,
  raw         jsonb not null default '{}'::jsonb,
  -- What the system did with it: accepted, passed, not_understood, no_offer, unknown_sender.
  outcome     text,
  offer_id    uuid references public.offers (id) on delete set null
);

create index if not exists sms_inbound_created_idx on public.sms_inbound (created_at desc);


-- 12. SMALL SETTINGS ----------------------------------------------------------
-- Things the system needs to remember, such as when the timer last ran.

create table if not exists public.app_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);


-- 13. LEADS: two more states --------------------------------------------------
-- A paid founding deposit becomes a credit when that owner signs up.

alter table public.leads drop constraint if exists leads_deposit_status_check;
alter table public.leads add constraint leads_deposit_status_check
  check (deposit_status in ('none', 'started', 'paid', 'refunded', 'credited'));
alter table public.leads add column if not exists converted_at timestamptz;
alter table public.leads add column if not exists invited_at timestamptz;


-- 14. LOCK EVERYTHING DOWN ----------------------------------------------------
-- Row Level Security on for every table, and nothing for the public roles.
-- Written as a loop so a table added later can never be forgotten.

do $$
declare
  t record;
  r text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t.tablename, r);
      end if;
    end loop;
  end loop;

  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke execute on all functions in schema public from %I', r);
    end if;
  end loop;
end
$$;

revoke execute on all functions in schema public from public;
