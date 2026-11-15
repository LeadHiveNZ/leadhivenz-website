-- =============================================================================
-- HostFix, Phase 0 (demand test)
-- Tables: leads, notifications, audit_log, rate_limits
--
-- HOW TO USE: copy this whole file into Supabase > SQL Editor > New query > Run.
-- It is safe to run more than once. It never deletes your data.
--
-- SECURITY MODEL: every table has Row Level Security switched on and NO
-- policies. That means the public (publishable) key can read and write nothing.
-- Only the server, using the secret key, can touch these tables.
-- =============================================================================


-- 1. LEADS --------------------------------------------------------------------
-- One row for every owner or tradie who fills in a landing page form.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  lead_type     text not null check (lead_type in ('owner', 'tradie')),
  market        text not null,
  name          text not null check (char_length(name) between 1 and 120),
  phone         text not null check (char_length(phone) between 5 and 32),
  email         text check (email is null or char_length(email) <= 254),

  -- owners only
  property_count integer check (property_count is null or property_count between 1 and 500),
  managed_by     text,
  owner_location text,

  -- tradies only
  trade          text,
  licence_number text,
  days_available text[],

  -- where the lead came from
  source        text not null default 'direct',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  fbclid        text,
  gclid         text,
  ref_code      text,
  referrer      text,
  landing_path  text,

  -- founding member deposit (money is stored in cents, with its currency)
  deposit_status   text not null default 'none'
                   check (deposit_status in ('none', 'started', 'paid', 'refunded')),
  deposit_amount   integer check (deposit_amount is null or deposit_amount > 0),
  deposit_currency text,
  stripe_account   text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_customer_id         text,
  deposit_paid_at     timestamptz,
  deposit_refunded_at timestamptz,

  constraint leads_owner_fields
    check (lead_type <> 'owner' or (email is not null and property_count is not null)),
  constraint leads_tradie_fields
    check (lead_type <> 'tradie' or trade is not null)
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_dedupe_idx on public.leads (lead_type, phone, created_at desc);
create index if not exists leads_payment_intent_idx on public.leads (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;
grant select, insert, update on table public.leads to service_role;


-- 2. AUDIT LOG ----------------------------------------------------------------
-- A permanent record of what happened and of every cent that moved.
-- Rows can be added but never changed or removed.

create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text not null,
  action    text not null,
  entity    text not null,
  entity_id text,
  amount    integer,
  currency  text,
  detail    jsonb not null default '{}'::jsonb,
  -- Optional. Two rows can never share a key, so an event that arrives twice
  -- (for example a repeated message from the payment company) is logged once.
  dedupe_key text unique
);

create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);

create or replace function public.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only: rows cannot be changed or removed';
end
$$;

create or replace trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

create or replace trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select, insert on table public.audit_log to service_role;

-- Every new lead gets an audit entry in the same transaction.
create or replace function public.leads_write_audit_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (
    'system', 'lead.created', 'lead', new.id::text,
    jsonb_build_object('lead_type', new.lead_type, 'market', new.market, 'source', new.source)
  );
  return new;
end
$$;

create or replace trigger leads_audit_insert
  after insert on public.leads
  for each row execute function public.leads_write_audit_on_insert();


-- 3. NOTIFICATIONS ------------------------------------------------------------
-- A record of every alert text and email the system tried to send.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  channel     text not null check (channel in ('sms', 'email')),
  template    text not null,
  recipient   text not null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  provider    text,
  provider_message_id text,
  error       text,
  lead_id     uuid references public.leads (id) on delete set null
);

