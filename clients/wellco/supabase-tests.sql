-- =============================================================================
--  WELLCO PROJECT BRAIN  -  schema tests (v3, 17 Nov 2026)
--  LOCAL POSTGRES ONLY.  Never run this on Dan's live Supabase project: it
--  creates test users and fake projects.
-- =============================================================================
--
--  What it checks (the 16 Nov changes, plus the rules that must still hold):
--    1. A project created from each template gets 9 / 9 / 8 stages and the
--       template's tasks; stage 7 is Certification & Registration.
--    2. Rename a stage and insert a stage on a project (template untouched);
--       edit a template and a new project picks it up.
--    3. A split bill: two lines, GST-free + taxable, two cost categories.  Header
--       totals come from the lines; budget vs actual, BAS and the home summary
--       add up by line to the cent; the approval gate and line lock still work.
--    4. Funds needed before sign-off: total / paid / still to find.
--    5. A contact with two roles in different categories shows under both.
--    6. A deal with two documents (PDF + Excel) converts to a project and the
--       documents move with it (stage 1, renamed, logged); storage paths work.
--    7. Companies register: a project starts with no owner ("Dan Wellman and/or
--       nominee"), a newly registered company is assigned (logged, issued
--       documents switch to it), BAS by company for two companies in the same
--       quarter, a dormant company shows "nothing to lodge", a company closes.
--    8. Dan's 17 Nov feedback: zonings / document types he edits; Log a site
--       with split address, zoning, land and lot sizes, yield, purchase tax
--       type; Quick Feaso reproducing his spreadsheet to the cent (and a
--       second version at 28 lots); Make Offer from his term bank (several
--       offers, one accepted, letter layout); Create project carrying all of
--       it across; task dates that follow exchange / DA / another task, with
--       Dan's typed dates sticking and changes rippling down the chain, loops
--       refused; mobile numbers, role rename / delete, alphabetical contacts.
--    9. A second user sees zero of Dan's rows, in tables, views and storage.
--
--  HOW TO RUN (Postgres 16; psql as the postgres superuser):
--    createdb wellco_test
--    psql -d wellco_test -f standins.sql            -- the Supabase stand-ins below
--    psql -d wellco_test -v ON_ERROR_STOP=1 -f supabase-schema.sql
--    psql -d wellco_test -v ON_ERROR_STOP=1 -f supabase-tests.sql
--  Each check prints NOTICE: PASS ... or NOTICE: FAIL ...; the last lines show
--  the pass / fail count and the script errors (non-zero exit) if anything failed.
--
--  SUPABASE STAND-INS (save as standins.sql; a plain Postgres has no auth or
--  storage schema).  They mirror what Supabase provides: the anon /
--  authenticated / service_role roles, auth.uid() read from the JWT 'sub'
--  claim, auth.users, storage.buckets / storage.objects / storage.foldername(),
--  and Supabase's default grants on the public schema.
/*
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key, name text not null unique, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
*/
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\pset footer off
set client_min_messages = notice;

-- Test users.  dan = the real owner; other = a second login that must see nothing.
-- query results go nowhere; the PASS / FAIL notices are the output
\o /dev/null

\set dan   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set other 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- -----------------------------------------------------------------------------
-- 0. Test helpers (as postgres): a results table, ok() and expect_error().
-- -----------------------------------------------------------------------------
drop schema if exists wellco_test cascade;
create schema wellco_test;
create table wellco_test.results (n serial primary key, name text not null, ok boolean not null, detail text);

