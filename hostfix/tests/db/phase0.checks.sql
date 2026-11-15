-- Checks for the Phase 0 database migration.
-- Everything runs inside one transaction that is rolled back at the end,
-- so no test data is ever left behind.

\set ON_ERROR_STOP on
\o /dev/null
begin;

create function pg_temp.check_true(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'CHECK FAILED: %', msg;
  end if;
end $$;

-- Runs a statement that must fail with one specific kind of error:
--   denied  = the role is not allowed to do this      (SQLSTATE 42501)
--   invalid = the data breaks a rule on the table     (SQLSTATE 23514 or 23502)
--   blocked = our own code refused on purpose         (SQLSTATE P0001)
create function pg_temp.check_fails(kind text, stmt text, msg text) returns void
language plpgsql as $$
declare
  v_state text;
  v_ok boolean;
begin
  begin
    execute stmt;
  exception when others then
    v_state := sqlstate;
    v_ok := case kind
      when 'denied' then v_state = '42501'
      when 'invalid' then v_state in ('23514', '23502')
      when 'blocked' then v_state = 'P0001'
      else false
    end;
    if not v_ok then
      raise exception 'CHECK FAILED: % (expected a "%" error, got SQLSTATE % - %)', msg, kind, v_state, sqlerrm;
    end if;
    return;
  end;
  raise exception 'CHECK FAILED (expected an error but there was none): %', msg;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security is on for every table.
-- ---------------------------------------------------------------------------
select pg_temp.check_true(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.leads'::regclass, 'public.audit_log'::regclass,
                   'public.notifications'::regclass, 'public.rate_limits'::regclass)),
  'RLS is enabled on leads, audit_log, notifications and rate_limits'
);

-- ---------------------------------------------------------------------------
-- The public roles can see and do nothing.
-- ---------------------------------------------------------------------------
set local role anon;
select pg_temp.check_fails('denied', 'select count(*) from public.leads', 'anon cannot read leads');
select pg_temp.check_fails('denied', $q$insert into public.leads (lead_type, market, name, phone, trade) values ('tradie','queenstown','X','+64211111111','plumber')$q$, 'anon cannot add leads');
select pg_temp.check_fails('denied', 'select count(*) from public.audit_log', 'anon cannot read the audit log');
select pg_temp.check_fails('denied', 'select count(*) from public.notifications', 'anon cannot read notifications');
select pg_temp.check_fails('denied', $q$select public.rate_limit_hit('x', 60, 5)$q$, 'anon cannot call rate_limit_hit');
select pg_temp.check_fails('denied', $q$select * from public.record_deposit_paid(gen_random_uuid(), 'NZ', 'cs', 'pi', 'cus', 100, 'nzd')$q$, 'anon cannot call record_deposit_paid');
select pg_temp.check_fails('denied', $q$select * from public.mark_deposit_started(gen_random_uuid(), 'NZ', 'cs', 100, 'nzd')$q$, 'anon cannot call mark_deposit_started');
select pg_temp.check_fails('denied', $q$select * from public.record_deposit_refunded('pi', 100, true, 'evt')$q$, 'anon cannot call record_deposit_refunded');
reset role;

set local role authenticated;
select pg_temp.check_fails('denied', 'select count(*) from public.leads', 'signed-in users cannot read leads');
select pg_temp.check_fails('denied', $q$select public.rate_limit_hit('x', 60, 5)$q$, 'signed-in users cannot call rate_limit_hit');
reset role;

-- ---------------------------------------------------------------------------
-- The server role can save leads, and bad data is rejected.
-- ---------------------------------------------------------------------------
set local role service_role;

create temp table t_ids (k text primary key, id uuid);
grant all on t_ids to public;

with ins as (
  insert into public.leads (lead_type, market, name, phone, email, property_count, managed_by, owner_location, source)
  values ('owner', 'queenstown', 'Olive Owner', '+64211234567', 'olive@example.com', 2, 'self', 'Auckland', 'meta')
  returning id
) insert into t_ids select 'owner', id from ins;

with ins as (
  insert into public.leads (lead_type, market, name, phone, trade, licence_number, days_available)
  values ('tradie', 'queenstown', 'Tane Tradie', '+64221234567', 'plumber', 'PGDB 12345', array['mon','tue'])
  returning id
) insert into t_ids select 'tradie', id from ins;