create index if not exists notifications_lead_idx on public.notifications (lead_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select, insert on table public.notifications to service_role;


-- 4. RATE LIMITS --------------------------------------------------------------
-- Stops one visitor (or one robot) from flooding the forms or guessing the
-- admin password.

create table if not exists public.rate_limits (
  bucket     text primary key,
  hits       integer not null default 0,
  expires_at timestamptz not null
);

create index if not exists rate_limits_expires_idx on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.rate_limits to service_role;

-- Counts one hit against a key and says whether the caller is still inside the
-- limit. Returns true = allowed, false = too many.
create or replace function public.rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_max_hits integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_bucket text;
  v_hits   integer;
begin
  if p_window_seconds < 1 or p_max_hits < 1 then
    raise exception 'rate_limit_hit: window and max must be positive';
  end if;

  v_bucket := p_key || ':' ||
    (floor(extract(epoch from clock_timestamp()) / p_window_seconds))::bigint::text;

  insert into public.rate_limits as r (bucket, hits, expires_at)
  values (v_bucket, 1, clock_timestamp() + make_interval(secs => p_window_seconds * 2))
  on conflict (bucket) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Tidy up expired buckets now and then.
  if random() < 0.05 then
    delete from public.rate_limits where expires_at < clock_timestamp();
  end if;

  return v_hits <= p_max_hits;
end
$$;


-- 5. DEPOSIT MONEY MOVEMENTS --------------------------------------------------
-- Each function changes the lead AND writes the audit entry in one step, so
-- the two can never disagree. Each is safe to call twice for the same event.

-- The owner pressed "reserve my spot" and was sent to the card page.
create or replace function public.mark_deposit_started(
  p_lead_id uuid,
  p_stripe_account text,
  p_checkout_session_id text,
  p_amount integer,
  p_currency text
)
returns setof public.leads
language plpgsql
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  update public.leads l set
    deposit_status = 'started',
    deposit_amount = p_amount,
    deposit_currency = upper(p_currency),
    stripe_account = p_stripe_account,
    stripe_checkout_session_id = p_checkout_session_id
  where l.id = p_lead_id
    and l.lead_type = 'owner'
    and l.deposit_status in ('none', 'started')
  returning l.* into v_lead;

  if not found then
    return;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, amount, currency, detail)
  values (
    'system', 'deposit.started', 'lead', p_lead_id::text, p_amount, upper(p_currency),
    jsonb_build_object('stripe_account', p_stripe_account, 'checkout_session', p_checkout_session_id)
  );

  return next v_lead;
end
$$;

-- The card payment succeeded. Returns the lead the first time only.
create or replace function public.record_deposit_paid(
  p_lead_id uuid,
  p_stripe_account text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_customer_id text,
  p_amount integer,
  p_currency text
)
returns setof public.leads
language plpgsql
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  update public.leads l set
    deposit_status = 'paid',
    deposit_amount = p_amount,
    deposit_currency = upper(p_currency),
    stripe_account = p_stripe_account,
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_payment_intent_id = p_payment_intent_id,
    stripe_customer_id = p_customer_id,
    deposit_paid_at = now()
  where l.id = p_lead_id
    and l.deposit_status in ('none', 'started')
  returning l.* into v_lead;

  if not found then
    return;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, amount, currency, detail)
  values (
    'stripe', 'deposit.paid', 'lead', p_lead_id::text, p_amount, upper(p_currency),
    jsonb_build_object(
      'stripe_account', p_stripe_account,
      'checkout_session', p_checkout_session_id,
      'payment_intent', p_payment_intent_id
    )
  );

  return next v_lead;
end
$$;

-- Money went back to the owner. A full refund flips the lead to "refunded".
-- A part refund is logged only. p_event_id makes a repeated call a no-op.
create or replace function public.record_deposit_refunded(
  p_payment_intent_id text,
  p_amount_refunded integer,
  p_fully_refunded boolean,
  p_event_id text
)
returns setof public.leads
language plpgsql
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select l.* into v_lead
  from public.leads l
  where l.stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1 from public.audit_log a
    where a.dedupe_key = 'stripe:' || p_event_id
  ) then
    return;
  end if;

  if p_fully_refunded then
    update public.leads l set
      deposit_status = 'refunded',
      deposit_refunded_at = now()
    where l.id = v_lead.id
    returning l.* into v_lead;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, amount, currency, detail, dedupe_key)
  values (
    'stripe',
    case when p_fully_refunded then 'deposit.refunded' else 'deposit.part_refunded' end,
    'lead', v_lead.id::text, p_amount_refunded, v_lead.deposit_currency,
    jsonb_build_object('payment_intent', p_payment_intent_id, 'stripe_event', p_event_id),
    'stripe:' || p_event_id
  );

  return next v_lead;
end
$$;


-- 6. WHO MAY CALL THE FUNCTIONS -----------------------------------------------
-- Postgres lets everyone run new functions by default. Lock them to the server.

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_deposit_started(uuid, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.record_deposit_paid(uuid, text, text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.record_deposit_refunded(text, integer, boolean, text) from public, anon, authenticated;
revoke execute on function public.audit_log_is_append_only() from public, anon, authenticated;
revoke execute on function public.leads_write_audit_on_insert() from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.mark_deposit_started(uuid, text, text, integer, text) to service_role;
grant execute on function public.record_deposit_paid(uuid, text, text, text, text, integer, text) to service_role;
grant execute on function public.record_deposit_refunded(text, integer, boolean, text) to service_role;

-- Done. You should see "Success. No rows returned".
