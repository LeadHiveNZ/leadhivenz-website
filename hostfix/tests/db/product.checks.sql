-- Checks for the product database (Phases 1 to 4).
-- Proves, on a real Postgres with Supabase's roles, that the public key can
-- read and write NOTHING, and that the database refuses data that breaks the
-- money rules. Everything is rolled back at the end.

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
      when 'invalid' then v_state in ('23514', '23502', '23505', '23503')
      when 'blocked' then v_state = 'P0001'
      else false
    end;
    if not v_ok then
      raise exception 'CHECK FAILED: % (expected a "%" error, got SQLSTATE % - %)', msg, kind, v_state, sqlerrm;
    end if;
    return;
  end;
  raise exception 'CHECK FAILED: % (the statement was allowed)', msg;
end $$;

-- 1. Every table has row level security on, and no policy opens it up.
select pg_temp.check_true(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'every public table has row level security switched on');
select pg_temp.check_true(
  not exists (select 1 from pg_policies where schemaname = 'public'),
  'no policies exist, so the public key sees nothing');

-- 2. The public roles cannot read or write a single table. Tried one by one.
do $$
declare
  t record;
  r text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    foreach r in array array['anon', 'authenticated'] loop
      execute format('set local role %I', r);
      perform pg_temp.check_fails('denied', format('select count(*) from public.%I', t.tablename), format('%s cannot read %s', r, t.tablename));
      perform pg_temp.check_fails('denied', format('delete from public.%I', t.tablename), format('%s cannot delete from %s', r, t.tablename));
      reset role;
    end loop;
  end loop;
end $$;

-- 3. The public roles cannot run any of our functions.
set local role anon;
select pg_temp.check_fails('denied', $$select public.rate_limit_hit('x', 60, 5)$$, 'anon cannot call rate_limit_hit');
reset role;

-- 4. The database itself refuses money that breaks the rules.
insert into public.markets (slug, name, country, currency, timezone, stage) values ('checktown', 'Checktown', 'NZ', 'NZD', 'Pacific/Auckland', 'live');
select pg_temp.check_fails('invalid',
  $$insert into public.menu_items (market, code, trade, name, owner_price_cents, tradie_payout_cents) values ('checktown', 'ZZ-01', 'handyman', 'Pays too much', 10000, 10001)$$,
  'a menu item cannot pay the tradie more than the owner is charged');
select pg_temp.check_fails('invalid',
  $$insert into public.menu_items (market, code, trade, name, owner_price_cents, tradie_payout_cents) values ('checktown', 'ZZ-02', 'handyman', 'Free', 0, 0)$$,
  'a menu item cannot be free');
select pg_temp.check_fails('invalid',
  $$insert into public.markets (slug, name, country, currency, timezone, platform_fee_bps) values ('greedy', 'Greedy', 'NZ', 'NZD', 'Pacific/Auckland', 9000)$$,
  'the platform fee cannot be set above 50%');
select pg_temp.check_fails('invalid',
  $$insert into public.markets (slug, name, country, currency, timezone) values ('Bad Slug', 'Bad', 'NZ', 'NZD', 'Pacific/Auckland')$$,
  'a market code must be lower-case with no spaces');
select pg_temp.check_fails('invalid',
  $$insert into public.users (name) values ('Nobody')$$,
  'a person needs an email or a mobile');
select pg_temp.check_fails('invalid',
  $$insert into public.users (name, email) values ('Shouty', 'UPPER@EXAMPLE.COM')$$,
  'emails are stored lower-case');
select pg_temp.check_fails('invalid',
  $$insert into public.users (name, phone) values ('Local', '021 123 4567')$$,
  'mobiles are stored in international format');

insert into public.users (id, name, email) values ('00000000-0000-4000-8000-0000000000a1', 'Olive', 'olive@check.test');
select pg_temp.check_fails('invalid',
  $$insert into public.users (name, email) values ('Copy', 'olive@check.test')$$,
  'two people cannot share an email');

-- 5. The audit log still cannot be changed (it was locked in Phase 0).
insert into public.audit_log (actor, action, entity) values ('check', 'check', 'check');
select pg_temp.check_fails('blocked', $$update public.audit_log set actor = 'x'$$, 'audit log rows cannot be changed');
select pg_temp.check_fails('blocked', $$delete from public.audit_log$$, 'audit log rows cannot be deleted');

rollback;
\o
\echo 'Product database checks passed.'