select pg_temp.check_true(
  (select count(*) = 2 from public.audit_log a where a.action = 'lead.created'
     and a.entity_id in (select id::text from t_ids)),
  'each new lead writes a lead.created audit entry'
);
select pg_temp.check_true(
  (select deposit_status = 'none' and source = 'meta' from public.leads where id = (select id from t_ids where k = 'owner')),
  'a new lead starts with no deposit and keeps its source'
);

select pg_temp.check_fails('invalid', $q$insert into public.leads (lead_type, market, name, phone, property_count) values ('owner','queenstown','No Email','+64211111111', 1)$q$, 'an owner lead needs an email');
select pg_temp.check_fails('invalid', $q$insert into public.leads (lead_type, market, name, phone, email) values ('owner','queenstown','No Count','+64211111111','a@b.co')$q$, 'an owner lead needs a property count');
select pg_temp.check_fails('invalid', $q$insert into public.leads (lead_type, market, name, phone) values ('tradie','queenstown','No Trade','+64211111111')$q$, 'a tradie lead needs a trade');
select pg_temp.check_fails('invalid', $q$insert into public.leads (lead_type, market, name, phone, trade) values ('guest','queenstown','Bad Type','+64211111111','plumber')$q$, 'lead type must be owner or tradie');
select pg_temp.check_fails('invalid', $q$insert into public.leads (lead_type, market, name, phone, email, property_count) values ('owner','queenstown','Zero','+64211111111','a@b.co', 0)$q$, 'property count must be at least 1');
select pg_temp.check_fails('denied', $q$delete from public.leads$q$, 'the server role cannot delete leads');

-- ---------------------------------------------------------------------------
-- Deposit: started, paid once, refunded once.
-- ---------------------------------------------------------------------------
select pg_temp.check_true(
  (select count(*) = 0 from public.mark_deposit_started((select id from t_ids where k = 'tradie'), 'NZ', 'cs_t', 4900, 'nzd')),
  'a tradie lead cannot start a deposit'
);
select pg_temp.check_true(
  (select count(*) = 1 from public.mark_deposit_started((select id from t_ids where k = 'owner'), 'NZ', 'cs_1', 4900, 'nzd')),
  'an owner lead can start a deposit'
);
select pg_temp.check_true(
  (select deposit_status = 'started' and deposit_amount = 4900 and deposit_currency = 'NZD'
     and stripe_checkout_session_id = 'cs_1'
   from public.leads where id = (select id from t_ids where k = 'owner')),
  'starting a deposit records the amount, currency and session'
);

select pg_temp.check_true(
  (select count(*) = 1 from public.record_deposit_paid((select id from t_ids where k = 'owner'), 'NZ', 'cs_2', 'pi_1', 'cus_1', 4900, 'nzd')),
  'the first paid call returns the lead'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.record_deposit_paid((select id from t_ids where k = 'owner'), 'NZ', 'cs_2', 'pi_1', 'cus_1', 4900, 'nzd')),
  'a repeated paid call returns nothing'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.record_deposit_paid((select id from t_ids where k = 'owner'), 'NZ', 'cs_3', 'pi_other', 'cus_1', 4900, 'nzd')),
  'a second, different payment for a paid lead is not recorded as the deposit'
);
select pg_temp.check_true(
  (select deposit_status = 'paid' and deposit_amount = 4900 and deposit_currency = 'NZD'
     and stripe_payment_intent_id = 'pi_1' and stripe_checkout_session_id = 'cs_2'
     and stripe_customer_id = 'cus_1' and deposit_paid_at is not null
   from public.leads where id = (select id from t_ids where k = 'owner')),
  'a paid deposit is stored with its Stripe references'
);
select pg_temp.check_true(
  (select count(*) = 1 and min(amount) = 4900 and min(currency) = 'NZD' and min(actor) = 'stripe'
   from public.audit_log where action = 'deposit.paid'
     and entity_id = (select id::text from t_ids where k = 'owner')),
  'exactly one deposit.paid audit entry with the right amount'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.mark_deposit_started((select id from t_ids where k = 'owner'), 'NZ', 'cs_9', 4900, 'nzd')),
  'a paid lead cannot start another deposit'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.record_deposit_paid(gen_random_uuid(), 'NZ', 'cs_x', 'pi_x', null, 4900, 'nzd')),
  'paying for a lead that does not exist changes nothing'
);