-- Record one check.  detail shows the actual value, handy when it fails.
create function wellco_test.ok(p_name text, p_ok boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into wellco_test.results (name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail);
  raise notice '% %', case when coalesce(p_ok, false) then 'PASS' else 'FAIL' end,
               p_name || coalesce('  [' || p_detail || ']', '');
end $$;

-- Run a statement that MUST fail (constraint, RLS, approval gate...).
create function wellco_test.expect_error(p_name text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform wellco_test.ok(p_name, true, 'blocked: ' || left(sqlerrm, 90));
    return;
  end;
  perform wellco_test.ok(p_name, false, 'statement was NOT blocked');
end $$;

grant usage on schema wellco_test to authenticated;
grant all on all tables in schema wellco_test to authenticated;
grant all on all sequences in schema wellco_test to authenticated;
grant execute on all functions in schema wellco_test to authenticated;

-- The two logins.  Creating them runs handle_new_user(), which seeds each
-- user's own project types, stage templates, contact categories / roles and
-- document types.
insert into auth.users (id, email) values
  (:'dan',   'dan@example.test'),
  (:'other', 'other@example.test');

select wellco_test.ok('seed: Dan has 3 project types',
  (select count(*) from public.project_types where owner_id = :'dan') = 3);
select wellco_test.ok('seed: Dan''s templates are land 9 / commercial 9 / residential 8',
  (select string_agg(project_type || '=' || n, ' ' order by project_type)
     from (select project_type, count(*) n from public.stage_templates where owner_id = :'dan' group by 1) x)
  = 'commercial_industrial=9 land_subdivision=9 residential_build=8',
  (select string_agg(project_type || '=' || n, ' ' order by project_type)
     from (select project_type, count(*) n from public.stage_templates where owner_id = :'dan' group by 1) x));
select wellco_test.ok('seed: 6 contact categories in order',
  (select string_agg(name, ', ' order by sort_order) from public.contact_categories where owner_id = :'dan')
  = 'Consultants, Civil contractors, Building contractors, Agents & advisers, Council & government, Banks & vendors');
select wellco_test.ok('seed: 12 document types',
  (select count(*) from public.document_types where owner_id = :'dan') = 12);
select wellco_test.ok('seed: seeding wrote nothing to the activity log',
  (select count(*) from public.activity_log) = 0);


-- =============================================================================
-- From here on we are Dan, logged in (role authenticated + his JWT), so every
-- statement goes through Row Level Security exactly as the app would.
-- =============================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', :'dan', false) \g /dev/null

-- -----------------------------------------------------------------------------
-- 1. Create a project from each template; check stage counts and contents.
-- -----------------------------------------------------------------------------
select public.create_project_from_template('CROOBYAR', 'Croobyar Rd, Milton', 'Lot 12 DP 1187234',
       'land_subdivision') \g /dev/null
select public.create_project_from_template('ULLADULLA-IND', 'Princes Hwy, Ulladulla', 'Lot 3 DP 1023344',
       'commercial_industrial') \g /dev/null
select public.create_project_from_template('HAWKEN-RES', 'Hawken Dr, Vincentia', 'Lot 5 DP 774411',
       'residential_build') \g /dev/null

select wellco_test.ok('1. land subdivision project has 9 stages',
  (select count(*) from public.project_stages where project_id = 'CROOBYAR') = 9);
select wellco_test.ok('1. commercial / industrial project has 9 stages',
  (select count(*) from public.project_stages where project_id = 'ULLADULLA-IND') = 9);
select wellco_test.ok('1. residential build project has 8 stages',
  (select count(*) from public.project_stages where project_id = 'HAWKEN-RES') = 8);
select wellco_test.ok('1. land stage 7 is Certification & Registration, then Sales, then Bonds',
  (select string_agg(name, ' | ' order by stage_no) from public.v_project_stages
    where project_id = 'CROOBYAR' and stage_no between 6 and 9)
  = 'Construction | Certification & Registration | Sales & Settlements | Bonds & Wind-up');
select wellco_test.ok('1. residential stages are the residential list',
  (select string_agg(name, ' | ' order by stage_no) from public.v_project_stages where project_id = 'HAWKEN-RES')
  = 'Sourcing | Feasibility | Acquisition & DD | Design & approvals | Construction | Certification & Occupation | Sales & Settlements | Wind-up',
  (select string_agg(name, ' | ' order by stage_no) from public.v_project_stages where project_id = 'HAWKEN-RES'));
select wellco_test.ok('1. template tasks copied (land 45, residential 35)',
  (select count(*) from public.tasks where project_id = 'CROOBYAR') = 45
  and (select count(*) from public.tasks where project_id = 'HAWKEN-RES') = 35,
  (select count(*) from public.tasks where project_id = 'CROOBYAR') || ' / ' ||
  (select count(*) from public.tasks where project_id = 'HAWKEN-RES'));
select wellco_test.ok('1. lead-time warning copied onto the electricity task',
  (select t.lead_time_days from public.tasks t where t.project_id = 'CROOBYAR'
    and t.title = 'Apply for electricity connection') = 90);
select wellco_test.ok('1. new project starts at stage 1 (Sourcing)',
  (select stage_no = 1 and stage_name = 'Sourcing' and stage_count = 9
     from public.v_project_summary where project_id = 'CROOBYAR'));
select wellco_test.ok('1. one summary log row per project, no per-task noise',
  (select count(*) from public.activity_log where action = 'project.stages_copied') = 3
  and (select count(*) from public.activity_log where entity_type in ('tasks', 'project_stages')) = 0);

-- -----------------------------------------------------------------------------
-- 2. Rename a stage and insert a stage (project only), then edit a template.
-- -----------------------------------------------------------------------------
update public.project_stages set name = 'Consultants & reports'
 where project_id = 'CROOBYAR' and stage_key = 'consultants';
select public.add_project_stage('CROOBYAR', 5, 'Pre-DA meeting') \g /dev/null

select wellco_test.ok('2. CROOBYAR now has 10 stages',
  (select count(*) from public.project_stages where project_id = 'CROOBYAR') = 10);
select wellco_test.ok('2. renamed stage 4 and inserted stage 5 sit in the right order',
  (select string_agg(stage_no || ' ' || name, ' | ' order by stage_no) from public.v_project_stages
    where project_id = 'CROOBYAR' and stage_no between 3 and 7)
  = '3 Acquisition & DD | 4 Consultants & reports | 5 Pre-DA meeting | 6 Development Approval | 7 Construction',
  (select string_agg(stage_no || ' ' || name, ' | ' order by stage_no) from public.v_project_stages
    where project_id = 'CROOBYAR' and stage_no between 3 and 7));
select wellco_test.ok('2. tasks stayed on their stages after the shift',
  (select count(*) from public.tasks t join public.project_stages ps on ps.id = t.stage_id
    where t.project_id = 'CROOBYAR' and ps.name = 'Development Approval') = 5);
select wellco_test.ok('2. the land template is untouched (still 9, still "Consultants")',
  (select count(*) from public.stage_templates where project_type = 'land_subdivision') = 9
  and exists (select 1 from public.stage_templates where project_type = 'land_subdivision' and name = 'Consultants'));
select wellco_test.ok('2. the rename is in the log',
  exists (select 1 from public.activity_log where entity_type = 'project_stages' and action = 'update'
           and details -> 'name' ->> 'to' = 'Consultants & reports'));

select public.add_template_stage('residential_build', 4, 'Pre-lodgement meeting') \g /dev/null
update public.stage_templates set name = 'Design & DA'
 where project_type = 'residential_build' and stage_key = 'approval';
select public.create_project_from_template('HAWKEN-2', 'Hawken Dr Lot 6, Vincentia', 'Lot 6 DP 774411',
       'residential_build') \g /dev/null
select wellco_test.ok('2. edited template: new residential project gets 9 stages incl. the new one',
  (select string_agg(name, ' | ' order by stage_no) from public.v_project_stages
    where project_id = 'HAWKEN-2' and stage_no between 3 and 5)
  = 'Acquisition & DD | Pre-lodgement meeting | Design & DA'
  and (select count(*) from public.project_stages where project_id = 'HAWKEN-2') = 9);
select wellco_test.ok('2. ...and the earlier residential project keeps its 8',
  (select count(*) from public.project_stages where project_id = 'HAWKEN-RES') = 8);
select wellco_test.expect_error('2. a stage with tasks cannot be deleted',
  $$delete from public.project_stages where project_id = 'CROOBYAR' and stage_key = 'sales'$$);

-- -----------------------------------------------------------------------------
-- 3. Split bill: council invoice, GST-free contributions (Council & Gov) +
--    taxable works on council infrastructure (Construction).
-- -----------------------------------------------------------------------------
insert into public.contacts (name, company) values ('Accounts', 'Shoalhaven City Council')
returning id as council_id \gset
insert into public.budget_lines (project_id, category, description, budget_ex_gst) values
  ('CROOBYAR', 'council_gov',  'Section 7.11 contributions', 600000),
  ('CROOBYAR', 'construction', 'Civil works',                900000);
insert into public.budget_lines (project_id, category, description, budget_ex_gst) values
  ('ULLADULLA-IND', 'construction', 'Civil & bulk earthworks', 400000)
returning id as other_project_budget_line \gset

-- the bill header: default category Council & Gov, no amounts (lines carry the money)
insert into public.invoices_in (project_id, contact_id, supplier_invoice_no, invoice_date, due_date,
                                description, default_category)
values ('CROOBYAR', :'council_id', 'SCC-88812', '2026-11-10', '2026-12-10',
        'Council: contributions and works on council infrastructure', 'council_gov')
returning id as bill_id \gset

-- line 1: no category given -> takes the header default (council_gov); GST-free -> $0 GST
insert into public.invoice_in_lines (invoice_id, line_no, description, gst_treatment, amount_ex_gst)
values (:'bill_id', 1, 'Section 7.11 contributions', 'gst_free', 500000.00);
-- line 2: its own category; taxable with no GST given -> 10% filled in
insert into public.invoice_in_lines (invoice_id, line_no, description, gst_treatment, amount_ex_gst, category)
values (:'bill_id', 2, 'Works on council infrastructure', 'taxable', 12000.00, 'construction');

select wellco_test.ok('3. header totals = sum of lines (512,000.00 + 1,200.00 GST = 513,200.00)',
  (select amount_ex_gst = 512000.00 and gst_amount = 1200.00 and total = 513200.00
     from public.invoices_in where id = :'bill_id'),
  (select amount_ex_gst || ' / ' || gst_amount || ' / ' || total from public.invoices_in where id = :'bill_id'));
select wellco_test.ok('3. line 1 took the header category, line 2 kept its own',
  (select string_agg(category::text || ':' || gst_treatment || ':' || gst_amount, ', ' order by line_no)
     from public.invoice_in_lines where invoice_id = :'bill_id')
  = 'council_gov:gst_free:0.00, construction:taxable:1200.00',
  (select string_agg(category::text || ':' || gst_treatment || ':' || gst_amount, ', ' order by line_no)
     from public.invoice_in_lines where invoice_id = :'bill_id'));
select wellco_test.ok('3. lines sit in the bill''s project automatically',
  (select bool_and(project_id = 'CROOBYAR') from public.invoice_in_lines where invoice_id = :'bill_id'));
select wellco_test.expect_error('3. a GST-free line cannot carry GST',
  format($$insert into public.invoice_in_lines (invoice_id, description, gst_treatment, amount_ex_gst, gst_amount)
           values (%L, 'Bad line', 'gst_free', 100, 10)$$, :'bill_id'));
select wellco_test.expect_error('3. a line cannot use another project''s budget line',
  format($$insert into public.invoice_in_lines (invoice_id, description, gst_treatment, amount_ex_gst, budget_line_id)
           values (%L, 'Wrong project', 'taxable', 100, %L)$$, :'bill_id', :'other_project_budget_line'));
select wellco_test.expect_error('3. approval gate: bill cannot be approved without Dan''s approval',
  format($$update public.invoices_in set status = 'approved' where id = %L$$, :'bill_id'));

-- Dan approves it
insert into public.approvals (project_id, kind, title, entity_type, entity_id, status)
values ('CROOBYAR', 'approve_invoice_in', 'Approve council bill SCC-88812', 'invoices_in', :'bill_id', 'approved');
update public.invoices_in set status = 'approved' where id = :'bill_id';

select wellco_test.expect_error('3. approved bill: its lines are locked',
  format($$insert into public.invoice_in_lines (invoice_id, description, gst_treatment, amount_ex_gst)
           values (%L, 'Sneaky extra', 'taxable', 99999)$$, :'bill_id'));
select wellco_test.ok('3. budget vs actual (approved): Council & Gov committed 500,000.00, Construction 12,000.00, nothing paid',
  (select string_agg(category::text || ' ' || committed_ex_gst || ' ' || paid_ex_gst, ', ' order by category)
     from public.v_budget_vs_actual where project_id = 'CROOBYAR')
  = 'council_gov 500000.00 0, construction 12000.00 0',
  (select string_agg(category::text || ' ' || committed_ex_gst || ' ' || paid_ex_gst, ', ' order by category)
     from public.v_budget_vs_actual where project_id = 'CROOBYAR'));
select wellco_test.ok('3. budget variance by category (600,000 - 500,000; 900,000 - 12,000)',
  (select string_agg(category::text || ' ' || variance_ex_gst, ', ' order by category)
     from public.v_budget_vs_actual where project_id = 'CROOBYAR')
  = 'council_gov 100000.00, construction 888000.00');
select wellco_test.ok('3. BAS (by project) FY2026-27 Q2: G11 513,200.00, 1B 1,200.00, GST-free spend 500,000.00, net GST -1,200.00',
  (select purchases_incl_gst_g11 = 513200.00 and gst_paid_1b = 1200.00 and gst_free_spend = 500000.00
          and input_taxed_spend = 0 and net_gst = -1200.00
     from public.v_bas_by_project where project_id = 'CROOBYAR' and period = 'FY2026-27 Q2'),
  (select purchases_incl_gst_g11 || ' / ' || gst_paid_1b || ' / ' || gst_free_spend || ' / ' || net_gst
     from public.v_bas_by_project where project_id = 'CROOBYAR' and period = 'FY2026-27 Q2'));

-- Dan pays it
update public.invoices_in set status = 'paid', paid_on = '2026-11-14' where id = :'bill_id';
select wellco_test.ok('3. budget vs actual (paid): paid 500,000.00 Council & Gov, 12,000.00 Construction',
  (select string_agg(category::text || ' ' || paid_ex_gst, ', ' order by category)
     from public.v_budget_vs_actual where project_id = 'CROOBYAR')
  = 'council_gov 500000.00, construction 12000.00');
select wellco_test.ok('3. home summary: committed 512,000.00, paid 512,000.00',
  (select committed_ex_gst = 512000.00 and paid_ex_gst = 512000.00
     from public.v_project_summary where project_id = 'CROOBYAR'));

-- Quick single-line bill: amounts on the header -> one line is made from them
insert into public.invoices_in (project_id, invoice_date, description, default_category, amount_ex_gst, gst_amount)
values ('CROOBYAR', '2026-11-12', 'Surveyor: set-out', 'consultants', 2000.00, 200.00)
returning id as quick_bill \gset
select wellco_test.ok('3. quick bill: one line created, header total 2,200.00',
  (select count(*) from public.invoice_in_lines where invoice_id = :'quick_bill') = 1
  and (select total from public.invoices_in where id = :'quick_bill') = 2200.00
  and (select category from public.invoice_in_lines where invoice_id = :'quick_bill') = 'consultants');

-- Sales side: a margin-scheme lot settlement, GST filled from the margin (1/11)
insert into public.invoices_out (project_id, invoice_no, lot_number, invoice_date, description)
values ('CROOBYAR', 'CROOBYAR-INV-001', '7', '2026-11-15', 'Lot 7 settlement')
returning id as sale_id \gset
insert into public.invoice_out_lines (invoice_id, description, amount_ex_gst, margin_amount)
values (:'sale_id', 'Lot 7 sale price', 450000.00, 220000.00);
select wellco_test.ok('3. sales line: margin scheme GST = 220,000 / 11 = 20,000.00; header follows',
  (select gst_amount = 20000.00 and margin_amount = 220000.00 and total = 470000.00
     from public.invoices_out where id = :'sale_id'),
  (select gst_amount || ' / ' || margin_amount || ' / ' || total from public.invoices_out where id = :'sale_id'));

-- -----------------------------------------------------------------------------
-- 4. Funds needed before sign-off (Certification & Registration).
-- -----------------------------------------------------------------------------
-- the contributions item points at the (now paid) bill line
insert into public.funds_needed (project_id, description, amount_ex_gst, invoice_in_line_id)
select 'CROOBYAR', 'Section 7.11 contributions', 500000.00, l.id
from public.invoice_in_lines l where l.invoice_id = :'bill_id' and l.line_no = 1;
insert into public.funds_needed (project_id, description, amount_ex_gst, due_date)
values ('CROOBYAR', 'Maintenance bond', 30000.00, '2027-02-01');
insert into public.funds_needed (project_id, description, amount_ex_gst, gst_treatment, category)
values ('CROOBYAR', 'Final certification inspections', 5000.00, 'taxable', 'consultants');

select wellco_test.ok('4. items default to the Certification & Registration stage',
  (select bool_and(stage_name = 'Certification & Registration') from public.v_funds_needed_items
    where project_id = 'CROOBYAR'));
select wellco_test.ok('4. funds needed: total 535,500.00, paid 500,000.00, still to find 35,500.00',
  (select total_needed = 535500.00 and paid = 500000.00 and still_to_find = 35500.00 and items_unpaid = 2
     from public.v_funds_needed where project_id = 'CROOBYAR'),
  (select total_needed || ' / ' || paid || ' / ' || still_to_find from public.v_funds_needed where project_id = 'CROOBYAR'));
select wellco_test.ok('4. not on "Needs you today" while the project is still at Sourcing',
  not exists (select 1 from public.v_needs_attention where item_type = 'funds_needed' and project_id = 'CROOBYAR'));
update public.projects set current_stage_id =
  (select id from public.project_stages where project_id = 'CROOBYAR' and stage_key = 'construction')
 where project_id = 'CROOBYAR';
select wellco_test.ok('4. on "Needs you today" once the project reaches Construction',
  exists (select 1 from public.v_needs_attention where item_type = 'funds_needed' and project_id = 'CROOBYAR'
           and title like '%$35,500.00 still to find'));
select wellco_test.ok('4. home summary carries funds still to find',
  (select funds_still_to_find from public.v_project_summary where project_id = 'CROOBYAR') = 35500.00);

-- -----------------------------------------------------------------------------
-- 5. Contacts: one contact, two roles in two categories.
-- -----------------------------------------------------------------------------
insert into public.contacts (name, company) values ('Mick Barrett', 'Coastal Civil Group Pty Ltd')
returning id as civil_id \gset
insert into public.contact_role_links (contact_id, role_id)
select :'civil_id', r.id from public.contact_roles r where r.name in ('Civil engineer', 'Civil contractor');

select wellco_test.ok('5. contact appears under both Consultants and Civil contractors',
  (select string_agg(category_name || ' (' || array_to_string(roles_in_category, ',') || ')', ', ' order by category_sort)
     from public.v_contacts_by_category where contact_id = :'civil_id')
  = 'Consultants (Civil engineer), Civil contractors (Civil contractor)',
  (select string_agg(category_name || ' (' || array_to_string(roles_in_category, ',') || ')', ', ' order by category_sort)
     from public.v_contacts_by_category where contact_id = :'civil_id'));
insert into public.contact_extra_categories (contact_id, category_id)
select :'civil_id', id from public.contact_categories where name = 'Building contractors';
select wellco_test.ok('5. extra category adds a third branch with no role',
  (select array_to_string(category_names, ', ') from public.v_contacts where id = :'civil_id')
  = 'Consultants, Civil contractors, Building contractors');
-- Dan adds a role and renames a category himself
insert into public.contact_roles (category_id, name, sort_order)
select id, 'Heritage consultant', 11 from public.contact_categories where name = 'Consultants';
update public.contact_categories set name = 'Civil & earthworks' where name = 'Civil contractors';
select wellco_test.ok('5. new role and renamed category show straight away',
  exists (select 1 from public.contact_roles where name = 'Heritage consultant')
  and exists (select 1 from public.v_contacts_by_category where contact_id = :'civil_id' and category_name = 'Civil & earthworks'));
select wellco_test.expect_error('5. a role in use cannot be deleted',
  $$delete from public.contact_roles where name = 'Civil engineer'$$);

-- -----------------------------------------------------------------------------
-- 6. Deal documents and deal -> project.
-- -----------------------------------------------------------------------------
insert into public.deals (street, suburb, state, postcode, lot_plan, project_type, source, feaso_result)
values ('88 Bells Rd', 'Jimboomba', 'QLD', '4280', 'Lot 2 SP 301887', 'land_subdivision', 'Ray White Logan', 'go')
returning id as deal_id \gset
insert into public.documents (deal_id, doc_type, party, original_name, doc_date) values
  (:'deal_id', 'contract',       'Ray White Logan', 'Contract of sale.pdf', '2026-11-16'),
  (:'deal_id', 'sales_evidence', 'Ray White Logan', 'Area sales Oct.XLSX',  '2026-11-16');

select wellco_test.ok('6. deal docs: Excel extension kept, deal naming and deals/<id>/ path',
  (select string_agg(file_ext || ' ' || standard_name || ' ' || (storage_path like 'deals/' || :'deal_id' || '/%')::text,
                     ' | ' order by doc_type)
     from public.documents where deal_id = :'deal_id')
  = 'pdf Deal-88BellsRdJimboomba_Contract_RayWhiteLogan_2026-11-16 true | xlsx Deal-88BellsRdJimboomba_SalesEvidence_RayWhiteLogan_2026-11-16 true',
  (select string_agg(file_ext || ' ' || standard_name, ' | ' order by doc_type) from public.documents where deal_id = :'deal_id'));
select wellco_test.expect_error('6. a document cannot belong to a deal AND a project',
  format($$insert into public.documents (deal_id, project_id, doc_type) values (%L, 'CROOBYAR', 'plans')$$, :'deal_id'));
select wellco_test.expect_error('6. a document must belong to a deal or a project',
  $$insert into public.documents (doc_type) values ('plans')$$);

-- the file itself, uploaded under deals/<deal_id>/
insert into storage.objects (bucket_id, name)
select 'project-documents', storage_path from public.documents where deal_id = :'deal_id';
select wellco_test.ok('6. storage: Dan can upload and read files under deals/<deal_id>/',
  (select count(*) from storage.objects where name like 'deals/%') = 2);

select public.convert_deal_to_project(:'deal_id', 'BELLS-RD') \g /dev/null

select wellco_test.ok('6. converted: no documents left on the deal',
  (select count(*) from public.documents where deal_id = :'deal_id') = 0);
select wellco_test.ok('6. both documents now on BELLS-RD, stage 1 (Sourcing), from the deal',
  (select count(*) from public.v_documents
    where project_id = 'BELLS-RD' and stage_position = 1 and stage_name = 'Sourcing'
      and source_deal_id = :'deal_id' and belongs_to = 'project') = 2);
select wellco_test.ok('6. documents renamed to the project naming',
  (select string_agg(standard_name, ' | ' order by doc_type) from public.documents where project_id = 'BELLS-RD')
  = 'BELLS-RD_Contract_RayWhiteLogan_2026-11-16 | BELLS-RD_SalesEvidence_RayWhiteLogan_2026-11-16',
  (select string_agg(standard_name, ' | ' order by doc_type) from public.documents where project_id = 'BELLS-RD'));
select wellco_test.ok('6. deal points at the project; Go deal starts at Acquisition & DD with stages 1-2 ticked',
  (select project_id from public.deals where id = :'deal_id') = 'BELLS-RD'
  and (select stage_name from public.v_project_summary where project_id = 'BELLS-RD') = 'Acquisition & DD'
  and (select count(*) from public.tasks where project_id = 'BELLS-RD' and done) = 6);
select wellco_test.ok('6. conversion logged once, with the documents listed',
  (select count(*) from public.activity_log where action = 'deal.converted' and project_id = 'BELLS-RD'
     and jsonb_array_length(details -> 'documents') = 2) = 1);
select wellco_test.ok('6. storage: files still readable after the move',
  (select count(*) from storage.objects where name like 'deals/' || :'deal_id' || '/%') = 2);
select wellco_test.expect_error('6. a deal cannot be converted twice',
  format($$select public.convert_deal_to_project(%L, 'BELLS-RD-2')$$, :'deal_id'));

-- Deleting a whole project still cascades cleanly (stages, tasks, current stage)
delete from public.projects where project_id = 'HAWKEN-2';
select wellco_test.ok('6. deleting a project removes its stages and tasks',
  (select count(*) from public.project_stages where project_id = 'HAWKEN-2') = 0
  and (select count(*) from public.tasks where project_id = 'HAWKEN-2') = 0);


-- -----------------------------------------------------------------------------
-- 7. Companies register: owner lifecycle and BAS per company.
--    CROOBYAR has the split bill (FY2026-27 Q2), the quick bill and a sale.
--    ULLADULLA-IND gets a bill in the same quarter under a second company.
-- -----------------------------------------------------------------------------
select wellco_test.ok('7. seed: Wellco Developments is in the register as project manager',
  (select count(*) from public.companies where is_project_manager and legal_name = 'Wellco Developments Pty Ltd') = 1);
select wellco_test.ok('7. a new project has no owner: issued documents read "Dan Wellman and/or nominee"',
  (select issuer_name = 'Dan Wellman and/or nominee' and is_interim from public.v_project_issuer where project_id = 'CROOBYAR'));
select wellco_test.ok('7. before assignment, BAS shows the unassigned line',
  (select company_name from public.v_bas_summary where period = 'FY2026-27 Q2')
  = 'Dan Wellman and/or nominee (no company assigned)');

-- Dan decides to proceed: the company is registered (about a day) and assigned
insert into public.companies (legal_name, short_name, abn, acn, registered_street, registered_suburb,
                              registered_state, registered_postcode, gst_registered,
                              gst_registered_from, bas_cycle, bank_name, bank_bsb, bank_account,
                              trust_name, status, formed_on)
values ('Croobyar Road Pty Ltd', 'Croobyar', '12 345 678 901', '345 678 901', '1 Main St', 'Milton', 'NSW', '2538', true,
        '2026-10-01', 'quarterly', 'CBA', '062-000', '1234', 'Wellman Family Trust', 'active', '2026-10-01')
returning id as co_croobyar \gset
insert into public.companies (legal_name, short_name, abn, gst_registered, gst_registered_from, bas_cycle, status, formed_on)
values ('Ulladulla Industrial Pty Ltd', 'Ulladulla', '98 765 432 109', true, '2026-10-01', 'quarterly', 'active', '2026-10-01')
returning id as co_ulladulla \gset
-- a third company sitting dormant through a long approval: not lodging yet
insert into public.companies (legal_name, short_name, status, formed_on)
values ('22 Peel Street Pty Ltd', 'Peel St', 'dormant', '2026-07-01')
returning id as co_peel \gset

update public.projects set owner_company_id = :'co_croobyar' where project_id = 'CROOBYAR';
update public.projects set owner_company_id = :'co_ulladulla' where project_id = 'ULLADULLA-IND';
update public.projects set owner_company_id = :'co_peel' where project_id = 'HAWKEN-RES';

select wellco_test.ok('7. assignment logged in plain English',
  exists (select 1 from public.activity_log where project_id = 'CROOBYAR' and action = 'project.company_assigned'
           and summary = 'Owner assigned: Dan Wellman and/or nominee -> Croobyar Road Pty Ltd. Transactions now sit with Croobyar Road Pty Ltd.'));
select wellco_test.ok('7. issued documents now read the company (name, ABN, bank)',
  (select issuer_name || ' | ' || abn || ' | ' || registered_address || ' | ' || bank_bsb || ' ' || bank_account || ' | ' || is_interim
     from public.v_project_issuer where project_id = 'CROOBYAR')
  = 'Croobyar Road Pty Ltd | 12 345 678 901 | 1 Main St, Milton NSW 2538 | 062-000 1234 | false');
select wellco_test.expect_error('7. Wellco (project manager) cannot own a project',
  $$update public.projects set owner_company_id = (select id from public.companies where is_project_manager)
     where project_id = 'BELLS-RD'$$);

-- second company's bill in the same quarter: $8,000 + GST, taxable consultants
insert into public.invoices_in (project_id, invoice_date, description, default_category, amount_ex_gst, gst_amount, status, paid_on)
values ('ULLADULLA-IND', '2026-11-03', 'Traffic report', 'consultants', 8000.00, 800.00, 'paid', '2026-11-05');

-- CROOBYAR company, FY2026-27 Q2: bills 513,200.00 + 2,200.00 (quick bill is draft, so not counted)
--   -> G11 513,200.00, 1B 1,200.00; sale not issued yet (draft) -> G1 0
select wellco_test.ok('7. BAS by company, Croobyar Road Pty Ltd, FY2026-27 Q2: G11 513,200.00, 1B 1,200.00, net -1,200.00',
  (select purchases_incl_gst_g11 = 513200.00 and gst_paid_1b = 1200.00 and net_gst = -1200.00
          and projects = array['CROOBYAR']
     from public.v_bas_summary where company_id = :'co_croobyar' and period = 'FY2026-27 Q2'),
  (select purchases_incl_gst_g11 || ' / ' || gst_paid_1b || ' / ' || net_gst
     from public.v_bas_summary where company_id = :'co_croobyar' and period = 'FY2026-27 Q2'));
select wellco_test.ok('7. BAS by company, Ulladulla Industrial Pty Ltd, same quarter: G11 8,800.00, 1B 800.00, net -800.00',
  (select purchases_incl_gst_g11 = 8800.00 and gst_paid_1b = 800.00 and net_gst = -800.00
     from public.v_bas_summary where company_id = :'co_ulladulla' and period = 'FY2026-27 Q2'));
select wellco_test.ok('7. exactly two company BAS rows for FY2026-27 Q2, none unassigned',
  (select count(*) from public.v_bas_summary where period = 'FY2026-27 Q2') = 2
  and not exists (select 1 from public.v_bas_summary where company_id is null));

-- issue the CROOBYAR sale (needs approval) -> G1 / 1A land on the Croobyar company's BAS
insert into public.approvals (project_id, kind, title, entity_type, entity_id, status)
values ('CROOBYAR', 'issue_invoice_out', 'Issue Lot 7 settlement invoice', 'invoices_out', :'sale_id', 'approved');
update public.invoices_out set status = 'issued' where id = :'sale_id';
select wellco_test.ok('7. issued margin-scheme sale: G1 470,000.00, 1A 20,000.00, net GST 18,800.00 for Croobyar Road',
  (select sales_incl_gst_g1 = 470000.00 and gst_collected_1a = 20000.00 and net_gst = 18800.00
     from public.v_bas_summary where company_id = :'co_croobyar' and period = 'FY2026-27 Q2'),
  (select sales_incl_gst_g1 || ' / ' || gst_collected_1a || ' / ' || net_gst
     from public.v_bas_summary where company_id = :'co_croobyar' and period = 'FY2026-27 Q2'));
select wellco_test.ok('7. quarter checklist: Croobyar and Ulladulla lodge, Peel St (dormant) has nothing to lodge',
  (select string_agg(company_name || '=' || to_do, ', ' order by company_name)
     from public.v_bas_company_quarters where period = 'FY2026-27 Q2')
  = '22 Peel Street Pty Ltd=nothing_to_lodge, Croobyar Road Pty Ltd=lodge, Ulladulla Industrial Pty Ltd=lodge',
  (select string_agg(company_name || '=' || to_do, ', ' order by company_name)
     from public.v_bas_company_quarters where period = 'FY2026-27 Q2'));
select wellco_test.ok('7. Peel St also listed for FY2026-27 Q1 (formed 1 Jul) with nothing to lodge',
  (select to_do from public.v_bas_company_quarters where company_id = :'co_peel' and period = 'FY2026-27 Q1')
  = 'nothing_to_lodge');

-- closing: refused while it owns a live project; fine once the project is closed
select wellco_test.expect_error('7. a company with a live project cannot be closed',
  format($$select public.close_company(%L)$$, :'co_ulladulla'));
update public.projects set status = 'closed', closed_on = '2027-03-31' where project_id = 'ULLADULLA-IND';
select public.close_company(:'co_ulladulla', '2027-03-31') \g /dev/null
select wellco_test.ok('7. company closed: status closed, closed_on set, no longer lodging, change logged',
  (select status = 'closed' and closed_on = '2027-03-31' and bas_cycle = 'not_lodging'
     from public.companies where id = :'co_ulladulla')
  and exists (select 1 from public.activity_log where entity_type = 'companies' and entity_id = :'co_ulladulla'
               and summary like '%status active -> closed%'));
select wellco_test.ok('7. closed company keeps its BAS history',
  exists (select 1 from public.v_bas_summary where company_id = :'co_ulladulla' and period = 'FY2026-27 Q2'));
select wellco_test.expect_error('7. a closed company cannot take on a project',
  format($$update public.projects set owner_company_id = %L where project_id = 'BELLS-RD'$$, :'co_ulladulla'));


-- =============================================================================
-- 8. Dan's feedback on draft 2 (17 Nov): Log a site fields, Quick Feaso,
--    Make Offer, everything flowing into the project, contacts, task dates
--    that follow each other, editable lists.
-- =============================================================================

-- 8a. Lists Dan maintains in Settings ---------------------------------------
select wellco_test.ok('8a. seed: zonings for NSW (14) and QLD (9)',
  (select count(*) filter (where state = 'NSW') = 14 and count(*) filter (where state = 'QLD') = 9 from public.zonings));
select wellco_test.ok('8a. seed: offer term bank from his Word template (deposit 6, DD 8, settlement 9, conditions 17, solicitor 1)',
  (select string_agg(field || '=' || n, ' ' order by field)
     from (select field::text, count(*) n from public.offer_terms group by 1) x)
  = 'condition=17 deposit=6 due_diligence=8 settlement=9 solicitor=1',
  (select string_agg(field || '=' || n, ' ' order by field)
     from (select field::text, count(*) n from public.offer_terms group by 1) x));
select wellco_test.ok('8a. term bank wording is his, word for word',
  (select wording from public.offer_terms where field = 'deposit' and sort_order = 1)
    = '$50,000 paid on contract exchange – refundable prior to satisfaction of DD. Balance to 5% upon satisfaction of DD.'
  and (select wording from public.offer_terms where field = 'due_diligence' and sort_order = 6)
    = '60 days from Contract exchange date, with one 30-day extension at the purchaser’s election.'
  and (select wording from public.offer_terms where field = 'condition' and sort_order = 3)
    = 'Vendor to provide signed “owners consent to lodge DA” as part of contract exchange documentation.');

insert into public.zonings (state, code, name, sort_order) values ('NSW', 'RU6', 'Transition', 15);
update public.zonings set name = 'Transition zone' where code = 'RU6';
select wellco_test.ok('8a. zoning: Dan can add and rename one',
  exists (select 1 from public.zonings where code = 'RU6' and name = 'Transition zone'));
delete from public.zonings where code = 'RU6';
select wellco_test.ok('8a. zoning: an unused one can be deleted',
  not exists (select 1 from public.zonings where code = 'RU6'));

insert into public.document_types (code, name, sort_order) values ('valuation', 'Valuation', 13);
update public.document_types set name = 'Bank valuation' where code = 'valuation';
select wellco_test.ok('8a. document type: added and renamed; the file-name code follows the name',
  (select file_code from public.document_types where code = 'valuation') = 'BankValuation');
delete from public.document_types where code = 'valuation';
select wellco_test.ok('8a. document type: an unused one can be deleted',
  not exists (select 1 from public.document_types where code = 'valuation'));
select wellco_test.expect_error('8a. document type: one in use cannot be deleted',
  $$delete from public.document_types where code = 'contract'$$);

-- 8b. Log a site with the new fields --------------------------------------------
insert into public.deals (street, suburb, state, postcode, lot_plan, project_type, zoning_id, land_area_m2,
                          min_lot_size_m2, yield_count, yield_unit, purchase_tax_type, asking_price,
                          source, feaso_result, notes)
select '21 Tynan Road', 'Tabletop', 'NSW', '2640', 'Lot 1 DP 1017395', 'land_subdivision', z.id, 120000,
       2000, 30, 'lots', 'gst_exempt', 800000, 'Off-market', 'go', 'Water main through the middle of the site'
from public.zonings z where z.code = 'R5'
returning id as tt_deal \gset

select wellco_test.ok('8b. deal address is split and shows as one line',
  (select address from public.deals where id = :'tt_deal') = '21 Tynan Road, Tabletop NSW 2640');
select wellco_test.expect_error('8b. postcode must be 4 digits',
  format($$update public.deals set postcode = '26401' where id = %L$$, :'tt_deal'));
select wellco_test.expect_error('8b. a zoning in use cannot be deleted',
  $$delete from public.zonings where code = 'R5'$$);
select wellco_test.ok('8b. deals list shows the zoning label',
  (select zoning_label from public.v_deals where id = :'tt_deal') = 'R5 Large Lot Residential');
-- original information stays editable on the deal
update public.deals set street = '21 Tynan Rd', notes = notes || '. Check easement width.' where id = :'tt_deal';
select wellco_test.ok('8b. deal address and notes can be edited after logging',
  (select address from public.deals where id = :'tt_deal') = '21 Tynan Rd, Tabletop NSW 2640');

-- 8c. Quick Feaso: his example, to the cent ----------------------------------
-- Only equity is given: lots (30) and land price ($800,000) come from the deal,
-- every other input is his sheet's figure, and a GST-exempt purchase means
-- margin scheme GST on the sales.
insert into public.deal_feasos (deal_id, equity, label) values (:'tt_deal', 800000, 'His example');

select wellco_test.ok('8c. feaso inputs filled from the deal (30 lots, $800,000 land, margin scheme)',
  (select lots = 30 and land_price = 800000 and sales_gst_method = 'margin_scheme' and version = 1
     from public.deal_feasos where deal_id = :'tt_deal'));
select wellco_test.ok('8c. net revenue 7,939,545.45',
  (select net_revenue from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1) = 7939545.45,
  (select net_revenue::text from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));
select wellco_test.ok('8c. revenue lines: 9,000,000.00 less agency 225,000.00, legal 90,000.00, margin GST 745,454.55',
  (select revenue = 9000000 and agency = 225000 and legal = 90000 and gst_on_sales = 745454.55
     from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));
select wellco_test.ok('8c. cost blocks: acquisition 845,000; construction 3,874,500; consultants 220,000; fees 760,000 (s94 on 29 lots)',
  (select acquisition = 845000 and total_construction = 3874500 and total_consultants = 220000
          and total_fees = 760000 and s94_lots = 29 and s94 = 580000
     from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));
select wellco_test.ok('8c. total cost 5,699,500.00',
  (select total_cost from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1) = 5699500.00);
select wellco_test.ok('8c. finance: land 3,600; construction 194,180; establishment 73,492.50; total 271,272.50',
  (select land_interest = 3600 and construction_interest = 194180 and establishment_fee = 73492.50
          and finance_costs = 271272.50
     from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));
select wellco_test.ok('8c. total cost inc finance 5,970,772.50',
  (select total_cost_inc_finance from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1) = 5970772.50);
select wellco_test.ok('8c. net profit 1,968,772.95',
  (select net_profit from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1) = 1968772.95,
  (select net_profit::text from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));
select wellco_test.ok('8c. margin on cost 0.3297',
  (select margin_on_cost from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1) = 0.3297);
select wellco_test.ok('8c. per-lot column matches his sheet (264,651.52 / 28,166.67 / 129,150.00 / 7,333.33 / 161,816.67 / 199,025.75 / 65,625.77)',
  (select net_revenue_per_lot = 264651.52 and acquisition_per_lot = 28166.67 and construction_per_lot = 129150.00
          and consultants_per_lot = 7333.33 and cost_to_complete_per_lot = 161816.67
          and total_cost_inc_finance_per_lot = 199025.75 and net_profit_per_lot = 65625.77
     from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));

-- a second version at 28 lots: his fixed 30s and 29 now follow the lot count
insert into public.deal_feasos (deal_id, equity, lots, label) values (:'tt_deal', 800000, 28, 'At 28 lots');
select wellco_test.ok('8c. version 2 at 28 lots: legal 84,000, s94 on 27 lots, per-lot on 28; v1 unchanged',
  (select version = 2 and is_latest and legal = 84000 and s94_lots = 27 and s94 = 540000
          and net_revenue_per_lot = round((9000000 / 30.0 * 28 - 0.025 * 8400000 - 84000 - (8400000 - 800000) / 11.0) / 28, 2)
     from public.v_deal_feasos where deal_id = :'tt_deal' and version = 2)
  and (select not is_latest and net_profit = 1968772.95 from public.v_deal_feasos where deal_id = :'tt_deal' and version = 1));

-- land bought WITH GST: the sales default to full GST (revenue / 11), not margin scheme
insert into public.deals (street, suburb, postcode, yield_count, asking_price, purchase_tax_type)
values ('5 Test St', 'Milton', '2538', 30, 800000, 'gst')
returning id as gst_deal \gset
insert into public.deal_feasos (deal_id) values (:'gst_deal');
select wellco_test.ok('8c. purchase with GST: full GST on sales, 9,000,000 / 11 = 818,181.82',
  (select sales_gst_method = 'full_gst' and gst_on_sales = 818181.82 from public.v_deal_feasos where deal_id = :'gst_deal'));
select wellco_test.expect_error('8c. a feaso needs at least one lot',
  format($$insert into public.deal_feasos (deal_id, lots) values (%L, 0)$$, :'gst_deal'));

-- 8d. Make Offer -----------------------------------------------------------------
insert into public.deal_offers (deal_id, price, gst_wording, deposit, due_diligence, settlement, conditions, solicitor, status, sent_on)
select :'tt_deal', 2000000,
       '+ GST (Contract noted no taxable supply -not made in the course or furtherance of an enterprise that the vendor carries on (section 9-5(b))',
       (select wording from public.offer_terms where field = 'deposit' and sort_order = 1),
       (select wording from public.offer_terms where field = 'due_diligence' and sort_order = 1),
       (select wording from public.offer_terms where field = 'settlement' and sort_order = 1),
       array[(select wording from public.offer_terms where field = 'condition' and sort_order = 1),
             (select wording from public.offer_terms where field = 'condition' and sort_order = 2),
             (select wording from public.offer_terms where field = 'condition' and sort_order = 5)],
       (select wording from public.offer_terms where field = 'solicitor' and sort_order = 1),
       'sent', '2026-11-17'
returning id as offer1 \gset

select wellco_test.ok('8d. offer 1: numbered per deal, property line from the deal, default purchaser',
  (select offer_no = 1 and property_text = E'21 Tynan Rd, Tabletop NSW 2640\n(Lot 1 DP 1017395)'
          and purchaser = 'Daniel Wellman or Nominee (TBC)'
     from public.deal_offers where id = :'offer1'),
  (select property_text from public.deal_offers where id = :'offer1'));
select wellco_test.ok('8d. letter layout: price line with GST wording, conditions numbered in order, signed by Dan',
  (select price_line = '$ 2,000,000 + GST (Contract noted no taxable supply -not made in the course or furtherance of an enterprise that the vendor carries on (section 9-5(b))'
          and conditions_numbered = E'1. Settlement is subject to receipt of satisfactory DA approval.\n2. Purchaser to have 7 days to review and advise of satisfaction of DA.\n3. Access to site for purchaser’s consultants post exchange'
          and signatory_name || ', ' || signatory_title || ', ' || signatory_company = 'Dan Wellman, Director, Wellco Developments PL'
          and letter_date = '2026-11-17'
     from public.v_offer_letters where offer_id = :'offer1'));

-- the vendor counters; Dan makes a second offer and it's accepted with an exchange date
update public.deal_offers set status = 'countered' where id = :'offer1';
insert into public.deal_offers (deal_id, price, gst_wording, deposit, due_diligence, settlement, status, accepted_on, exchange_on)
values (:'tt_deal', 1950000, '+ GST', '10% deposit on contract exchange – deposit bond acceptable to the vendor.',
        '60 days from contract exchange date.', '120 days from Contract Unconditional date', 'accepted', '2026-11-20', '2026-12-01')
returning id as offer2 \gset
select wellco_test.ok('8d. several offers per deal: offer 2 accepted, offer 1 countered',
  (select string_agg(offer_no || ':' || status, ', ' order by offer_no) from public.deal_offers where deal_id = :'tt_deal')
  = '1:countered, 2:accepted');
select wellco_test.expect_error('8d. only one accepted offer per deal',
  format($$update public.deal_offers set status = 'accepted', accepted_on = '2026-11-21' where id = %L$$, :'offer1'));
select wellco_test.expect_error('8d. an exchange date needs an accepted offer',
  format($$update public.deal_offers set exchange_on = '2026-12-01' where id = %L$$, :'offer1'));
select wellco_test.ok('8d. deals list shows offers, accepted price and latest feaso',
  (select offers = 2 and accepted_price = 1950000 and feaso_version = 2 from public.v_deals where id = :'tt_deal'));

-- 8e. Create project: everything flows across ------------------------------
select public.convert_deal_to_project(:'tt_deal', 'TABLETOP') \g /dev/null

select wellco_test.ok('8e. project has the deal''s street / suburb / state / postcode / lot-DP and name',
  (select name || ' | ' || address || ' | ' || lot_plan from public.projects where project_id = 'TABLETOP')
  = '21 Tynan Rd, Tabletop | 21 Tynan Rd, Tabletop NSW 2640 | Lot 1 DP 1017395',
  (select name || ' | ' || address || ' | ' || lot_plan from public.projects where project_id = 'TABLETOP'));
select wellco_test.ok('8e. site details copied: zoning, land 120,000 m2, min lot 2,000 m2, 30 lots, GST exempt, notes',
  (select z.code = 'R5' and p.land_area_m2 = 120000 and p.min_lot_size_m2 = 2000 and p.yield_count = 30
          and p.yield_unit = 'lots' and p.purchase_tax_type = 'gst_exempt'
          and p.notes = 'Water main through the middle of the site. Check easement width.'
     from public.projects p join public.zonings z on z.id = p.zoning_id where p.project_id = 'TABLETOP'));
select wellco_test.ok('8e. latest feaso (v2) linked; its total cost inc finance is the headline budget',
  (select p.feaso_id = vf.feaso_id and vf.version = 2 and p.budget = vf.total_cost_inc_finance
     from public.projects p join public.v_deal_feasos vf on vf.feaso_id = p.feaso_id where p.project_id = 'TABLETOP'));
select wellco_test.ok('8e. accepted offer linked: purchase price 1,950,000 and exchange 1 Dec 2026',
  (select accepted_offer_id = :'offer2' and purchase_price = 1950000 and exchange_on = '2026-12-01'
     from public.projects where project_id = 'TABLETOP'));
select wellco_test.ok('8e. log line mentions the feaso and the offer',
  exists (select 1 from public.activity_log where project_id = 'TABLETOP' and action = 'deal.converted'
           and summary like '%Quick Feaso v2 attached; accepted offer 2 attached'));
update public.projects set street = '21 Tynan Road', notes = notes || ' Easement 6m.' where project_id = 'TABLETOP';
select wellco_test.ok('8e. original information editable on the project too',
  (select address from public.projects where project_id = 'TABLETOP') = '21 Tynan Road, Tabletop NSW 2640');
select wellco_test.expect_error('8e. a deal that became a project cannot be deleted',
  format($$delete from public.deals where id = %L$$, :'tt_deal'));

-- 8f. Task dates that follow each other (Dan's DD -> settlement chain) -----------
\set dd_title 'Due diligence: title, contamination, services, flooding, bushfire'
select wellco_test.ok('8f. template carries default rules: DD 60 days after exchange; settlement 120 days after DD',
  (select tt.anchor_milestone = 'exchange' and tt.offset_days = 60
     from public.stage_template_tasks tt join public.stage_templates st on st.id = tt.stage_template_id
    where st.project_type = 'land_subdivision' and tt.title = :'dd_title')
  and (select dep.title = :'dd_title' and tt.offset_days = 120
     from public.stage_template_tasks tt
     join public.stage_templates st on st.id = tt.stage_template_id
     join public.stage_template_tasks dep on dep.id = tt.depends_on_template_task_id
    where st.project_type = 'land_subdivision' and tt.title = 'Settlement'));
select wellco_test.ok('8f. on the project, exchange 1 Dec 2026 set DD due 30 Jan 2027 and settlement 30 May 2027',
  (select string_agg(title || '=' || due_on, ' | ' order by sort_order) from public.tasks
    where project_id = 'TABLETOP' and title in (:'dd_title', 'Settlement'))
  = :'dd_title' || '=2027-01-30 | Settlement=2027-05-30',
  (select string_agg(title || '=' || coalesce(due_on::text, 'null'), ' | ' order by sort_order) from public.tasks
    where project_id = 'TABLETOP' and title in (:'dd_title', 'Settlement')));

-- Dan changes the DD date on the task itself (the solicitor ran two weeks late)
update public.tasks set due_on = '2027-02-15' where project_id = 'TABLETOP' and title = :'dd_title';
select wellco_test.ok('8f. typed DD date sticks (manual override) and settlement ripples to 15 Jun 2027',
  (select manual_override and due_on = '2027-02-15' from public.tasks where project_id = 'TABLETOP' and title = :'dd_title')
  and (select due_on from public.tasks where project_id = 'TABLETOP' and title = 'Settlement') = '2027-06-15');
update public.projects set exchange_on = '2026-12-15' where project_id = 'TABLETOP';
select wellco_test.ok('8f. moving exchange leaves the overridden DD (and so settlement) alone',
  (select due_on from public.tasks where project_id = 'TABLETOP' and title = :'dd_title') = '2027-02-15'
  and (select due_on from public.tasks where project_id = 'TABLETOP' and title = 'Settlement') = '2027-06-15');
update public.tasks set manual_override = false where project_id = 'TABLETOP' and title = :'dd_title';
select wellco_test.ok('8f. clearing the override: DD follows exchange again (13 Feb 2027) and settlement ripples (13 Jun 2027)',
  (select due_on from public.tasks where project_id = 'TABLETOP' and title = :'dd_title') = '2027-02-13'
  and (select due_on from public.tasks where project_id = 'TABLETOP' and title = 'Settlement') = '2027-06-13');
update public.projects set da_approval_on = '2027-03-01' where project_id = 'TABLETOP';
select wellco_test.ok('8f. DA approval date drives the electricity application (same day) and DA conditions review (+7)',
  (select string_agg(title || '=' || due_on, ' | ' order by title) from public.tasks
    where project_id = 'TABLETOP' and anchor_milestone = 'da_approval')
  = 'Apply for electricity connection=2027-03-01 | Review DA conditions and add tasks for them=2027-03-08');

-- a task that follows the DATE ANOTHER TASK WAS TICKED OFF
insert into public.tasks (project_id, stage_id, title, depends_on_task_id, anchor_on, offset_days)
select 'TABLETOP', t.stage_id, 'Send unconditional notice to vendor''s solicitor', t.id, 'done', 2
from public.tasks t where t.project_id = 'TABLETOP' and t.title = :'dd_title';
select wellco_test.ok('8f. "after it''s ticked off" task has no date until DD is done',
  (select due_on is null from public.tasks where project_id = 'TABLETOP' and title like 'Send unconditional notice%'));
update public.tasks set done = true where project_id = 'TABLETOP' and title = :'dd_title';
select wellco_test.ok('8f. ticking DD off dates it: done date + 2 days',
  (select due_on = public.today_syd() + 2 from public.tasks where project_id = 'TABLETOP' and title like 'Send unconditional notice%'));

select wellco_test.expect_error('8f. a loop is refused (DD cannot follow settlement, which follows DD)',
  $$update public.tasks set anchor_milestone = null,
        depends_on_task_id = (select id from public.tasks where project_id = 'TABLETOP' and title = 'Settlement')
     where project_id = 'TABLETOP' and title = 'Due diligence: title, contamination, services, flooding, bushfire'$$);
select wellco_test.expect_error('8f. a task follows a task OR a milestone, not both',
  $$update public.tasks set anchor_milestone = 'exchange' where project_id = 'TABLETOP' and title = 'Settlement'$$);
select wellco_test.expect_error('8f. a task cannot follow a task on another project',
  $$update public.tasks set depends_on_task_id = (select id from public.tasks where project_id = 'CROOBYAR' limit 1)
     where project_id = 'TABLETOP' and title = 'Settlement'$$);
update public.tasks set due_on = '2027-01-10' where project_id = 'TABLETOP' and title = 'Engage solicitor';
select wellco_test.ok('8f. a plain task''s due date is simply editable',
  (select due_on = '2027-01-10' and not manual_override from public.tasks where project_id = 'TABLETOP' and title = 'Engage solicitor'));

-- 8g. Contacts: mobile, roles renamed and deleted, alphabetical -------------------
insert into public.contact_roles (category_id, name, sort_order)
select id, 'Plasterer', 3 from public.contact_categories where name = 'Building contractors';
insert into public.contacts (name, company, phone, mobile) values ('Kev Doyle', 'Doyle Plastering', '02 4455 1234', '0412 345 678')
returning id as plasterer_id \gset
insert into public.contact_role_links (contact_id, role_id)
select :'plasterer_id', id from public.contact_roles where name = 'Plasterer';
select wellco_test.ok('8g. phone and mobile are separate',
  (select phone = '02 4455 1234' and mobile = '0412 345 678' from public.contacts where id = :'plasterer_id'));
update public.contact_roles set name = 'Plastering' where name = 'Plasterer';
select wellco_test.ok('8g. role renamed "Plasterer" -> "Plastering"; the contact follows',
  (select role_names from public.v_contacts where id = :'plasterer_id') = array['Plastering']);
select wellco_test.expect_error('8g. a role in use cannot be deleted without moving its contacts',
  $$select public.delete_contact_role((select id from public.contact_roles where name = 'Plastering'))$$);
select public.delete_contact_role((select id from public.contact_roles where name = 'Plastering'),
                                  (select id from public.contact_roles where name = 'Trades / subcontractor')) \g /dev/null
select wellco_test.ok('8g. role deleted after moving its contact to "Trades / subcontractor"',
  not exists (select 1 from public.contact_roles where name = 'Plastering')
  and (select role_names from public.v_contacts where id = :'plasterer_id') = array['Trades / subcontractor']);
insert into public.contact_roles (category_id, name)
select id, 'Pool builder' from public.contact_categories where name = 'Building contractors';
select public.delete_contact_role((select id from public.contact_roles where name = 'Pool builder')) \g /dev/null
select wellco_test.ok('8g. an unused role deletes straight away',
  not exists (select 1 from public.contact_roles where name = 'Pool builder'));
insert into public.contacts (name, company) values ('Amy Abbott', null), ('Zac', 'Zenith Planning');
select wellco_test.ok('8g. contacts list alphabetically (by company, else name; any case)',
  (select string_agg(coalesce(company, name), ' | ' order by sort_name, name) from public.v_contacts)
  = 'Amy Abbott | Coastal Civil Group Pty Ltd | Doyle Plastering | Shoalhaven City Council | Zenith Planning',
  (select string_agg(coalesce(company, name), ' | ' order by sort_name, name) from public.v_contacts));


-- =============================================================================
-- 9. A second login sees none of Dan's data.
-- =============================================================================
select set_config('request.jwt.claim.sub', :'other', false) \g /dev/null

-- every table with an owner_id: count the rows that are NOT this user's
do $$
declare
  t      text;
  n      bigint;
  total  bigint := 0;
  tables int := 0;
  seen   text := '';
begin
  for t in select c.table_name from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
           where c.table_schema = 'public' and c.column_name = 'owner_id' and tb.table_type = 'BASE TABLE'
           order by 1
  loop
    execute format('select count(*) from public.%I where owner_id is distinct from auth.uid()', t) into n;
    total := total + n; tables := tables + 1;
    if n > 0 then seen := seen || t || '=' || n || ' '; end if;
  end loop;
  perform wellco_test.ok(format('9. second user sees 0 of Dan''s rows across all %s tables', tables),
                         total = 0, nullif(seen, ''));
end $$;

select wellco_test.ok('9. second user: 0 projects, stages, tasks, documents, contacts, bills, bill lines, deals, log rows',
  (select count(*) from public.projects) + (select count(*) from public.project_stages)
  + (select count(*) from public.tasks) + (select count(*) from public.documents)
  + (select count(*) from public.contacts) + (select count(*) from public.invoices_in)
  + (select count(*) from public.invoice_in_lines) + (select count(*) from public.deals)
  + (select count(*) from public.activity_log) = 0);
select wellco_test.ok('9. second user: every view is empty',
  (select count(*) from public.v_project_summary) + (select count(*) from public.v_project_stages)
  + (select count(*) from public.v_bas_summary) + (select count(*) from public.v_bas_by_project)
  + (select count(*) from public.v_bas_company_quarters) + (select count(*) from public.v_project_issuer)
  + (select count(*) from public.v_budget_vs_actual)
  + (select count(*) from public.v_funds_needed) + (select count(*) from public.v_funds_needed_items)
  + (select count(*) from public.v_contacts) + (select count(*) from public.v_contacts_by_category)
  + (select count(*) from public.v_documents) + (select count(*) from public.v_needs_attention)
  + (select count(*) from public.v_rfq_status) + (select count(*) from public.v_engagement_progress)
  + (select count(*) from public.v_deal_feasos) + (select count(*) from public.v_offer_letters)
  + (select count(*) from public.v_deals) = 0);
select wellco_test.ok('9. second user: no files visible in storage',
  (select count(*) from storage.objects) = 0);
update public.projects set name = 'hijacked' where project_id = 'CROOBYAR';
select wellco_test.expect_error('9. second user cannot upload into Dan''s project folder',
  $$insert into storage.objects (bucket_id, name) values ('project-documents', 'CROOBYAR/contract/x.pdf')$$);
select wellco_test.expect_error('9. second user cannot upload into Dan''s deal folder',
  format($$insert into storage.objects (bucket_id, name) values ('project-documents', 'deals/%s/contract/x.pdf')$$, :'deal_id'));
select public.create_project_from_template('OTHER-1', 'Somewhere', 'Lot 1 DP 1') \g /dev/null
select wellco_test.ok('9. second user has their own defaults (9 stages from their own template)',
  (select count(*) from public.project_stages where project_id = 'OTHER-1') = 9);

-- back to Dan: his project name was not changed by the second user
select set_config('request.jwt.claim.sub', :'dan', false) \g /dev/null
select wellco_test.ok('9. Dan''s project untouched by the second user''s update',
  (select name from public.projects where project_id = 'CROOBYAR') = 'Croobyar Rd, Milton');
select wellco_test.ok('9. Dan sees none of the second user''s project',
  (select count(*) from public.projects where project_id = 'OTHER-1') = 0);


-- =============================================================================
-- RESULT
-- =============================================================================
reset role;
\o
\set QUIET off
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed, count(*) as checks
from wellco_test.results;
select n, name, detail from wellco_test.results where not ok order by n;
do $$ begin
  if exists (select 1 from wellco_test.results where not ok) then
    raise exception 'SOME TESTS FAILED (see FAIL lines above)';
  end if;
end $$;