-- part refund: logged, lead stays paid
select pg_temp.check_true(
  (select count(*) = 1 from public.record_deposit_refunded('pi_1', 1000, false, 'evt_part_1')),
  'a part refund is accepted'
);
select pg_temp.check_true(
  (select deposit_status = 'paid' from public.leads where id = (select id from t_ids where k = 'owner')),
  'a part refund leaves the lead as paid'
);
-- full refund
select pg_temp.check_true(
  (select count(*) = 1 from public.record_deposit_refunded('pi_1', 4900, true, 'evt_full_1')),
  'a full refund is accepted'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.record_deposit_refunded('pi_1', 4900, true, 'evt_full_1')),
  'the same refund event twice is ignored'
);
select pg_temp.check_true(
  (select deposit_status = 'refunded' and deposit_refunded_at is not null
   from public.leads where id = (select id from t_ids where k = 'owner')),
  'a full refund marks the lead refunded'
);
select pg_temp.check_true(
  (select count(*) filter (where action = 'deposit.part_refunded') = 1
      and count(*) filter (where action = 'deposit.refunded') = 1
   from public.audit_log where entity_id = (select id::text from t_ids where k = 'owner')),
  'one audit entry per refund event'
);
select pg_temp.check_true(
  (select count(*) = 0 from public.record_deposit_refunded('pi_unknown', 4900, true, 'evt_zzz')),
  'a refund for an unknown payment changes nothing'
);

-- A dedupe key lets the same outside event be logged only once.
insert into public.audit_log (actor, action, entity, entity_id, dedupe_key)
values ('stripe', 'deposit.duplicate_payment', 'lead', 'x', 'dup:cs_test_1')
on conflict (dedupe_key) do nothing;
insert into public.audit_log (actor, action, entity, entity_id, dedupe_key)
values ('stripe', 'deposit.duplicate_payment', 'lead', 'x', 'dup:cs_test_1')
on conflict (dedupe_key) do nothing;
select pg_temp.check_true(
  (select count(*) = 1 from public.audit_log where dedupe_key = 'dup:cs_test_1'),
  'an audit entry with the same dedupe key is stored once'
);

-- ---------------------------------------------------------------------------
-- Notifications can be logged by the server role.
-- ---------------------------------------------------------------------------
insert into public.notifications (channel, template, recipient, status, provider, lead_id)
values ('sms', 'lead_alert', '+61400000000', 'sent', 'clicksend', (select id from t_ids where k = 'owner'));
select pg_temp.check_fails('invalid', $q$insert into public.notifications (channel, template, recipient, status) values ('pigeon','x','y','sent')$q$, 'unknown notification channel is rejected');

-- ---------------------------------------------------------------------------
-- Rate limiting.
-- ---------------------------------------------------------------------------
select pg_temp.check_true(public.rate_limit_hit('test:a', 3600, 3), 'hit 1 of 3 is allowed');
select pg_temp.check_true(public.rate_limit_hit('test:a', 3600, 3), 'hit 2 of 3 is allowed');
select pg_temp.check_true(public.rate_limit_hit('test:a', 3600, 3), 'hit 3 of 3 is allowed');
select pg_temp.check_true(not public.rate_limit_hit('test:a', 3600, 3), 'hit 4 of 3 is refused');
select pg_temp.check_true(public.rate_limit_hit('test:b', 3600, 3), 'a different key has its own count');
select pg_temp.check_fails('blocked', $q$select public.rate_limit_hit('test:c', 0, 3)$q$, 'a zero-length window is rejected');

-- ---------------------------------------------------------------------------
-- The audit log can never be edited, even by the database owner.
-- ---------------------------------------------------------------------------
select pg_temp.check_fails('denied', $q$update public.audit_log set action = 'tampered'$q$, 'server role cannot edit the audit log');
select pg_temp.check_fails('denied', $q$delete from public.audit_log$q$, 'server role cannot delete from the audit log');
reset role;
select pg_temp.check_fails('blocked', $q$update public.audit_log set action = 'tampered'$q$, 'owner cannot edit the audit log');
select pg_temp.check_fails('blocked', $q$delete from public.audit_log$q$, 'owner cannot delete from the audit log');
select pg_temp.check_fails('blocked', $q$truncate public.audit_log$q$, 'owner cannot empty the audit log');

rollback;
\o
\echo 'All database checks passed.'
