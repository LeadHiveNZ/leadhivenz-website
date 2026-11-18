-- =============================================================================
--  WELLCO PROJECT BRAIN  -  Supabase database schema  (v3, 17 Nov 2026)
--  Client : Wellco Developments Pty Ltd (Dan Wellman), Milton NSW
--  Built by: Joe Ingram, LeadHive
-- =============================================================================
--
--  HOW TO USE (Joe):
--    1. Create a fresh Supabase project (see README.md, "Option A").
--    2. Open  SQL Editor  ->  New query.
--    3. Paste this WHOLE file in and press  Run.  It takes a few seconds.
--    4. You should see "Success. No rows returned".  If you get an error,
--       nothing is half-applied: PART 1 and PART 2 each run as one transaction
--       and roll back on error.  Copy the error to Claude and fix, then re-run
--       on a fresh project (this script is written to run ONCE per project).
--    5. Create Dan's login (README step A5).  His default stage templates,
--       contact categories / roles, project types and document types are
--       created for him automatically at that moment (see seed_owner_defaults).
--
--  WHAT'S IN HERE:
--    PART 1  Database: helpers, enums, lookups, tables, triggers, functions,
--            views, security (RLS)
--    PART 2  Storage: the private "project-documents" bucket + its access rules
--
--  THE BIG RULES THIS SCHEMA ENFORCES (so the app can't get them wrong):
--    * One owner (Dan).  Every row carries owner_id; Row Level Security means a
--      logged-in user only ever sees rows where owner_id = their user id.
--    * Projects never mix.  Stages, tasks, quotes, engagements, invoices, bill
--      lines, budget lines, funds needed and documents are tied to ONE project,
--      and links between them are checked so a Croobyar invoice can never point
--      at an Ulladulla engagement or stage.
--      Only Projects, Contacts, Deals and Dan's own lists (templates, roles,
--      categories, types) are shared registers.
--    * Every project is owned by its own company (companies register).  Quote
--      requests, engagements and invoices are issued in that company's name
--      (v_project_issuer) and BAS is worked out per company per quarter.
--    * Every money LINE has a GST treatment: taxable / gst_free / input_taxed /
--      margin_scheme (sales only).  GST-free and input-taxed lines must carry $0 GST.
--    * Every bill line has its own cost category ("a bit like Xero").  Budget vs
--      actual, BAS, funds needed and the home screen all add up by LINE.  The
--      bill header totals are worked out from its lines automatically.
--    * Financial year and BAS quarter are worked out automatically from the
--      invoice date (AU FY = 1 Jul - 30 Jun, e.g. 'FY2025-26', quarters Q1-Q4).
--    * Nothing is sent, issued or paid without Dan's approval: moving an RFQ to
--      'sent', an engagement to 'issued', an invoice-in to 'approved'/'paid', or
--      an invoice-out to 'issued' is blocked unless an approved approval exists.
--      Once a bill is approved its lines are locked, so the amount Dan approved
--      can't change underneath him.
--    * Every insert / change / delete on the main tables is written to
--      activity_log automatically (the per-project "Log" tab).
--
--  MONEY CONVENTION: all budget / committed / paid figures are EX GST (each
--  project company is GST registered, so GST is not a cost).  GST sits in its
--  own column and only matters for BAS.  Funds needed before sign-off is the
--  one exception: it shows cash (incl GST) as well, because it's money to find.
--
--  CHANGES IN v2 (setup call with Dan, 16 Nov 2026, see changes-2026-11-16.md):
--    1. Stages are data, not a fixed 1-8 list.  stage_templates (per project
--       type, editable by Dan) + stage_template_tasks are copied into
--       project_stages + tasks when a project is created.  New default stage 7
--       "Certification & Registration" (9 stages for land and commercial).
--    2. project_type is a lookup table (project_types) and gains Residential
--       build (8 stages, its own template).
--    3. Contact roles and categories are data: contact_categories,
--       contact_roles, contact_role_links, contact_extra_categories.  The old
--       contacts.roles enum array is gone.
--    4. Bills and sales invoices have lines (invoice_in_lines, invoice_out_lines)
--       with their own GST treatment AND cost category.  Headers keep a default.
--    5. funds_needed: the end-of-job money that must be paid before sign-off,
--       tied to the Certification stage, with v_funds_needed (total / paid /
--       still to find).
--    6. Documents can belong to a deal OR a project; convert_deal_to_project()
--       brings them across.  Document types are a lookup; any file type allowed.
--    7. companies register (end of the call): each project company with its
--       ABN, ACN, address, GST, BAS cycle, bank and lifecycle (to be formed ->
--       active -> dormant -> closed).  The company columns moved off projects;
--       projects.owner_company_id is blank while the offer is in "Dan Wellman
--       and/or nominee".  v_bas_summary is now per company per quarter, and
--       v_bas_company_quarters lists companies with nothing to lodge.
--
--  CHANGES IN v3 (Dan's feedback on draft 2, 17 Nov 2026, see changes-2026-11-17.md):
--    8. Addresses are street / suburb / state / postcode on deals, projects and
--       companies (address is a generated display column); lot_plan kept.
--    9. Deals capture zoning (zonings list Dan edits), land area, minimum lot
--       size, yield (lots / factory units / units) and purchase tax type, and
--       all of it carries into the project on convert, with the notes, the
--       documents, the latest feaso and the accepted offer.
--   10. Quick Feaso: deal_feasos (versioned per deal, his spreadsheet's inputs)
--       + v_deal_feasos (his outputs, worked exactly as his sheet does).
--   11. Make Offer: deal_offers (several per deal, one accepted) + offer_terms
--       (his term bank, seeded from his Word template) + v_offer_letters.
--   12. Contacts have a mobile; roles can be renamed and deleted (moving any
--       contacts to another role first: delete_contact_role()).
--   13. Task due dates (due_on) are editable, and can follow another task or a
--       project milestone (exchange, DD expiry, unconditional, DA approval,
--       settlement) by N days; changes ripple to the tasks that follow.
--   14. Document types and zonings are per-user lists: add, rename, delete if unused.
--   18 Nov addendum: Quick Feaso finance has land / construction loan months
--       (interest = debt x rate x months / 12; 12 = his sheet); offers are
--       generated as PDF (letter_format, default pdf) and filed with
--       file_offer_letter() under the new "Letter of offer" document type.
--  Each version replaces the last outright: nothing has been loaded into Dan's
--  Supabase yet, so there is no data migration, just run this on a fresh project.
-- =============================================================================


-- #############################################################################
-- PART 1  -  DATABASE
-- #############################################################################
begin;

-- -----------------------------------------------------------------------------
-- 1.1  Helper functions (dates, financial year, BAS quarter)
-- -----------------------------------------------------------------------------

-- "Today" in Dan's time zone.  Supabase servers run on UTC, which is a day
-- behind Sydney before 10-11am.  Use this instead of current_date.
create or replace function public.today_syd()
returns date
language sql stable
as $$ select (now() at time zone 'Australia/Sydney')::date $$;

-- Australian financial year label for a date.  1 Jul 2025 - 30 Jun 2026 => 'FY2025-26'
create or replace function public.au_fy(d date)
returns text
language sql immutable parallel safe
as $$
  select case
    when d is null then null
    when extract(month from d) >= 7 then
      'FY' || extract(year from d)::int || '-' ||
      lpad(((extract(year from d)::int + 1) % 100)::text, 2, '0')
    else
      'FY' || (extract(year from d)::int - 1) || '-' ||
      lpad((extract(year from d)::int % 100)::text, 2, '0')
  end
$$;

-- BAS quarter within the AU financial year.
-- Q1 = Jul-Sep, Q2 = Oct-Dec, Q3 = Jan-Mar, Q4 = Apr-Jun
create or replace function public.au_bas_quarter(d date)
returns text
language sql immutable parallel safe
as $$
  select case
    when d is null then null
    when extract(month from d) between 7 and 9  then 'Q1'
    when extract(month from d) between 10 and 12 then 'Q2'
    when extract(month from d) between 1 and 3  then 'Q3'
    else 'Q4'
  end
$$;

-- First day of the calendar quarter a date falls in (used to sort BAS periods).
create or replace function public.au_quarter_start(d date)
returns date
language sql immutable parallel safe
as $$
  select make_date(extract(year from d)::int,
                   ((extract(month from d)::int - 1) / 3) * 3 + 1,
                   1)
$$;


-- -----------------------------------------------------------------------------
-- 1.2  Enums (fixed pick-lists that only change with the law or the accountant).
--      To add a value later:   alter type public.au_state add value 'VIC';
--      Anything Dan should be able to change himself (project types, stages,
--      contact roles and categories, document types) is a TABLE instead (1.3).
-- -----------------------------------------------------------------------------
create type public.au_state          as enum ('NSW', 'QLD');   -- add more states with ALTER TYPE if Wellco goes further afield
create type public.project_status    as enum ('live', 'closed');
create type public.feaso_result      as enum ('pending', 'go', 'no_go');
create type public.company_status    as enum ('to_be_formed', 'active', 'dormant', 'closed');
create type public.bas_cycle         as enum ('quarterly', 'not_lodging');   -- add 'monthly' with ALTER TYPE if ever needed
create type public.yield_unit        as enum ('lots', 'factory_units', 'units');
create type public.purchase_tax_type as enum ('gst', 'margin_scheme', 'gst_exempt');   -- how the LAND purchase is taxed (from the contract)
create type public.sales_gst_method  as enum ('margin_scheme', 'full_gst', 'none');    -- Quick Feaso: GST on the lot sales
create type public.offer_status      as enum ('draft', 'sent', 'countered', 'accepted', 'declined', 'withdrawn');
create type public.letter_format     as enum ('pdf', 'docx');   -- generated letter of offer (PDF unless Dan asks for Word)
create type public.offer_term_field  as enum ('deposit', 'due_diligence', 'settlement', 'condition', 'solicitor');
create type public.task_milestone    as enum ('exchange', 'dd_expiry', 'unconditional', 'da_approval', 'settlement');
create type public.task_anchor       as enum ('due', 'done');   -- follow the other task's due date, or the date it was ticked off

create type public.gst_treatment as enum (
  'taxable',        -- standard 10% GST (most consultants and contractors)
  'gst_free',       -- no GST: council contributions & fees, state govt fees, stamp duty,
                    --   LRS / lands registration, land bought from a non-registered vendor
  'input_taxed',    -- no GST and no GST credit (e.g. some finance charges, residential rent)
  'margin_scheme'   -- SALES ONLY: GST is 1/11 of the margin, not of the price
);

create type public.budget_category as enum (
  'acquisition',     -- land price, stamp duty, legals, DD
  'holding',         -- rates, land tax, interest, insurance
  'consultants',     -- planner, surveyor, engineers, ecology, bushfire...
  'council_gov',     -- DA fees, contributions, bonds, LRS registration, utility authority fees
  'construction',    -- civils, electrical, NBN, landscaping, builders
  'sales',           -- agents' commission, marketing, sales legals
  'management_fee'   -- Wellco Developments' project management fee
);

create type public.rfq_status        as enum ('draft', 'sent', 'appointed', 'cancelled');
create type public.quote_status      as enum ('requested', 'received', 'declined', 'withdrawn');
create type public.engagement_kind   as enum ('engagement_letter', 'purchase_order', 'contract');
create type public.engagement_status as enum ('draft', 'awaiting_approval', 'issued', 'complete', 'cancelled');
create type public.invoice_in_status as enum ('draft', 'approved', 'paid');
create type public.invoice_out_status as enum ('draft', 'awaiting_approval', 'issued', 'paid', 'void');
create type public.invoice_out_kind  as enum ('lot_deposit', 'lot_settlement', 'unit_sale', 'other');

-- Flags the accountant needs at year end (shown on the Tax Summary tab).
create type public.money_flag as enum ('intercompany_loan', 'distribution_to_trust', 'management_fee');

create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- One-line address for display, documents and file names:
--   '21 Tynan Road, Tabletop NSW 2640'
create or replace function public.format_address(p_street text, p_suburb text, p_state public.au_state, p_postcode text)
returns text
language sql immutable parallel safe
as $$
  select nullif(concat_ws(', ', nullif(trim(p_street), ''),
                          nullif(trim(concat_ws(' ', nullif(trim(p_suburb), ''), p_state::text, nullif(trim(p_postcode), ''))), '')), '')
$$;
create type public.approval_kind as enum (
  'send_rfq', 'chase_quote', 'issue_engagement', 'approve_invoice_in',
  'pay_invoice_in', 'issue_invoice_out', 'send_email', 'other'
);


-- -----------------------------------------------------------------------------
-- 1.3  Tables
--      owner_id defaults to the logged-in user, so the app never has to send it.
--      (If you insert rows by hand in the SQL editor you are NOT logged in, so
--       pass owner_id explicitly: select id from auth.users;)
-- -----------------------------------------------------------------------------

-- Wellco's own details: one row per owner (created automatically at sign-up).
create table public.wellco_settings (
  owner_id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  company_name             text not null default 'Wellco Developments Pty Ltd',
  abn                      text,
  acn                      text,
  address                  text,
  trust_name               text,                      -- the trust that holds every project company
  management_fee_basis     text,                      -- e.g. '% of costs', 'fixed per project', 'TBC with accountant'
  gmail_address            text,
  email_signature          text,
  onedrive_backup_folder   text default '/Wellco/Project Brain backups',
  last_document_backup_at  timestamptz,               -- written by the nightly backup job
  last_workbook_export_at  timestamptz,               -- written by the weekly Excel export job
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.wellco_settings is 'Wellco Developments details, trust, fee basis, email signature and backup status. One row.';

-- ---- Dan's own lists (editable from Settings, seeded at sign-up) -----------

-- PROJECT TYPES.  A lookup table, not an enum, on purpose: with an enum, adding
-- "Residential build" meant Joe running ALTER TYPE in the SQL editor (and enum
-- values can't be renamed or removed cleanly).  As a table, Dan adds a type in
-- Settings, names it how he likes, and gives it its own default stage template.
-- Projects store the short code (e.g. 'residential_build'); the name can change.
create table public.project_types (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code        text not null check (code ~ '^[a-z][a-z0-9_]{1,39}$'),   -- app makes it from the name
  name        text not null check (trim(name) <> ''),                  -- 'Residential build'
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, code),
  unique (owner_id, name)
);
comment on table public.project_types is 'Project types (Land subdivision, Commercial / industrial, Residential build...). Dan can add more.';

-- STAGE TEMPLATES: the default stage list for each project type, in order.
-- Dan can rename, add (add_template_stage) or reorder stages here.  Changes
-- apply to NEW projects; existing projects keep their own copy (project_stages).
-- stage_key is a fixed tag ('certification', 'acquisition'...) that survives a
-- rename, so the app can still find "the Certification stage" if Dan calls it
-- something else.  Stages Dan adds himself have no key.
create table public.stage_templates (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_type  text not null,
  position      smallint not null check (position >= 1),
  name          text not null check (trim(name) <> ''),
  description   text,
  stage_key     text check (stage_key ~ '^[a-z_]{2,40}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (owner_id, project_type) references public.project_types (owner_id, code)
    on update cascade on delete cascade,
  -- deferrable so "insert a stage at 4" can shift 4..9 up by one in one go
  constraint stage_templates_position_uq unique (owner_id, project_type, position) deferrable initially immediate
);
comment on table public.stage_templates is 'Default stage list per project type, copied into project_stages when a project is created. Editable by Dan.';

-- The default checklist for each template stage (copied into tasks).
create table public.stage_template_tasks (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stage_template_id  uuid not null references public.stage_templates (id) on delete cascade,
  title              text not null check (trim(title) <> ''),
  notes              text,
  lead_time_days     integer check (lead_time_days >= 0),
  warning            text,
  sort_order         integer not null default 0,
  -- default date rule, copied onto the project task (see tasks)
  depends_on_template_task_id  uuid references public.stage_template_tasks (id) on delete set null,
  anchor_milestone   public.task_milestone,
  anchor_on          public.task_anchor not null default 'due',
  offset_days        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint stage_template_tasks_one_anchor check (depends_on_template_task_id is null or anchor_milestone is null),
  constraint stage_template_tasks_not_self   check (depends_on_template_task_id is distinct from id)
);
comment on table public.stage_template_tasks is 'Default checklist items per template stage. Dan can add or reword them.';

-- CONTACT CATEGORIES (the "branches" on the Contacts screen): Consultants,
-- Civil contractors, Building contractors, Agents & advisers...
create table public.contact_categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (trim(name) <> ''),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id)
);
comment on table public.contact_categories is 'Contact groups, ordered and renamable. A contact shows under the category of each of its roles, plus any extra categories.';

-- CONTACT ROLES: each sits in one category; Dan can add, rename or move them.
create table public.contact_roles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id  uuid not null,
  name         text not null check (trim(name) <> ''),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, name),
  unique (id, owner_id),
  -- a category with roles in it can't be deleted: move the roles first
  foreign key (category_id, owner_id) references public.contact_categories (id, owner_id)
);
comment on table public.contact_roles is 'Contact roles (Town planner, Civil contractor, Bank...). Each belongs to one category.';

-- DOCUMENT TYPES: Contract, Plans, Sales evidence...  file_code is the bit used
-- in the standard file name (made from the name: 'Sales evidence' -> 'SalesEvidence').
create table public.document_types (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code        text not null check (code ~ '^[a-z][a-z0-9_]{1,39}$'),   -- also the storage folder name
  name        text not null check (trim(name) <> ''),
  file_code   text generated always as (left(regexp_replace(initcap(name), '[^A-Za-z0-9]+', '', 'g'), 30)) stored,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, code),
  unique (owner_id, name)
);
comment on table public.document_types is 'Document types for filing (Contract, Plans, Sales evidence, Bill...). Dan can add, rename, and delete unused ones.';

-- ZONINGS: the zoning pick-list on "Log a site" (Settings: add, edit, delete
-- if unused).  NSW zones have a code (R2, RU4, E4...); QLD scheme zones mostly don't.
create table public.zonings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  state       public.au_state,                       -- null = any state
  code        text,                                  -- 'R2'
  name        text not null check (trim(name) <> ''),-- 'Low Density Residential'
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (owner_id, state, name),
  unique (id, owner_id)
);
comment on table public.zonings is 'Zoning pick-list for deals and projects. Dan''s own list, seeded with common NSW and QLD zones.';

-- OFFER TERMS: the term bank behind Make Offer (page 2 of Dan's Word letter of
-- offer), one row per option, by field.  Seeded with his exact wording.
create table public.offer_terms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  field       public.offer_term_field not null,
  wording     text not null check (trim(wording) <> ''),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, field, wording)
);
comment on table public.offer_terms is 'Term bank for letters of offer (deposit, due diligence, settlement, conditions, solicitor). Dan adds his own.';

-- ---- Registers -------------------------------------------------------------

-- Shared CONTACTS register (shared across projects).  Roles and categories are
-- in contact_role_links / contact_extra_categories (many to many).
create table public.contacts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,                     -- person
  company           text,                              -- business name
  email             text,
  phone             text,                              -- landline / office
  mobile            text,
  abn               text check (abn is null or regexp_replace(abn, '\s', '', 'g') ~ '^\d{11}$'),
  licence_number    text,
  licence_expiry    date,
  insurance_expiry  date,                              -- public liability / PI
  rating            smallint check (rating between 1 and 5),
  notes             text,                              -- performance notes: "good on price, slow on paperwork"
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, owner_id)
);
comment on table public.contacts is 'Shared register of every party: consultants, contractors, agents, solicitors, council, banks.';

-- A contact can have any number of roles (e.g. Civil engineer AND Civil contractor).
create table public.contact_role_links (
  contact_id  uuid not null,
  role_id     uuid not null,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (contact_id, role_id),
  foreign key (contact_id, owner_id) references public.contacts (id, owner_id) on delete cascade,
  foreign key (role_id, owner_id)    references public.contact_roles (id, owner_id)   -- delete a role only once no contact uses it
);
comment on table public.contact_role_links is 'Contact <-> role (many to many).';

-- Put a contact in a category without giving it a role there
-- ("sometimes I have consultants that sit in two categories").
create table public.contact_extra_categories (
  contact_id   uuid not null,
  category_id  uuid not null,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (contact_id, category_id),
  foreign key (contact_id, owner_id)  references public.contacts (id, owner_id) on delete cascade,
  foreign key (category_id, owner_id) references public.contact_categories (id, owner_id) on delete cascade
);
comment on table public.contact_extra_categories is 'Contact <-> extra category (many to many), on top of the categories its roles give it.';

-- COMPANIES: Dan's own companies ("the principals").  Each project is owned by
-- a company registered for it (often named after the site, e.g. '22 Peel Street
-- Pty Ltd'); a company normally owns one project but can own more.  Wellco
-- Developments Pty Ltd itself is in here too, flagged is_project_manager (it
-- charges the management fee; it doesn't own projects and stays on Xero).
-- Lifecycle: offer goes in "Dan Wellman and/or nominee" (project has no company
-- yet) -> company registered, status to_be_formed / active, assigned to the
-- project (logged) -> dormant while nothing is happening (no BAS) -> closed
-- once the bonds come back (close_company()).
-- Everything issued for a project (RFQs, engagements, POs, invoices) reads its
-- name, ABN, address and bank from here via v_project_issuer.
create table public.companies (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legal_name           text not null check (trim(legal_name) <> ''),   -- '22 Peel Street Pty Ltd'
  short_name           text,                                           -- 'Peel St'
  abn                  text check (abn is null or regexp_replace(abn, '\s', '', 'g') ~ '^\d{11}$'),
  acn                  text check (acn is null or regexp_replace(acn, '\s', '', 'g') ~ '^\d{9}$'),
  registered_street    text,
  registered_suburb    text,
  registered_state     public.au_state,
  registered_postcode  text check (registered_postcode is null or registered_postcode ~ '^\d{4}$'),
  registered_address   text generated always as
                       (public.format_address(registered_street, registered_suburb, registered_state, registered_postcode)) stored,
  gst_registered       boolean not null default false,
  gst_registered_from  date,
  bas_cycle            public.bas_cycle not null default 'not_lodging',  -- 'quarterly' once it starts lodging
  bank_name            text,
  bank_bsb             text,
  bank_account         text,                                           -- tip: store last 4 digits only if you prefer
  trust_name           text,                                           -- shareholder (the trust)
  status               public.company_status not null default 'to_be_formed',
  formed_on            date,
  closed_on            date,
  is_project_manager   boolean not null default false,                 -- true for Wellco Developments Pty Ltd only
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (owner_id, legal_name),
  unique (id, owner_id),
  constraint companies_closed_has_date check (status <> 'closed' or closed_on is not null),
  constraint companies_gst_date        check (gst_registered or gst_registered_from is null)
);
comment on table public.companies is 'Register of Dan''s companies: one per project (plus Wellco itself). Issued documents and BAS read the owner from here.';

-- The PROJECTS register. One row = one project, owned by one company.
-- Creating a project copies its type's stage template into project_stages and
-- tasks automatically (trigger projects_copy_stage_template, section 1.5 h).
create table public.projects (
  project_id           text primary key
                       check (project_id ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),  -- e.g. 'CROOBYAR', 'ULLADULLA-IND'
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                 text not null,                  -- 'Croobyar Rd, Milton'
  street               text,                           -- '21 Tynan Road'
  suburb               text,
  state                public.au_state not null default 'NSW',
  postcode             text check (postcode is null or postcode ~ '^\d{4}$'),
  address              text generated always as (public.format_address(street, suburb, state, postcode)) stored,
  lot_plan             text not null,                  -- 'Lot 12 DP 1187234' (NSW) or 'Lot 2 SP 301887' (QLD)
  project_type         text not null default 'land_subdivision',
  description          text,                           -- '14-lot residential subdivision'
  -- the site (carried over from the deal; editable)
  zoning_id            uuid,
  land_area_m2         numeric(12,2) check (land_area_m2 >= 0),
  min_lot_size_m2      numeric(12,2) check (min_lot_size_m2 >= 0),
  yield_count          integer check (yield_count >= 0),
  yield_unit           public.yield_unit not null default 'lots',
  purchase_tax_type    public.purchase_tax_type,
  purchase_price       numeric(14,2) check (purchase_price >= 0),   -- from the accepted offer
  feaso_id             uuid,                           -- the deal feaso it was bought on (FK below)
  accepted_offer_id    uuid,                           -- the accepted letter of offer (FK below)
  -- key dates that task due dates can follow (tasks.anchor_milestone)
  exchange_on          date,
  dd_expiry_on         date,
  unconditional_on     date,
  da_approval_on       date,
  settlement_on        date,
  -- who owns it: the project company (own ABN, GST, bank, books; see companies).
  -- Blank while the offer is in Dan's name "and/or nominee"; set it once the
  -- company is registered and every transaction moves to it (logged).
  owner_company_id     uuid,
  interim_owner_name   text not null default 'Dan Wellman and/or nominee',
  -- where it's at (current_stage_id -> project_stages; foreign key added below)
  current_stage_id     uuid,
  status               public.project_status not null default 'live',
  budget               numeric(14,2) check (budget >= 0),  -- headline feaso budget, ex GST (detail in budget_lines)
  opened_on            date not null default public.today_syd(),
  closed_on            date,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (owner_id, project_type) references public.project_types (owner_id, code) on update cascade,
  foreign key (owner_company_id, owner_id) references public.companies (id, owner_id),
  foreign key (zoning_id, owner_id) references public.zonings (id, owner_id)
);
comment on table public.projects is 'Master project register. Owned by one company (owner_company_id). Project ID = location ref (lot/plan held separately).';

-- PROJECT STAGES: this project's own stage list, copied from the template when
-- the project is created.  Dan can rename a stage, insert one (add_project_stage)
-- or reorder them, on this project only.  Stage number on screen = order of
-- position (see v_project_stages.stage_no), so gaps in position don't matter.
create table public.project_stages (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id         text not null references public.projects (project_id) on delete cascade,
  position           smallint not null check (position >= 1),
  name               text not null check (trim(name) <> ''),
  description        text,
  stage_key          text check (stage_key ~ '^[a-z_]{2,40}$'),
  template_stage_id  uuid references public.stage_templates (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, project_id),                             -- lets other tables check "same project"
  constraint project_stages_position_uq unique (project_id, position) deferrable initially immediate
);
comment on table public.project_stages is 'Stages for one project (copied from the template, renamable, insertable). Tasks, RFQs and documents hang off these.';

alter table public.projects
  add constraint projects_current_stage_fk
  foreign key (current_stage_id, project_id) references public.project_stages (id, project_id);

-- DEALS: the sourcing pipeline (sites before they become projects).
-- Documents can be filed on a deal straight away (documents.deal_id) and come
-- across when it becomes a project (convert_deal_to_project).
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  street             text not null,                    -- '21 Tynan Road'
  suburb             text,                             -- 'Tabletop'
  state              public.au_state not null default 'NSW',
  postcode           text check (postcode is null or postcode ~ '^\d{4}$'),
  address            text generated always as (public.format_address(street, suburb, state, postcode)) stored,
  lot_plan           text,                             -- 'Lot 1 DP 1017395'
  project_type       text,                             -- what it would be; used when converting
  source             text,                             -- 'realestate.com.au', 'Ray White Commercial', 'off-market'
  source_contact_id  uuid references public.contacts (id) on delete set null,  -- buyer's agent / listing agent
  asking_price       numeric(14,2),
  zoning_id          uuid,
  land_area_m2       numeric(12,2) check (land_area_m2 >= 0),          -- original land size
  min_lot_size_m2    numeric(12,2) check (min_lot_size_m2 >= 0),
  yield_count        integer check (yield_count >= 0),                 -- number of lots / factory units / units
  yield_unit         public.yield_unit not null default 'lots',
  purchase_tax_type  public.purchase_tax_type,                         -- GST / margin scheme / GST exempt (from the contract)
  feaso_result       public.feaso_result not null default 'pending',
  feaso_link         text,                             -- link to the Feasely study
  notes              text,
  logged_on          date not null default public.today_syd(),
  project_id         text references public.projects (project_id) on delete set null,  -- set by convert_deal_to_project
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (owner_id, project_type) references public.project_types (owner_id, code) on update cascade,
  foreign key (zoning_id, owner_id) references public.zonings (id, owner_id)
);
comment on table public.deals is 'Sourcing pipeline: every site looked at, with feaso result and its documents. A Go site becomes a project.';

-- QUICK FEASO: Dan's back-of-envelope spreadsheet ("Quick Feso Subdivision.xlsx"),
-- one row per saved version per deal.  Inputs only; the results are worked out
-- in v_deal_feasos exactly as his sheet does.  Blank lots / land price / sales
-- GST method are filled from the deal when saved; every other default is the
-- figure in his sheet.  Save a new version rather than editing an old one.
create table public.deal_feasos (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deal_id                     uuid not null references public.deals (id) on delete cascade,
  version                     integer not null,                       -- 1, 2, 3... (automatic)
  label                       text,                                   -- 'Agent''s price', 'At 28 lots'
  -- revenue
  lots                        integer not null check (lots > 0),      -- from deal.yield_count
  price_per_lot               numeric(14,2) not null default 300000 check (price_per_lot >= 0),
  agency_pct                  numeric(7,5)  not null default 0.025,
  legal_per_lot               numeric(14,2) not null default 3000,
  sales_gst_method            public.sales_gst_method not null,       -- margin scheme unless the land was bought with GST
  -- land
  land_price                  numeric(14,2) not null check (land_price >= 0),   -- from deal.asking_price
  stamp_duty_pct              numeric(7,5)  not null default 0.05,
  land_legals                 numeric(14,2) not null default 5000,
  -- construction (per lot)
  electrics_comms_per_lot     numeric(14,2) not null default 18000,
  civils_per_lot              numeric(14,2) not null default 100000,
  landscaping_per_lot         numeric(14,2) not null default 5000,
  contingency_pct             numeric(7,5)  not null default 0.05,
  -- consultants
  electrical_design           numeric(14,2) not null default 20000,
  consultants_other           numeric(14,2) not null default 30000,
  engineer                    numeric(14,2) not null default 50000,
  surveyor_per_lot            numeric(14,2) not null default 3000,
  planning                    numeric(14,2) not null default 30000,
  -- fees
  marketing                   numeric(14,2) not null default 10000,
  pm_fee_per_month            numeric(14,2) not null default 5000,
  pm_months                   numeric(6,2)  not null default 18,
  bond_pct_of_civils          numeric(7,5)  not null default 0.01,
  accounting_admin            numeric(14,2) not null default 10000,
  holding                     numeric(14,2) not null default 20000,
  council_cc_fee              numeric(14,2) not null default 20000,
  s94_per_lot                 numeric(14,2) not null default 20000,   -- s94 / s7.11 contributions per lot
  existing_lot_credit         integer       not null default 1 check (existing_lot_credit >= 0),  -- lots already on title (no s94)
  -- finance
  equity                      numeric(14,2) not null default 0 check (equity >= 0),
  land_interest_rate          numeric(7,5)  not null default 0.08,
  construction_interest_rate  numeric(7,5)  not null default 0.08,
  establishment_fee_pct       numeric(7,5)  not null default 0.015,
  land_loan_months            numeric(6,2)  not null default 12 check (land_loan_months > 0),          -- how long the land debt runs
  construction_loan_months    numeric(6,2)  not null default 12 check (construction_loan_months > 0),  -- how long the construction debt runs
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (deal_id, version)
);
comment on table public.deal_feasos is 'Quick Feaso inputs, versioned per deal. Results in v_deal_feasos (his spreadsheet''s formulas).';

-- OFFERS: letters of offer on a deal ("sometimes there will be several offers
-- made to suit both parties").  Terms are free text, usually picked from
-- offer_terms; conditions are an ordered list (numbered on the letter).
-- Only one offer per deal can be accepted.  v_offer_letters lays it out like
-- his Word template; document_id points at the generated letter once saved.
create table public.deal_offers (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deal_id        uuid not null references public.deals (id) on delete cascade,
  offer_no       integer not null,                          -- 1, 2, 3... per deal (automatic)
  status         public.offer_status not null default 'draft',
  property_text  text,                                      -- 'Proposed Lot 1 - part 21 Tynan Road...' (blank = deal address + lot/DP)
  price          numeric(14,2) check (price >= 0),
  gst_wording    text,                                      -- '+ GST (Contract noted no taxable supply...)'
  purchaser      text not null default 'Daniel Wellman or Nominee (TBC)',
  deposit        text,
  due_diligence  text,
  settlement     text,
  conditions     text[] not null default '{}',              -- in order: 1., 2., 3....
  solicitor      text,
  sent_on        date,
  accepted_on    date,
  exchange_on    date,                                      -- contracts exchanged (becomes the project's exchange date)
  letter_format  public.letter_format not null default 'pdf',  -- the app generates the letter as PDF (or Word)
  document_id    uuid,                                      -- the latest generated letter (FK added after documents; see file_offer_letter)
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (deal_id, offer_no),
  constraint deal_offers_accepted_has_date check (status <> 'accepted' or accepted_on is not null),
  constraint deal_offers_exchange_only_if_accepted check (exchange_on is null or status = 'accepted')
);
comment on table public.deal_offers is 'Letters of offer per deal (several allowed, one accepted). Layout in v_offer_letters.';

alter table public.projects
  add constraint projects_feaso_fk foreign key (feaso_id) references public.deal_feasos (id),
  add constraint projects_accepted_offer_fk foreign key (accepted_offer_id) references public.deal_offers (id);

-- TASKS: the per-stage checklist for each project ("have I chased that up?").
-- due_on is Dan's to edit.  A task can also FOLLOW something, N days after it:
--   * another task (depends_on_task_id), on its due date or the date it was
--     ticked off (anchor_on), or
--   * a project milestone (anchor_milestone: exchange, dd_expiry,
--     unconditional, da_approval, settlement -> projects.<milestone>_on).
-- When the thing it follows moves, its due date moves too, and so on down the
-- chain.  Typing a date on a following task sets manual_override (it then
-- stays put); clear manual_override to make it follow again.  Loops are refused.
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null references public.projects (project_id) on delete cascade,
  stage_id            uuid not null,
  title               text not null,
  notes               text,
  due_on              date,
  done                boolean not null default false,
  done_at             timestamptz,
  lead_time_days      integer check (lead_time_days >= 0),  -- e.g. 90 for an Endeavour Energy connection application
  warning             text,                                 -- e.g. '3-month lead time: apply as soon as DA lands'
  sort_order          integer not null default 0,
  template_task_id    uuid references public.stage_template_tasks (id) on delete set null,
  depends_on_task_id  uuid,                                 -- follow this task...
  anchor_milestone    public.task_milestone,                -- ...or this project date
  anchor_on           public.task_anchor not null default 'due',
  offset_days         integer not null default 0,           -- negative = before
  manual_override     boolean not null default false,       -- Dan typed the date: don't move it
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, project_id),
  -- the stage must be one of THIS project's stages; a stage with tasks can't be deleted
  foreign key (stage_id, project_id) references public.project_stages (id, project_id),
  -- a task can only follow a task in the same project; if that task is deleted, this one stops following
  foreign key (depends_on_task_id, project_id) references public.tasks (id, project_id) on delete set null (depends_on_task_id),
  constraint tasks_one_anchor check (depends_on_task_id is null or anchor_milestone is null),
  constraint tasks_not_self   check (depends_on_task_id is distinct from id)
);
comment on table public.tasks is 'Stage checklist per project with due dates, lead-time warnings and done ticks.';

-- BUDGET LINES: feaso budget per cost category, per project.
create table public.budget_lines (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id     text not null references public.projects (project_id) on delete cascade,
  category       public.budget_category not null,
  description    text not null,                        -- 'Civil works', 'Section 7.11 contributions'
  budget_ex_gst  numeric(14,2) not null default 0 check (budget_ex_gst >= 0),
  notes          text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, project_id),                             -- lets other tables check "same project"
  unique (project_id, category, description)
);
comment on table public.budget_lines is 'Feaso budget per project by category. Committed and paid are calculated in v_budget_vs_actual.';

-- DOCUMENTS: every file (PDF, Excel, Word, photos...), stored in the
-- project-documents bucket.  A document belongs to EXACTLY ONE of a deal or a
-- project.  Inside a project it is filed by stage and by document type.
-- Naming convention (set automatically): [ProjectID]_[DocType]_[Party]_[Date]
--   e.g. CROOBYAR_Quote_SouthcoastCivil_2026-10-14
--   On a deal: Deal-<StreetSuburb>_[DocType]_[Party]_[Date], renamed to the project
--   form when the deal is converted.
-- Storage path (set automatically if the app doesn't send one, then fixed):
--   project-documents/<ProjectID>/<doc_type>/<standard_name>.<ext>
--   project-documents/deals/<deal_id>/<doc_type>/<standard_name>.<ext>
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text references public.projects (project_id) on delete cascade,
  deal_id         uuid references public.deals (id) on delete cascade,
  stage_id        uuid,                                -- which stage of the project it's filed under
  doc_type        text not null,                       -- document_types.code
  party           text,                                -- who it's from/to; falls back to the contact's company
  contact_id      uuid references public.contacts (id) on delete set null,
  doc_date        date not null default public.today_syd(),
  original_name   text,                                -- filename as uploaded, e.g. 'Area sales Oct.xlsx'
  file_ext        text,                                -- 'pdf', 'xlsx', 'docx'... taken from original_name if blank
  standard_name   text not null default '',            -- filled by trigger
  storage_bucket  text not null default 'project-documents',
  storage_path    text,                                -- filled by trigger if blank
  mime_type       text,                                -- any file type is allowed
  size_bytes      bigint,
  tags            text[] not null default '{}',
  notes           text,
  source_deal_id  uuid references public.deals (id) on delete set null,  -- the deal it came from, if any
  backed_up_at    timestamptz,                         -- last copied to OneDrive
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (stage_id, project_id)  references public.project_stages (id, project_id),
  foreign key (owner_id, doc_type)    references public.document_types (owner_id, code) on update cascade,
  constraint documents_one_parent        check (num_nonnulls(project_id, deal_id) = 1),
  constraint documents_deal_has_no_stage check (deal_id is null or stage_id is null),
  constraint documents_file_ext_ok       check (file_ext is null or file_ext ~ '^[a-z0-9]{1,10}$')
);
alter table public.deal_offers
  add constraint deal_offers_document_fk foreign key (document_id) references public.documents (id) on delete set null;
comment on table public.documents is 'File register for the project-documents bucket. On a deal or a project (exactly one). Name = [ProjectID]_[DocType]_[Party]_[Date].';

-- RFQ SCOPES: one per thing being priced ('Civil works', 'Town planning').
create table public.rfq_scopes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id     text not null references public.projects (project_id) on delete cascade,
  stage_id       uuid,
  name           text not null,
  category       public.budget_category,
  template_body  text,                                 -- the standard RFQ email / scope text
  min_quotes     smallint not null default 3 check (min_quotes >= 1),  -- Wellco rule: minimum 3 quotes per scope
  status         public.rfq_status not null default 'draft',
  sent_at        timestamptz,
  quotes_due     date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, project_id),
  foreign key (stage_id, project_id) references public.project_stages (id, project_id)
);
comment on table public.rfq_scopes is 'Quote requests per scope. Wellco rule: minimum 3 quotes (see v_rfq_status.meets_minimum).';

-- QUOTES: one per party per scope.
-- MIN-3 RULE: the database does not block appointing with fewer than 3 quotes
-- (sometimes there just aren't 3 in the area), but v_rfq_status flags it and
-- the app should ask Dan to confirm.
create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null references public.projects (project_id) on delete cascade,
  rfq_scope_id    uuid not null,
  contact_id      uuid not null references public.contacts (id),
  status          public.quote_status not null default 'requested',
  requested_at    date not null default public.today_syd(),
  received_at     date,
  last_chased_at  date,
  amount_ex_gst   numeric(14,2) check (amount_ex_gst >= 0),
  gst_treatment   public.gst_treatment not null default 'taxable',
  gst_amount      numeric(14,2) not null default 0 check (gst_amount >= 0),
  total           numeric(14,2) generated always as (coalesce(amount_ex_gst, 0) + gst_amount) stored,
  inclusions      text,
  exclusions      text,
  valid_until     date,
  document_id     uuid,
  chosen          boolean not null default false,
  chosen_reason   text,                                 -- why this one won: price, availability, track record
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (rfq_scope_id, project_id) references public.rfq_scopes (id, project_id) on delete cascade,
  foreign key (document_id, project_id)  references public.documents (id, project_id),
  constraint quotes_chosen_needs_reason check (not chosen or nullif(trim(chosen_reason), '') is not null),
  constraint quotes_no_gst_when_free    check (gst_treatment = 'taxable' or gst_amount = 0),
  constraint quotes_no_margin_scheme    check (gst_treatment <> 'margin_scheme')
);
comment on table public.quotes is 'Quotes received per RFQ scope, compared side by side. chosen + chosen_reason records who won and why.';

-- ENGAGEMENTS: engagement letters / purchase orders, always in the PROJECT COMPANY's name.
create table public.engagements (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id         text not null references public.projects (project_id) on delete cascade,
  contact_id         uuid not null references public.contacts (id),
  quote_id           uuid,
  budget_line_id     uuid,
  kind               public.engagement_kind not null default 'engagement_letter',
  reference          text,                             -- e.g. 'CROOBYAR-PO-004'
  scope              text not null,
  value_ex_gst       numeric(14,2) not null default 0 check (value_ex_gst >= 0),
  gst_treatment      public.gst_treatment not null default 'taxable',
  gst_amount         numeric(14,2) not null default 0 check (gst_amount >= 0),
  total              numeric(14,2) generated always as (value_ex_gst + gst_amount) stored,
  status             public.engagement_status not null default 'draft',
  issued_at          timestamptz,
  completed_at       timestamptz,
  document_id        uuid,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, project_id),
  unique (project_id, reference),
  foreign key (quote_id, project_id)       references public.quotes (id, project_id),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id),
  foreign key (document_id, project_id)    references public.documents (id, project_id),
  constraint engagements_no_gst_when_free check (gst_treatment = 'taxable' or gst_amount = 0),
  constraint engagements_no_margin_scheme check (gst_treatment <> 'margin_scheme')
);
comment on table public.engagements is 'Engagement letters and POs issued in the project company name. % claimed is in v_engagement_progress.';

-- INVOICES IN (bills to the project company): the HEADER.  The money is in
-- invoice_in_lines; amount_ex_gst / gst_amount here are the sum of the lines,
-- kept up to date automatically (anything the app writes to them is overwritten).
--   * default_category / budget_line_id / default_gst_treatment are only the
--     starting values for new lines.
--   * Quick single-line bill: insert the header WITH amount_ex_gst (and
--     gst_amount) filled and one line is created from it for you.
--   * Split bill (e.g. council: GST-free contributions + taxable works): insert
--     the header with no amounts, then one invoice_in_lines row per line.
-- Wellco's management fee is a COST to the project company, so it goes here
-- (category management_fee, flag 'management_fee').  Wellco raises the matching
-- invoice in its own Xero.
-- Land bought where the vendor used the margin scheme: record as gst_free (no
-- GST credit to claim) and note it.  Confirm treatment with the accountant.
create table public.invoices_in (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id             text not null references public.projects (project_id) on delete cascade,
  contact_id             uuid references public.contacts (id),   -- supplier (council, contractor, OSR...)
  engagement_id          uuid,
  budget_line_id         uuid,                          -- default budget line for new lines
  default_category       public.budget_category,        -- default cost category for new lines
  supplier_invoice_no    text,
  invoice_date           date not null,
  due_date               date,
  description            text not null,
  default_gst_treatment  public.gst_treatment not null default 'taxable',
  amount_ex_gst          numeric(14,2) not null default 0,   -- = sum of lines (automatic)
  gst_amount             numeric(14,2) not null default 0,   -- = sum of lines (automatic)
  total                  numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  status                 public.invoice_in_status not null default 'draft',
  paid_on                date,
  flag                   public.money_flag,               -- intercompany loan / distribution / mgmt fee
  document_id            uuid,
  notes                  text,
  fy                     text generated always as (public.au_fy(invoice_date)) stored,          -- 'FY2025-26'
  bas_quarter            text generated always as (public.au_bas_quarter(invoice_date)) stored, -- 'Q2'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, project_id),
  foreign key (engagement_id, project_id)  references public.engagements (id, project_id),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id),
  foreign key (document_id, project_id)    references public.documents (id, project_id),
  constraint invoices_in_no_margin_scheme check (default_gst_treatment <> 'margin_scheme'),
  constraint invoices_in_paid_has_date    check (status <> 'paid' or paid_on is not null)
);
comment on table public.invoices_in is 'Bills to the project company (header). Lines are in invoice_in_lines; totals here are their sum. fy and bas_quarter are automatic.';

-- BILL LINES: one row per line on the bill, each with its own GST treatment and
-- cost category.  Blank fields are filled from the header:
--   description <- header description;  gst_treatment <- header default;
--   category    <- the line's budget line, else header default_category, else the
--                  header's budget line, else the engagement's budget line
--                  (null = "Unallocated");
--   gst_amount  <- 10% for taxable lines (rounded to the cent), else $0.
create table public.invoice_in_lines (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null,                       -- copied from the bill automatically
  invoice_id      uuid not null,
  line_no         integer not null default 0,          -- display order
  description     text not null,
  category        public.budget_category,
  budget_line_id  uuid,
  gst_treatment   public.gst_treatment not null,
  amount_ex_gst   numeric(14,2) not null,              -- negative allowed (credits / adjustments)
  gst_amount      numeric(14,2) not null,
  total           numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (invoice_id, project_id)     references public.invoices_in (id, project_id) on delete cascade,
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id),
  constraint invoice_in_lines_no_gst_when_free check (gst_treatment = 'taxable' or gst_amount = 0),
  constraint invoice_in_lines_no_margin_scheme check (gst_treatment <> 'margin_scheme')
);
comment on table public.invoice_in_lines is 'Bill lines: own GST treatment and cost category per line. Budget, BAS and funds needed add up from here.';

-- INVOICES OUT (from the project company): lot deposits, settlements, unit sales.
-- Header + lines, same pattern as invoices in (quick single-line insert works too).
create table public.invoices_out (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id             text not null references public.projects (project_id) on delete cascade,
  contact_id             uuid references public.contacts (id),       -- buyer / their solicitor
  kind                   public.invoice_out_kind not null default 'lot_settlement',
  invoice_no             text,                                       -- e.g. 'CROOBYAR-INV-003'
  lot_number             text,
  invoice_date           date not null,
  due_date               date,
  description            text not null,
  default_gst_treatment  public.gst_treatment not null default 'margin_scheme',
  amount_ex_gst          numeric(14,2) not null default 0,           -- = sum of lines (automatic)
  gst_amount             numeric(14,2) not null default 0,           -- = sum of lines (automatic)
  total                  numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  margin_amount          numeric(14,2),                              -- = sum of lines' margins (automatic)
  status                 public.invoice_out_status not null default 'draft',
  paid_on                date,
  flag                   public.money_flag,
  document_id            uuid,
  notes                  text,
  fy                     text generated always as (public.au_fy(invoice_date)) stored,
  bas_quarter            text generated always as (public.au_bas_quarter(invoice_date)) stored,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, project_id),
  unique (project_id, invoice_no),
  foreign key (document_id, project_id) references public.documents (id, project_id),
  constraint invoices_out_paid_has_date check (status <> 'paid' or paid_on is not null)
);
comment on table public.invoices_out is 'Invoices from the project company (header). Lines in invoice_out_lines. fy and bas_quarter are automatic.';

-- SALES INVOICE LINES.  Margin scheme: gst_amount = 1/11 of the margin (filled
-- from margin_amount if left blank; the accountant confirms the margin).
-- category is optional here (sales income isn't a cost); use it for recharges.
create table public.invoice_out_lines (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null,                       -- copied from the invoice automatically
  invoice_id      uuid not null,
  line_no         integer not null default 0,
  description     text not null,
  lot_number      text,
  category        public.budget_category,
  gst_treatment   public.gst_treatment not null,
  amount_ex_gst   numeric(14,2) not null,
  gst_amount      numeric(14,2) not null,
  total           numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  margin_amount   numeric(14,2),                       -- margin scheme only
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (invoice_id, project_id) references public.invoices_out (id, project_id) on delete cascade,
  constraint invoice_out_lines_no_gst_when_free check (gst_treatment in ('taxable', 'margin_scheme') or gst_amount = 0)
);
comment on table public.invoice_out_lines is 'Sales invoice lines with their own GST treatment (margin scheme per line).';

-- FUNDS NEEDED BEFORE SIGN-OFF: the end-of-job money that has to be paid before
-- council / the certifier will sign so settlements can happen (contributions,
-- bonds, final inspection fees, LRS...).  "Council goes, yeah we're ready to
-- sign so you can settle, but hey, we need 500 grand."
--   * stage_id defaults to the project's Certification stage (stage_key 'certification').
--   * Link the bill line when the actual bill arrives (invoice_in_line_id): from
--     then on the actual line amount replaces the estimate, and the item counts
--     as paid when that bill is paid.  Or just set paid_on.
--   * These are forecasts: they do NOT feed budget vs actual (the bill line does).
create table public.funds_needed (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id          text not null references public.projects (project_id) on delete cascade,
  stage_id            uuid not null,                   -- filled with the Certification stage if blank
  description         text not null,                   -- 'Section 7.11 contributions', 'Maintenance bond'
  contact_id          uuid references public.contacts (id) on delete set null,   -- who gets paid
  category            public.budget_category not null default 'council_gov',
  gst_treatment       public.gst_treatment not null default 'gst_free',
  amount_ex_gst       numeric(14,2) not null check (amount_ex_gst >= 0),
  gst_amount          numeric(14,2) not null,          -- filled: 10% if taxable, else $0
  total               numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  due_date            date,
  invoice_in_line_id  uuid,
  paid_on             date,
  notes               text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, project_id),
  foreign key (stage_id, project_id)           references public.project_stages (id, project_id),
  foreign key (invoice_in_line_id, project_id) references public.invoice_in_lines (id, project_id),
  constraint funds_needed_no_gst_when_free check (gst_treatment = 'taxable' or gst_amount = 0),
  constraint funds_needed_no_margin_scheme check (gst_treatment <> 'margin_scheme')
);
comment on table public.funds_needed is 'Money that must be paid before sign-off (Certification stage). Totals in v_funds_needed: total, paid, still to find.';

-- APPROVALS: anything that goes out waits here until Dan taps Approve.
-- entity_type is the table name, entity_id is the row id.
-- payload holds exactly what will go out, e.g.
--   {"to": ["quotes@southcoastcivil.com.au"], "subject": "...", "body": "...", "attachments": ["..."]}
create table public.approvals (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id     text references public.projects (project_id) on delete cascade,  -- null = not project specific
  kind           public.approval_kind not null,
  title          text not null,                      -- 'Send RFQ: Civil works to 3 contractors'
  entity_type    text check (entity_type in ('rfq_scopes', 'quotes', 'engagements', 'invoices_in', 'invoices_out', 'documents', 'tasks')),
  entity_id      uuid,
  payload        jsonb not null default '{}'::jsonb,
  status         public.approval_status not null default 'pending',
  requested_at   timestamptz not null default now(),
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.approvals is 'Approval queue. Nothing is sent, issued or paid until the matching row is approved.';

-- ACTIVITY LOG: append-only record of every action.
-- Rows are written automatically by triggers (source = 'auto') and by the app
-- for friendly messages (source = 'app', e.g. 'RFQ sent to 3 civil contractors - approved by Dan').
-- project_id has no foreign key on purpose: the log survives if a project is deleted.
create table public.activity_log (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id   text,
  at           timestamptz not null default now(),
  actor        text not null default 'Dan',
  action       text not null,                        -- 'insert' / 'update' / 'delete' / 'deal.converted' ...
  entity_type  text,
  entity_id    text,
  summary      text not null,
  details      jsonb not null default '{}'::jsonb,
  approval_id  uuid references public.approvals (id) on delete set null,
  source       text not null default 'app' check (source in ('app', 'auto', 'system'))
);
comment on table public.activity_log is 'Append-only log of every action, per project. Cannot be edited or deleted from the app.';


-- -----------------------------------------------------------------------------
-- 1.4  Indexes (speed for the screens Dan uses most)
-- -----------------------------------------------------------------------------
create index projects_owner_status_idx     on public.projects (owner_id, status);
create index projects_current_stage_idx    on public.projects (current_stage_id);
create index projects_company_idx          on public.projects (owner_company_id);
create index companies_owner_status_idx    on public.companies (owner_id, status);
create unique index companies_one_pm_uidx  on public.companies (owner_id) where is_project_manager;   -- only one Wellco
create unique index stage_templates_key_uidx on public.stage_templates (owner_id, project_type, stage_key) where stage_key is not null;
create index stage_template_tasks_stage_idx on public.stage_template_tasks (stage_template_id, sort_order);
create unique index project_stages_key_uidx on public.project_stages (project_id, stage_key) where stage_key is not null;
create index contacts_owner_idx            on public.contacts (owner_id);
create index contacts_name_idx             on public.contacts (lower(coalesce(company, name)));
create index contact_roles_category_idx    on public.contact_roles (category_id, sort_order);
create index contact_role_links_role_idx   on public.contact_role_links (role_id);
create index contact_extra_cat_cat_idx     on public.contact_extra_categories (category_id);
create index deals_owner_result_idx        on public.deals (owner_id, feaso_result);
create index deals_project_idx             on public.deals (project_id);
create index tasks_project_open_idx        on public.tasks (project_id, done, due_on);
create index tasks_stage_idx               on public.tasks (stage_id, sort_order);
create index tasks_open_due_idx            on public.tasks (due_on) where not done;
create index tasks_depends_on_idx          on public.tasks (depends_on_task_id) where depends_on_task_id is not null;
create index tasks_milestone_idx           on public.tasks (project_id, anchor_milestone) where anchor_milestone is not null;
create index deal_feasos_deal_idx          on public.deal_feasos (deal_id, version desc);
create index deal_offers_deal_idx          on public.deal_offers (deal_id, offer_no);
create unique index deal_offers_one_accepted_uidx on public.deal_offers (deal_id) where status = 'accepted';   -- only one accepted offer per deal
create index deals_zoning_idx              on public.deals (zoning_id);
create index projects_zoning_idx           on public.projects (zoning_id);
create index offer_terms_field_idx         on public.offer_terms (owner_id, field, sort_order);
create index contacts_sort_idx             on public.contacts (owner_id, lower(coalesce(nullif(trim(company), ''), name)), lower(name));
create index budget_lines_project_idx      on public.budget_lines (project_id, category);
create index documents_project_stage_type_idx on public.documents (project_id, stage_id, doc_type);
create index documents_deal_idx            on public.documents (deal_id) where deal_id is not null;
create index documents_contact_idx         on public.documents (contact_id);
create unique index documents_storage_path_uidx on public.documents (storage_bucket, storage_path);
create index rfq_scopes_project_idx        on public.rfq_scopes (project_id, status);
create index rfq_scopes_stage_idx          on public.rfq_scopes (stage_id);
create index quotes_scope_idx              on public.quotes (rfq_scope_id);
create index quotes_project_idx            on public.quotes (project_id);
create index quotes_contact_idx            on public.quotes (contact_id);
create unique index quotes_one_chosen_per_scope on public.quotes (rfq_scope_id) where chosen;  -- only one winner per scope
create index engagements_project_idx       on public.engagements (project_id, status);
create index engagements_contact_idx       on public.engagements (contact_id);
create index engagements_quote_idx         on public.engagements (quote_id);
create index engagements_budget_line_idx   on public.engagements (budget_line_id);
create index invoices_in_project_fy_idx    on public.invoices_in (project_id, fy, bas_quarter);
create index invoices_in_status_due_idx    on public.invoices_in (status, due_date);
create index invoices_in_engagement_idx    on public.invoices_in (engagement_id);
create index invoices_in_budget_line_idx   on public.invoices_in (budget_line_id);
create index invoices_in_contact_idx       on public.invoices_in (contact_id);
create index invoice_in_lines_invoice_idx  on public.invoice_in_lines (invoice_id, line_no);
create index invoice_in_lines_project_cat_idx on public.invoice_in_lines (project_id, category);
create index invoice_in_lines_budget_line_idx on public.invoice_in_lines (budget_line_id);
create index invoices_out_project_fy_idx   on public.invoices_out (project_id, fy, bas_quarter);
create index invoices_out_contact_idx      on public.invoices_out (contact_id);
create index invoice_out_lines_invoice_idx on public.invoice_out_lines (invoice_id, line_no);
create index funds_needed_project_idx      on public.funds_needed (project_id, stage_id);
create index funds_needed_line_idx         on public.funds_needed (invoice_in_line_id);
create index approvals_pending_idx         on public.approvals (owner_id, requested_at) where status = 'pending';
create index approvals_entity_idx          on public.approvals (entity_type, entity_id);
create index approvals_project_idx         on public.approvals (project_id);
create index activity_log_project_at_idx   on public.activity_log (project_id, at desc);
create index activity_log_owner_at_idx     on public.activity_log (owner_id, at desc);


-- -----------------------------------------------------------------------------
-- 1.5  Triggers and functions (the automatic bits)
-- -----------------------------------------------------------------------------

-- (a) keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['wellco_settings', 'project_types', 'stage_templates', 'stage_template_tasks',
                           'contact_categories', 'contact_roles', 'document_types', 'companies',
                           'zonings', 'offer_terms', 'deal_feasos', 'deal_offers',
                           'contacts', 'projects', 'project_stages', 'deals', 'tasks', 'budget_lines',
                           'documents', 'rfq_scopes', 'quotes', 'engagements', 'invoices_in',
                           'invoice_in_lines', 'invoices_out', 'invoice_out_lines', 'funds_needed', 'approvals']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- (b) tasks: stamp done_at when ticked, clear it when unticked
create or replace function public.tasks_set_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := coalesce(new.done_at, now());
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_set_done_at before insert or update of done on public.tasks
  for each row execute function public.tasks_set_done_at();

-- (c) approvals: stamp decided_at when Dan approves / rejects
create or replace function public.approvals_set_decided_at()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'pending' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := coalesce(new.decided_at, now());
  elsif new.status = 'pending' then
    new.decided_at := null;
  end if;
  return new;
end;
$$;

create trigger approvals_set_decided_at before insert or update of status on public.approvals
  for each row execute function public.approvals_set_decided_at();

-- (d) documents: file extension, standard file name and storage path
--     [ProjectID]_[DocType]_[Party]_[YYYY-MM-DD]   (adds _2, _3 if it already exists)
--     On a deal the prefix is Deal-<Address>; it is renamed when the deal
--     becomes a project.  DocType comes from document_types.file_code.
create or replace function public.documents_set_name()
returns trigger
language plpgsql
as $$
declare
  v_party  text;
  v_code   text;
  v_prefix text;
  v_base   text;
  v_name   text;
  v_n      integer := 1;
begin
  -- any file type: take the extension from the uploaded file name if not given
  if nullif(trim(new.file_ext), '') is null then
    new.file_ext := lower(substring(new.original_name from '\.([A-Za-z0-9]{1,10})$'));
  else
    new.file_ext := lower(ltrim(trim(new.file_ext), '.'));
  end if;

  -- only rename when it's new or one of the naming inputs changed
  if tg_op = 'UPDATE'
     and new.project_id is not distinct from old.project_id
     and new.deal_id is not distinct from old.deal_id
     and new.doc_type = old.doc_type
     and new.doc_date = old.doc_date
     and new.party is not distinct from old.party
     and new.contact_id is not distinct from old.contact_id then
    return new;
  end if;

  v_party := coalesce(
    nullif(trim(new.party), ''),
    (select coalesce(c.company, c.name) from public.contacts c where c.id = new.contact_id),
    'General');
  -- drop "Pty Ltd" etc, then keep letters and numbers only: 'Southcoast Civil Pty Ltd' -> 'SouthcoastCivil'
  v_party := regexp_replace(v_party, '\s+(pty\.?\s*ltd\.?|pty\.?\s*limited|limited|ltd\.?)\s*$', '', 'i');
  v_party := left(regexp_replace(v_party, '[^A-Za-z0-9]+', '', 'g'), 40);
  if v_party = '' then v_party := 'General'; end if;

  select nullif(dt.file_code, '') into v_code
  from public.document_types dt where dt.owner_id = new.owner_id and dt.code = new.doc_type;
  v_code := coalesce(v_code, 'Doc');

  if new.project_id is not null then
    v_prefix := new.project_id;
  else
    select 'Deal-' || left(regexp_replace(concat(d.street, d.suburb), '[^A-Za-z0-9]+', '', 'g'), 24) into v_prefix
    from public.deals d where d.id = new.deal_id;
    v_prefix := coalesce(nullif(v_prefix, 'Deal-'), 'Deal');
  end if;

  v_base := v_prefix || '_' || v_code || '_' || v_party || '_' || to_char(new.doc_date, 'YYYY-MM-DD');

  v_name := v_base;
  while exists (select 1 from public.documents d
                where d.standard_name = v_name and d.id <> new.id
                  and (d.project_id = new.project_id or d.deal_id = new.deal_id)) loop
    v_n := v_n + 1;
    v_name := v_base || '_' || v_n;
  end loop;
  new.standard_name := v_name;

  -- The storage path is fixed once set (renaming it here would not move the
  -- actual file).  standard_name is the display / download name.
  if new.storage_path is null then
    new.storage_path := coalesce(new.project_id, 'deals/' || new.deal_id::text)
                        || '/' || new.doc_type || '/' || v_name
                        || coalesce('.' || new.file_ext, '');
  end if;
  return new;
end;
$$;

create trigger documents_set_name before insert or update on public.documents
  for each row execute function public.documents_set_name();

-- (e) APPROVAL GATE: block "sent / issued / approved / paid" without an approved approval.
--     Trigger arguments = the statuses that need approval for that table.
--     Only applies to UPDATEs, so you can still bulk-import historical
--     (already paid) invoices from old spreadsheets with a plain INSERT.
create or replace function public.enforce_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.status::text = any (tg_argv) then
    if not exists (
      select 1 from public.approvals a
      where a.entity_type = tg_table_name
        and a.entity_id   = new.id
        and a.status      = 'approved'
    ) then
      raise exception 'Needs Dan''s approval first: % % cannot be set to "%" until its approval is approved.',
        tg_table_name, new.id, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger rfq_scopes_need_approval   before update of status on public.rfq_scopes
  for each row execute function public.enforce_approval('sent');
create trigger engagements_need_approval  before update of status on public.engagements
  for each row execute function public.enforce_approval('issued');
create trigger invoices_in_need_approval  before update of status on public.invoices_in
  for each row execute function public.enforce_approval('approved', 'paid');
create trigger invoices_out_need_approval before update of status on public.invoices_out
  for each row execute function public.enforce_approval('issued');

-- (f) ACTIVITY LOG: write a log row for every insert / update / delete.
--     Updates record only the fields that changed: {"status": {"from": "draft", "to": "issued"}}
--     Bulk jobs (copying a stage template, converting a deal, seeding Dan's
--     lists) switch the per-row log off with the 'wellco.quiet' setting for
--     that transaction and write ONE summary row instead, so the Log tab
--     doesn't fill with 45 "Tasks added" lines.
create or replace function public.log_activity()
returns trigger
language plpgsql
as $$
declare
  v_rec     jsonb;
  v_old     jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_label   text;
  v_summary text;
begin
  if coalesce(current_setting('wellco.quiet', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then v_rec := to_jsonb(old); else v_rec := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_changed
      from jsonb_each(v_rec) as n
     where n.key not in ('updated_at', 'done_at', 'decided_at', 'total')
       and (v_old -> n.key) is distinct from n.value;
    if v_changed = '{}'::jsonb then
      return new;   -- nothing meaningful changed
    end if;
  end if;

  v_label := coalesce(v_rec ->> 'title', v_rec ->> 'name', v_rec ->> 'scope', v_rec ->> 'standard_name',
                      v_rec ->> 'description', v_rec ->> 'address', '');
  v_summary := initcap(replace(tg_table_name, '_', ' '))
               || case tg_op when 'INSERT' then ' added' when 'UPDATE' then ' updated' else ' deleted' end
               || case when v_label <> '' then ': ' || left(v_label, 120) else '' end
               || case when v_changed ? 'status'
                       then ' (status ' || (v_changed -> 'status' ->> 'from') || ' -> ' || (v_changed -> 'status' ->> 'to') || ')'
                       else '' end
               || case when v_changed ? 'done' and (v_changed -> 'done' ->> 'to') = 'true' then ' (ticked off)' else '' end;

  insert into public.activity_log (owner_id, project_id, action, entity_type, entity_id, summary, details, source)
  values ((v_rec ->> 'owner_id')::uuid,
          v_rec ->> 'project_id',
          lower(tg_op),
          tg_table_name,
          coalesce(v_rec ->> 'id', v_rec ->> 'project_id', v_rec ->> 'code'),
          v_summary,
          case when tg_op = 'UPDATE' then v_changed else v_rec end,
          'auto');
  return null;  -- AFTER trigger: return value is ignored
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['project_types', 'stage_templates', 'stage_template_tasks', 'contact_categories',
                           'contact_roles', 'document_types', 'companies', 'zonings', 'offer_terms',
                           'deal_feasos', 'deal_offers',
                           'projects', 'project_stages', 'contacts', 'deals', 'tasks', 'budget_lines', 'documents',
                           'rfq_scopes', 'quotes', 'engagements', 'invoices_in', 'invoice_in_lines',
                           'invoices_out', 'invoice_out_lines', 'funds_needed', 'approvals']
  loop
    execute format('create trigger log_activity after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t);
  end loop;
end;
$$;

-- Small helper for the bulk jobs below: switch the per-row log off / back on.
create or replace function public.set_quiet_log(p_on boolean)
returns void
language sql
as $$ select set_config('wellco.quiet', case when p_on then 'on' else 'off' end, true); $$;

-- (g) BILL LINES: fill blanks from the header, lock lines once approved, and
--     keep the header totals equal to the sum of its lines.

-- Lock: once Dan has approved a bill (or a sales invoice has been issued) its
-- lines can't be added, changed or removed, because that would change what he
-- approved.  Bills imported as already paid (no approval row) stay editable.
-- Trigger args: header table, then the statuses that lock it.
create or replace function public.invoice_lines_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_id     uuid;
begin
  foreach v_id in array (case tg_op when 'INSERT' then array[new.invoice_id]
                                    when 'DELETE' then array[old.invoice_id]
                                    else array[new.invoice_id, old.invoice_id] end)
  loop
    execute format('select status::text from public.%I where id = $1', tg_argv[0]) into v_status using v_id;
    if v_status = any (tg_argv[1:]) and exists (
         select 1 from public.approvals a
         where a.entity_type = tg_argv[0] and a.entity_id = v_id and a.status = 'approved') then
      raise exception 'This % is % and approved, so its lines are locked. Move it back to draft (and re-approve) to change them.',
        case tg_argv[0] when 'invoices_in' then 'bill' else 'invoice' end, v_status
        using errcode = 'check_violation';
    end if;
  end loop;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create or replace function public.invoice_in_lines_defaults()
returns trigger
language plpgsql
as $$
declare
  h public.invoices_in%rowtype;
begin
  select * into h from public.invoices_in where id = new.invoice_id;
  if not found then
    raise exception 'Bill % not found', new.invoice_id using errcode = 'foreign_key_violation';
  end if;
  new.project_id    := h.project_id;                       -- a line always sits in its bill's project
  new.owner_id      := coalesce(new.owner_id, h.owner_id);
  new.description   := coalesce(nullif(trim(new.description), ''), h.description);
  new.gst_treatment := coalesce(new.gst_treatment, h.default_gst_treatment);
  if new.budget_line_id is not null then
    new.category := (select bl.category from public.budget_lines bl where bl.id = new.budget_line_id);
  elsif new.category is null then
    new.category := coalesce(
      h.default_category,
      (select bl.category from public.budget_lines bl where bl.id = h.budget_line_id),
      (select bl.category from public.engagements en
         join public.budget_lines bl on bl.id = en.budget_line_id
        where en.id = h.engagement_id));
  end if;
  if new.gst_amount is null then
    new.gst_amount := case when new.gst_treatment = 'taxable' then round(new.amount_ex_gst * 0.10, 2) else 0 end;
  end if;
  return new;
end;
$$;

create or replace function public.invoice_out_lines_defaults()
returns trigger
language plpgsql
as $$
declare
  h public.invoices_out%rowtype;
begin
  select * into h from public.invoices_out where id = new.invoice_id;
  if not found then
    raise exception 'Sales invoice % not found', new.invoice_id using errcode = 'foreign_key_violation';
  end if;
  new.project_id    := h.project_id;
  new.owner_id      := coalesce(new.owner_id, h.owner_id);
  new.description   := coalesce(nullif(trim(new.description), ''), h.description);
  new.lot_number    := coalesce(new.lot_number, h.lot_number);
  new.gst_treatment := coalesce(new.gst_treatment, h.default_gst_treatment);
  if new.gst_amount is null then
    new.gst_amount := case
      when new.gst_treatment = 'taxable' then round(new.amount_ex_gst * 0.10, 2)
      when new.gst_treatment = 'margin_scheme' and new.margin_amount is not null then round(new.margin_amount / 11, 2)
      else 0 end;
  end if;
  return new;
end;
$$;

-- After a line changes, touch its header so the header recalculates its totals.
create or replace function public.invoice_lines_touch_header()
returns trigger
language plpgsql
as $$
begin
  execute format('update public.%I set updated_at = now() where id = any ($1)', tg_argv[0])
    using case tg_op when 'INSERT' then array[new.invoice_id]
                     when 'DELETE' then array[old.invoice_id]
                     else array[new.invoice_id, old.invoice_id] end;
  return null;
end;
$$;

-- Header totals = sum of lines (on every update; on insert the given amounts
-- are kept just long enough to create the quick single line, see below).
create or replace function public.invoices_in_totals()
returns trigger
language plpgsql
as $$
begin
  select coalesce(sum(l.amount_ex_gst), 0), coalesce(sum(l.gst_amount), 0)
    into new.amount_ex_gst, new.gst_amount
    from public.invoice_in_lines l where l.invoice_id = new.id;
  return new;
end;
$$;

create or replace function public.invoices_out_totals()
returns trigger
language plpgsql
as $$
begin
  select coalesce(sum(l.amount_ex_gst), 0), coalesce(sum(l.gst_amount), 0), sum(l.margin_amount)
    into new.amount_ex_gst, new.gst_amount, new.margin_amount
    from public.invoice_out_lines l where l.invoice_id = new.id;
  return new;
end;
$$;

-- Quick single-line bill: header inserted with amounts -> one line made from it.
create or replace function public.invoices_in_quick_line()
returns trigger
language plpgsql
as $$
begin
  if new.amount_ex_gst <> 0 or new.gst_amount <> 0 then
    insert into public.invoice_in_lines (owner_id, project_id, invoice_id, description, category, budget_line_id,
                                         gst_treatment, amount_ex_gst, gst_amount)
    values (new.owner_id, new.project_id, new.id, new.description, new.default_category, new.budget_line_id,
            new.default_gst_treatment, new.amount_ex_gst, new.gst_amount);
  end if;
  return null;
end;
$$;

create or replace function public.invoices_out_quick_line()
returns trigger
language plpgsql
as $$
begin
  if new.amount_ex_gst <> 0 or new.gst_amount <> 0 then
    insert into public.invoice_out_lines (owner_id, project_id, invoice_id, description, lot_number,
                                          gst_treatment, amount_ex_gst, gst_amount, margin_amount)
    values (new.owner_id, new.project_id, new.id, new.description, new.lot_number,
            new.default_gst_treatment, new.amount_ex_gst, new.gst_amount, new.margin_amount);
  end if;
  return null;
end;
$$;

create trigger invoice_in_lines_defaults before insert or update on public.invoice_in_lines
  for each row execute function public.invoice_in_lines_defaults();
create trigger invoice_lines_guard before insert or update or delete on public.invoice_in_lines
  for each row execute function public.invoice_lines_guard('invoices_in', 'approved', 'paid');
create trigger invoice_lines_touch_header after insert or update or delete on public.invoice_in_lines
  for each row execute function public.invoice_lines_touch_header('invoices_in');
create trigger invoices_in_totals before update on public.invoices_in
  for each row execute function public.invoices_in_totals();
create trigger invoices_in_quick_line after insert on public.invoices_in
  for each row execute function public.invoices_in_quick_line();

create trigger invoice_out_lines_defaults before insert or update on public.invoice_out_lines
  for each row execute function public.invoice_out_lines_defaults();
create trigger invoice_lines_guard before insert or update or delete on public.invoice_out_lines
  for each row execute function public.invoice_lines_guard('invoices_out', 'issued', 'paid');
create trigger invoice_lines_touch_header after insert or update or delete on public.invoice_out_lines
  for each row execute function public.invoice_lines_touch_header('invoices_out');
create trigger invoices_out_totals before update on public.invoices_out
  for each row execute function public.invoices_out_totals();
create trigger invoices_out_quick_line after insert on public.invoices_out
  for each row execute function public.invoices_out_quick_line();

-- (h) STAGES: copy the template into a new project, insert stages, convert deals.

-- Copy the project type's stage template (stages + tasks) into a project and
-- set its current stage to the first one.  Runs automatically when a project
-- row is inserted (trigger below), so the app can just insert into projects.
-- Returns the number of stages copied.
create or replace function public.copy_template_to_project(p_project_id text)
returns integer
language plpgsql
as $$
declare
  p          public.projects%rowtype;
  v_type     text;
  v_stages   integer;
  v_tasks    integer;
  v_first    uuid;
begin
  select * into p from public.projects where project_id = p_project_id;
  if not found then
    raise exception 'Project % not found', p_project_id;
  end if;
  if exists (select 1 from public.project_stages ps where ps.project_id = p_project_id) then
    raise exception 'Project % already has stages; add more with add_project_stage()', p_project_id;
  end if;

  perform public.set_quiet_log(true);

  with src as (
    select st.id, st.name, st.description, st.stage_key,
           row_number() over (order by st.position) as pos
    from public.stage_templates st
    where st.owner_id = p.owner_id and st.project_type = p.project_type
  ),
  ins as (
    insert into public.project_stages (owner_id, project_id, position, name, description, stage_key, template_stage_id)
    select p.owner_id, p.project_id, src.pos, src.name, src.description, src.stage_key, src.id
    from src
    returning id, template_stage_id
  )
  insert into public.tasks (owner_id, project_id, stage_id, title, notes, lead_time_days, warning, sort_order,
                            template_task_id, anchor_milestone, anchor_on, offset_days)
  select p.owner_id, p.project_id, ins.id, tt.title, tt.notes, tt.lead_time_days, tt.warning, tt.sort_order,
         tt.id, tt.anchor_milestone, tt.anchor_on, tt.offset_days
  from ins
  join public.stage_template_tasks tt on tt.stage_template_id = ins.template_stage_id;
  get diagnostics v_tasks = row_count;

  -- "follows another template task" -> follows the matching task on this project
  update public.tasks t
     set depends_on_task_id = dep.id
    from public.stage_template_tasks tt
    join public.tasks dep on dep.template_task_id = tt.depends_on_template_task_id
   where t.project_id = p.project_id and dep.project_id = p.project_id
     and t.template_task_id = tt.id and tt.depends_on_template_task_id is not null;

  select count(*) into v_stages from public.project_stages ps where ps.project_id = p.project_id;
  select ps.id into v_first from public.project_stages ps where ps.project_id = p.project_id order by ps.position limit 1;
  update public.projects set current_stage_id = v_first
   where project_id = p.project_id and current_stage_id is null;

  perform public.set_quiet_log(false);

  select pt.name into v_type from public.project_types pt where pt.owner_id = p.owner_id and pt.code = p.project_type;
  insert into public.activity_log (owner_id, project_id, action, entity_type, entity_id, summary, details, source)
  values (p.owner_id, p.project_id, 'project.stages_copied', 'projects', p.project_id,
          format('Stage checklist set up from the %s template: %s stages, %s tasks', coalesce(v_type, p.project_type), v_stages, v_tasks),
          jsonb_build_object('project_type', p.project_type, 'stages', v_stages, 'tasks', v_tasks),
          'auto');
  return v_stages;
end;
$$;

create or replace function public.projects_copy_stage_template()
returns trigger
language plpgsql
as $$
begin
  perform public.copy_template_to_project(new.project_id);
  return null;
end;
$$;

create trigger projects_copy_stage_template after insert on public.projects
  for each row execute function public.projects_copy_stage_template();

-- Create a project from its type's template in one call.  Returns the project ID.
--   select public.create_project_from_template('CROOBYAR', 'Croobyar Rd, Milton',
--          'Lot 12 DP 1187234', 'land_subdivision');
-- p_owner_company_id is usually left blank at first (offer in "Dan Wellman
-- and/or nominee") and set once the company is registered.
-- (Inserting into projects directly does the same; this is the tidy way.)
create or replace function public.create_project_from_template(
  p_project_id        text,
  p_name              text,
  p_lot_plan          text,
  p_project_type      text             default 'land_subdivision',
  p_state             public.au_state  default 'NSW',
  p_street            text             default null,
  p_suburb            text             default null,
  p_postcode          text             default null,
  p_owner_company_id  uuid             default null,
  p_owner_id          uuid             default null      -- only needed in the SQL editor (not logged in)
)
returns text
language plpgsql
as $$
declare
  v_owner uuid := coalesce(p_owner_id, auth.uid());
  v_id    text := upper(trim(p_project_id));
begin
  if not exists (select 1 from public.project_types pt where pt.owner_id = v_owner and pt.code = p_project_type) then
    raise exception 'Unknown project type "%". Add it in Settings first.', p_project_type;
  end if;
  insert into public.projects (project_id, owner_id, name, lot_plan, project_type, state, street, suburb, postcode,
                               owner_company_id)
  values (v_id, v_owner, p_name, p_lot_plan, p_project_type, p_state, p_street, p_suburb, p_postcode,
          p_owner_company_id);
  return v_id;
end;
$$;

-- Insert a stage into a project at a position (1 = first).  Stages from that
-- position on move down one.  Renaming a stage is a plain UPDATE of name.
--   select public.add_project_stage('CROOBYAR', 5, 'Pre-DA meeting');
create or replace function public.add_project_stage(
  p_project_id   text,
  p_position     integer,
  p_name         text,
  p_description  text default null
)
returns uuid
language plpgsql
as $$
declare
  v_owner uuid;
  v_max   integer;
  v_pos   integer;
  v_id    uuid;
begin
  select owner_id into v_owner from public.projects where project_id = p_project_id;
  if not found then raise exception 'Project % not found', p_project_id; end if;
  select coalesce(max(position), 0) into v_max from public.project_stages where project_id = p_project_id;
  v_pos := least(greatest(coalesce(p_position, v_max + 1), 1), v_max + 1);
  update public.project_stages set position = position + 1
   where project_id = p_project_id and position >= v_pos;
  insert into public.project_stages (owner_id, project_id, position, name, description)
  values (v_owner, p_project_id, v_pos, p_name, p_description)
  returning id into v_id;
  return v_id;
end;
$$;

-- Same for a template (affects projects created from now on).
--   select public.add_template_stage('residential_build', 4, 'Pre-lodgement meeting');
create or replace function public.add_template_stage(
  p_project_type text,
  p_position     integer,
  p_name         text,
  p_description  text default null,
  p_owner_id     uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_owner uuid := coalesce(p_owner_id, auth.uid());
  v_max   integer;
  v_pos   integer;
  v_id    uuid;
begin
  select coalesce(max(position), 0) into v_max from public.stage_templates
   where owner_id = v_owner and project_type = p_project_type;
  v_pos := least(greatest(coalesce(p_position, v_max + 1), 1), v_max + 1);
  update public.stage_templates set position = position + 1
   where owner_id = v_owner and project_type = p_project_type and position >= v_pos;
  insert into public.stage_templates (owner_id, project_type, position, name, description)
  values (v_owner, p_project_type, v_pos, p_name, p_description)
  returning id into v_id;
  return v_id;
end;
$$;

-- CONVERT A DEAL INTO A PROJECT.
--   * Creates the project from its type's template (deal.project_type, or the
--     one passed in, else land subdivision).  Name ('<street>, <suburb>'),
--     street / suburb / state / postcode and lot-plan come from the deal unless given.
--   * Copies the site details: zoning, land area, minimum lot size, yield and
--     unit, purchase tax type, and the deal notes.
--   * Links the latest Quick Feaso (projects.feaso_id; its total cost inc
--     finance becomes the headline budget) and the accepted offer
--     (projects.accepted_offer_id; its price becomes purchase_price and its
--     exchange date the project's exchange date, which moves the task dates
--     that follow exchange).
--   * Moves every document on the deal to the new project, filed under stage
--     p_docs_stage (1 = Sourcing, the default, or 2 = Feasibility), and renames
--     them to the project's naming.  The files stay where they are in storage
--     (deals/<deal_id>/...), which the storage rules still allow.
--   * A Go deal starts at the Acquisition stage with the Sourcing and
--     Feasibility checklists ticked off (same as the demo).
--   * Writes one "Project created from deal" row to the log.
--   * The owning company can be given now or assigned later (offer still in
--     "Dan Wellman and/or nominee").
--   select public.convert_deal_to_project('<deal uuid>', 'BELLS-RD');
create or replace function public.convert_deal_to_project(
  p_deal_id           uuid,
  p_project_id        text,
  p_owner_company_id  uuid     default null,
  p_project_type      text     default null,
  p_lot_plan          text     default null,
  p_name              text     default null,
  p_docs_stage        integer  default 1
)
returns text
language plpgsql
as $$
declare
  d            public.deals%rowtype;
  v_pid        text;
  v_stage_id   uuid;
  v_stage_name text;
  v_start      public.project_stages%rowtype;
  v_docs       integer;
  v_doc_list   jsonb;
  v_feaso      record;
  v_offer      public.deal_offers%rowtype;
begin
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception 'Deal % not found', p_deal_id; end if;
  if d.project_id is not null then
    raise exception 'Deal % has already been converted to project %', p_deal_id, d.project_id;
  end if;
  if p_docs_stage not in (1, 2) then
    raise exception 'Deal documents go to stage 1 (Sourcing) or 2 (Feasibility), not %', p_docs_stage;
  end if;
  if coalesce(p_lot_plan, d.lot_plan) is null then
    raise exception 'The deal has no lot / plan yet; pass p_lot_plan';
  end if;

  v_pid := public.create_project_from_template(
             p_project_id, coalesce(p_name, concat_ws(', ', d.street, d.suburb)), coalesce(p_lot_plan, d.lot_plan),
             coalesce(p_project_type, d.project_type, 'land_subdivision'), d.state, d.street, d.suburb, d.postcode,
             p_owner_company_id, d.owner_id);

  select vf.feaso_id, vf.version, vf.total_cost_inc_finance into v_feaso
  from public.v_deal_feasos vf where vf.deal_id = p_deal_id order by vf.version desc limit 1;
  select * into v_offer from public.deal_offers o where o.deal_id = p_deal_id and o.status = 'accepted';

  select ps.id, ps.name into v_stage_id, v_stage_name
  from public.project_stages ps where ps.project_id = v_pid
  order by ps.position offset p_docs_stage - 1 limit 1;

  perform public.set_quiet_log(true);

  with moved as (
    update public.documents
       set project_id = v_pid, deal_id = null, stage_id = v_stage_id, source_deal_id = p_deal_id
     where deal_id = p_deal_id
    returning id, standard_name
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', standard_name)), '[]'::jsonb)
    into v_docs, v_doc_list
    from moved;

  update public.deals set project_id = v_pid where id = p_deal_id;

  update public.projects
     set zoning_id         = d.zoning_id,
         land_area_m2      = d.land_area_m2,
         min_lot_size_m2   = d.min_lot_size_m2,
         yield_count       = d.yield_count,
         yield_unit        = d.yield_unit,
         purchase_tax_type = d.purchase_tax_type,
         notes             = d.notes,
         feaso_id          = v_feaso.feaso_id,
         budget            = v_feaso.total_cost_inc_finance,
         accepted_offer_id = v_offer.id,
         purchase_price    = v_offer.price,
         exchange_on       = v_offer.exchange_on
   where project_id = v_pid;

  if d.feaso_result = 'go' then
    select * into v_start from public.project_stages ps where ps.project_id = v_pid and ps.stage_key = 'acquisition';
    if found then
      update public.projects set current_stage_id = v_start.id where project_id = v_pid;
      update public.tasks t set done = true
        from public.project_stages ps
       where ps.id = t.stage_id and t.project_id = v_pid and ps.position < v_start.position;
    end if;
  end if;

  perform public.set_quiet_log(false);

  insert into public.activity_log (owner_id, project_id, action, entity_type, entity_id, summary, details, source)
  values (d.owner_id, v_pid, 'deal.converted', 'deals', p_deal_id::text,
          format('Project created from deal: %s. %s document(s) moved to stage %s (%s)%s%s',
                 d.address, v_docs, p_docs_stage, v_stage_name,
                 case when v_feaso.feaso_id is not null then format('; Quick Feaso v%s attached', v_feaso.version) else '' end,
                 case when v_offer.id is not null then format('; accepted offer %s attached', v_offer.offer_no) else '' end),
          jsonb_build_object('deal_id', p_deal_id, 'documents', v_doc_list, 'stage_id', v_stage_id,
                             'feaso_id', v_feaso.feaso_id, 'offer_id', v_offer.id),
          'auto');
  return v_pid;
end;
$$;

-- (i) FUNDS NEEDED: default to the Certification stage, fill GST.
create or replace function public.funds_needed_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.stage_id is null then
    select ps.id into new.stage_id
    from public.project_stages ps where ps.project_id = new.project_id and ps.stage_key = 'certification';
    if new.stage_id is null then
      raise exception 'Project % has no Certification stage; choose the stage (stage_id) for this item', new.project_id;
    end if;
  end if;
  if new.gst_amount is null then
    new.gst_amount := case when new.gst_treatment = 'taxable' then round(new.amount_ex_gst * 0.10, 2) else 0 end;
  end if;
  return new;
end;
$$;

create trigger funds_needed_defaults before insert or update on public.funds_needed
  for each row execute function public.funds_needed_defaults();

-- (i2) TASK DATES THAT FOLLOW SOMETHING (see the tasks table comment).

-- The date a task follows: the other task's due date or tick-off date, or the
-- project's milestone date.  Null = not known yet (the due date is left alone).
create or replace function public.task_anchor_date(p_depends_on uuid, p_milestone public.task_milestone,
                                                   p_anchor_on public.task_anchor, p_project_id text)
returns date
language sql stable
as $$
  select case
    when p_depends_on is not null then
      (select case when p_anchor_on = 'done' then (t.done_at at time zone 'Australia/Sydney')::date else t.due_on end
         from public.tasks t where t.id = p_depends_on)
    when p_milestone is not null then
      (select case p_milestone
                when 'exchange'      then p.exchange_on
                when 'dd_expiry'     then p.dd_expiry_on
                when 'unconditional' then p.unconditional_on
                when 'da_approval'   then p.da_approval_on
                when 'settlement'    then p.settlement_on end
         from public.projects p where p.project_id = p_project_id)
  end
$$;

-- BEFORE insert / update on tasks: refuse loops, keep Dan's typed dates,
-- otherwise work out due_on = anchor date + offset_days.
create or replace function public.tasks_follow_anchor()
returns trigger
language plpgsql
as $$
declare
  v_anchor date;
  v_ripple boolean := coalesce(current_setting('wellco.task_ripple', true), '') = 'on';
begin
  if new.depends_on_task_id is not null
     and (tg_op = 'INSERT' or new.depends_on_task_id is distinct from old.depends_on_task_id) then
    if exists (
      with recursive chain (id, depth) as (
        select t.depends_on_task_id, 1 from public.tasks t where t.id = new.depends_on_task_id
        union all
        select t.depends_on_task_id, c.depth + 1
        from public.tasks t join chain c on t.id = c.id
        where c.depth < 1000
      )
      select 1 from chain where chain.id = new.id
    ) then
      raise exception 'That would make a loop: "%" can''t follow a task that (eventually) follows it.', new.title
        using errcode = 'check_violation';
    end if;
  end if;

  if new.depends_on_task_id is null and new.anchor_milestone is null then
    return new;                                   -- a plain task: due_on is whatever Dan sets
  end if;

  -- Dan typed a date on a following task (and didn't change the rule): keep it
  if tg_op = 'UPDATE' and not v_ripple
     and new.due_on is distinct from old.due_on
     and new.manual_override = old.manual_override
     and new.depends_on_task_id is not distinct from old.depends_on_task_id
     and new.anchor_milestone is not distinct from old.anchor_milestone
     and new.anchor_on = old.anchor_on
     and new.offset_days = old.offset_days then
    new.manual_override := true;
    return new;
  end if;

  if not new.manual_override then
    v_anchor := public.task_anchor_date(new.depends_on_task_id, new.anchor_milestone, new.anchor_on, new.project_id);
    if v_anchor is not null then
      new.due_on := v_anchor + new.offset_days;
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_follow_anchor before insert or update on public.tasks
  for each row execute function public.tasks_follow_anchor();

-- AFTER a task's due date or tick-off changes: move the tasks that follow it
-- (each of those then moves its own followers, and so on down the chain).
create or replace function public.tasks_ripple()
returns trigger
language plpgsql
as $$
declare v_prev text := coalesce(current_setting('wellco.task_ripple', true), '');
begin
  perform set_config('wellco.task_ripple', 'on', true);
  update public.tasks set updated_at = now()
   where depends_on_task_id = new.id and not manual_override;
  perform set_config('wellco.task_ripple', v_prev, true);
  return null;
end;
$$;

create trigger tasks_ripple after update on public.tasks
  for each row when (old.due_on is distinct from new.due_on or old.done_at is distinct from new.done_at)
  execute function public.tasks_ripple();

-- AFTER a project's milestone date changes: move the tasks that follow it.
create or replace function public.projects_milestone_ripple()
returns trigger
language plpgsql
as $$
declare v_prev text := coalesce(current_setting('wellco.task_ripple', true), '');
begin
  perform set_config('wellco.task_ripple', 'on', true);
  update public.tasks set updated_at = now()
   where project_id = new.project_id and anchor_milestone is not null and not manual_override;
  perform set_config('wellco.task_ripple', v_prev, true);
  return null;
end;
$$;

create trigger projects_milestone_ripple after update on public.projects
  for each row when (old.exchange_on      is distinct from new.exchange_on
                  or old.dd_expiry_on     is distinct from new.dd_expiry_on
                  or old.unconditional_on is distinct from new.unconditional_on
                  or old.da_approval_on   is distinct from new.da_approval_on
                  or old.settlement_on    is distinct from new.settlement_on)
  execute function public.projects_milestone_ripple();

-- Template tasks: same loop check for the default rules.
create or replace function public.stage_template_tasks_no_loop()
returns trigger
language plpgsql
as $$
begin
  if new.depends_on_template_task_id is not null and exists (
    with recursive chain (id, depth) as (
      select t.depends_on_template_task_id, 1 from public.stage_template_tasks t where t.id = new.depends_on_template_task_id
      union all
      select t.depends_on_template_task_id, c.depth + 1
      from public.stage_template_tasks t join chain c on t.id = c.id
      where c.depth < 1000
    )
    select 1 from chain where chain.id = new.id
  ) then
    raise exception 'That would make a loop in the template: "%"', new.title using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger stage_template_tasks_no_loop before insert or update of depends_on_template_task_id
  on public.stage_template_tasks
  for each row execute function public.stage_template_tasks_no_loop();

-- (i3) DEALS: Quick Feaso versions, offers, and keeping converted deals.

-- New feaso version: number it, and fill blanks from the deal (lots from the
-- yield, land price from the asking price, sales GST method from how the land
-- is being bought: margin scheme unless the purchase carries GST; confirm with
-- the accountant).
create or replace function public.deal_feasos_defaults()
returns trigger
language plpgsql
as $$
declare d public.deals%rowtype;
begin
  select * into d from public.deals where id = new.deal_id;
  if tg_op = 'INSERT' then
    new.version := coalesce((select max(f.version) from public.deal_feasos f where f.deal_id = new.deal_id), 0) + 1;
    new.owner_id := coalesce(new.owner_id, d.owner_id);
  end if;
  new.lots             := coalesce(new.lots, d.yield_count);
  new.land_price       := coalesce(new.land_price, d.asking_price);
  new.sales_gst_method := coalesce(new.sales_gst_method,
                                   case when d.purchase_tax_type = 'gst' then 'full_gst'::public.sales_gst_method
                                        else 'margin_scheme'::public.sales_gst_method end);
  if new.lots is null or new.land_price is null then
    raise exception 'Quick Feaso needs the number of lots and the land price (set them on the deal or in the feaso)';
  end if;
  return new;
end;
$$;

create trigger deal_feasos_defaults before insert or update on public.deal_feasos
  for each row execute function public.deal_feasos_defaults();

-- New offer: number it per deal and start the property line from the deal.
create or replace function public.deal_offers_defaults()
returns trigger
language plpgsql
as $$
declare d public.deals%rowtype;
begin
  select * into d from public.deals where id = new.deal_id;
  if tg_op = 'INSERT' then
    new.offer_no := coalesce((select max(o.offer_no) from public.deal_offers o where o.deal_id = new.deal_id), 0) + 1;
    new.owner_id := coalesce(new.owner_id, d.owner_id);
    new.property_text := coalesce(nullif(trim(new.property_text), ''),
                                  concat_ws(E'\n', d.address, nullif('(' || d.lot_plan || ')', '()')));
  end if;
  if new.status = 'accepted' then
    new.accepted_on := coalesce(new.accepted_on, public.today_syd());
  end if;
  if new.status in ('sent', 'countered', 'accepted') then
    new.sent_on := coalesce(new.sent_on, new.accepted_on, public.today_syd());
  end if;
  return new;
end;
$$;

create trigger deal_offers_defaults before insert or update on public.deal_offers
  for each row execute function public.deal_offers_defaults();

-- A deal that became a project is the project's history (its feaso and offer
-- are linked from the project): it can't be deleted.
create or replace function public.deals_keep_converted()
returns trigger
language plpgsql
as $$
begin
  if old.project_id is not null then
    raise exception 'Deal "%" became project %, so it is kept as that project''s history.', old.address, old.project_id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger deals_keep_converted before delete on public.deals
  for each row execute function public.deals_keep_converted();

-- File a generated letter of offer.  The app builds the PDF in the browser
-- from v_offer_letters, calls this to get the document row (type "Letter of
-- offer", standard name, .pdf or .docx from letter_format), uploads the file
-- to the returned storage_path, and the offer now points at it.  Each call
-- files a new copy (earlier letters stay as documents).  On a deal that has
-- already become a project, the letter is filed on the project (stage 1).
--   select * from public.file_offer_letter('<offer uuid>');
--   -> document_id, storage_path 'deals/<deal>/offer/Deal-21TynanRdTabletop_LetterOfOffer_Offer1_2026-11-17.pdf'
create or replace function public.file_offer_letter(p_offer_id uuid)
returns table (document_id uuid, storage_path text)
language plpgsql
as $$
#variable_conflict use_column
declare
  o      public.deal_offers%rowtype;
  d      public.deals%rowtype;
  v_doc  public.documents%rowtype;
  v_ext  text;
begin
  select * into o from public.deal_offers where id = p_offer_id;
  if not found then raise exception 'Offer % not found', p_offer_id; end if;
  select * into d from public.deals where id = o.deal_id;
  v_ext := o.letter_format::text;

  insert into public.documents (owner_id, deal_id, project_id, stage_id, doc_type, party, doc_date,
                                original_name, file_ext, mime_type)
  values (o.owner_id,
          case when d.project_id is null then d.id end,
          d.project_id,
          case when d.project_id is not null then
            (select ps.id from public.project_stages ps where ps.project_id = d.project_id order by ps.position limit 1) end,
          'offer', 'Offer' || o.offer_no, coalesce(o.sent_on, public.today_syd()),
          'Letter of offer ' || o.offer_no || '.' || v_ext, v_ext,
          case o.letter_format when 'pdf' then 'application/pdf'
               else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' end)
  returning * into v_doc;

  update public.deal_offers set document_id = v_doc.id where id = p_offer_id;
  return query select v_doc.id, v_doc.storage_path;
end;
$$;

-- (i4) CONTACT ROLES: rename = a plain UPDATE of name (contacts link by id,
-- so they follow).  Delete: refused while contacts use it, unless you name a
-- role to move them to.
--   select public.delete_contact_role('<Plasterer id>', '<Plastering id>');
create or replace function public.delete_contact_role(p_role_id uuid, p_move_to_role_id uuid default null)
returns integer      -- contacts moved
language plpgsql
as $$
declare
  v_name  text;
  v_used  integer;
  v_moved integer := 0;
begin
  select name into v_name from public.contact_roles where id = p_role_id;
  if not found then raise exception 'Role % not found', p_role_id; end if;
  select count(*) into v_used from public.contact_role_links where role_id = p_role_id;
  if v_used > 0 and p_move_to_role_id is null then
    raise exception 'Role "%" is used by % contact(s). Choose a role to move them to first.', v_name, v_used
      using errcode = 'foreign_key_violation';
  end if;
  if p_move_to_role_id = p_role_id then
    raise exception 'Pick a different role to move the contacts to';
  end if;
  if v_used > 0 then
    insert into public.contact_role_links (contact_id, role_id, owner_id)
    select l.contact_id, p_move_to_role_id, l.owner_id
    from public.contact_role_links l where l.role_id = p_role_id
    on conflict do nothing;
    get diagnostics v_moved = row_count;
    delete from public.contact_role_links where role_id = p_role_id;
  end if;
  delete from public.contact_roles where id = p_role_id;
  return v_moved;
end;
$$;

-- (j) COMPANIES: who owns a project, and closing a company.

-- A closed company can't take on a project; Wellco itself (the project
-- manager) can't own one.  When the owner changes, write a plain-English log
-- line: "Owner assigned: Dan Wellman and/or nominee -> 22 Peel Street Pty Ltd".
create or replace function public.projects_check_company()
returns trigger
language plpgsql
as $$
declare c public.companies%rowtype;
begin
  if new.owner_company_id is not null
     and (tg_op = 'INSERT' or new.owner_company_id is distinct from old.owner_company_id) then
    select * into c from public.companies where id = new.owner_company_id;
    if c.status = 'closed' then
      raise exception '% is closed and can''t own project %', c.legal_name, new.project_id using errcode = 'check_violation';
    end if;
    if c.is_project_manager then
      raise exception '% is the project manager, not a project company. Register a company for %.', c.legal_name, new.project_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_check_company before insert or update of owner_company_id on public.projects
  for each row execute function public.projects_check_company();

create or replace function public.projects_log_company_change()
returns trigger
language plpgsql
as $$
declare
  v_from text;
  v_to   text;
begin
  select legal_name into v_from from public.companies where id = old.owner_company_id;
  select legal_name into v_to   from public.companies where id = new.owner_company_id;
  insert into public.activity_log (owner_id, project_id, action, entity_type, entity_id, summary, details, source)
  values (new.owner_id, new.project_id, 'project.company_assigned', 'projects', new.project_id,
          format('Owner assigned: %s -> %s. Transactions now sit with %s.',
                 coalesce(v_from, old.interim_owner_name), coalesce(v_to, new.interim_owner_name),
                 coalesce(v_to, new.interim_owner_name)),
          jsonb_build_object('from_company_id', old.owner_company_id, 'to_company_id', new.owner_company_id),
          'auto');
  return null;
end;
$$;

create trigger projects_log_company_change after update of owner_company_id on public.projects
  for each row when (old.owner_company_id is distinct from new.owner_company_id)
  execute function public.projects_log_company_change();

-- Close a company once its bonds are back.  Refuses while it still owns a live
-- project (close the project first).  The status change is logged.
--   select public.close_company('<company uuid>', '2027-03-31');
create or replace function public.close_company(p_company_id uuid, p_closed_on date default null)
returns void
language plpgsql
as $$
declare v_live text;
begin
  select string_agg(p.project_id, ', ') into v_live
  from public.projects p where p.owner_company_id = p_company_id and p.status = 'live';
  if v_live is not null then
    raise exception 'Company still owns live project(s): %. Close them first.', v_live using errcode = 'check_violation';
  end if;
  update public.companies
     set status = 'closed', closed_on = coalesce(p_closed_on, closed_on, public.today_syd()), bas_cycle = 'not_lodging'
   where id = p_company_id;
  if not found then raise exception 'Company % not found', p_company_id; end if;
end;
$$;

-- (k) DAN'S DEFAULT LISTS.  Run once per user at sign-up (and below for any
--     user that already exists).  Only fills what's missing, so it never
--     overwrites Dan's own edits.  Edit the lists here before go-live if Dan
--     wants different defaults.
create or replace function public.seed_owner_defaults(p_owner uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_owner is null then raise exception 'seed_owner_defaults: owner id is required'; end if;
  perform public.set_quiet_log(true);

  -- project types
  insert into public.project_types (owner_id, code, name, sort_order) values
    (p_owner, 'land_subdivision',      'Land subdivision',        1),
    (p_owner, 'commercial_industrial', 'Commercial / industrial', 2),
    (p_owner, 'residential_build',     'Residential build',       3)
  on conflict do nothing;

  -- stage templates: land subdivision and commercial / industrial share the
  -- 9-stage list; residential build has 8.  Only for types with no stages yet.
  insert into public.stage_templates (owner_id, project_type, position, stage_key, name, description)
  select p_owner, s.project_type, s.position, s.stage_key, s.name, s.description
  from (
    select t.project_type, n.*
    from (values ('land_subdivision'), ('commercial_industrial')) t(project_type)
    cross join (values
      (1, 'sourcing',      'Sourcing',                     'Site found via listing or buyer''s agent; log the site and drop the agent''s contract, plans and sales evidence on the deal.'),
      (2, 'feasibility',   'Feasibility',                  'Feaso (Feasely); go / no-go.'),
      (3, 'acquisition',   'Acquisition & DD',             'Offer, deposit, solicitor, due diligence; register project company (ABN, GST, bank); exchange; settlement.'),
      (4, 'consultants',   'Consultants',                  'Planner, surveyor, civil engineer, geotech, ecology, bushfire, flooding. 3 quotes each.'),
      (5, 'approval',      'Development Approval',         'Lodge DA, respond to RFIs, pay council fees, DA conditions.'),
      (6, 'construction',  'Construction',                 'Tender civils, electrical, NBN, landscaping (3 quotes each); monthly claims; WAE.'),
      (7, 'certification', 'Certification & Registration', 'Sign-offs before settlement: certifier, surveyor, town planner, NBN, bank consent / discharge, council final sign-off and subdivision certificate, plan registration (NSW LRS / Titles Queensland). Contributions and bonds: see Funds needed.'),
      (8, 'sales',         'Sales & Settlements',          'Appoint agent(s), sell lots / units, bundle settlements, discharge loans, GST margin scheme.'),
      (9, 'windup',        'Bonds & Wind-up',              'Maintenance bonds (~12 months), council inspection, bond return, final accounts, distribution to trust, deregister company.')
    ) n(position, stage_key, name, description)
    union all
    select 'residential_build', r.*
    from (values
      (1, 'sourcing',      'Sourcing',                     'Site found via listing or buyer''s agent; log the site and drop the agent''s contract, plans and sales evidence on the deal.'),
      (2, 'feasibility',   'Feasibility',                  'Feaso (Feasely); go / no-go.'),
      (3, 'acquisition',   'Acquisition & DD',             'Offer, deposit, solicitor, due diligence; register project company (ABN, GST, bank); exchange; settlement.'),
      (4, 'approval',      'Design & approvals',           'Architect / building designer, engineering, energy rating; DA or CDC; construction certificate.'),
      (5, 'construction',  'Construction',                 'Builder or trades (3 quotes each), home warranty insurance, progress claims, practical completion.'),
      (6, 'certification', 'Certification & Occupation',   'Final inspections and occupation certificate; certifier, utilities, bank consent; strata or subdivision registration if selling separately. Outstanding fees: see Funds needed.'),
      (7, 'sales',         'Sales & Settlements',          'Appoint agent, exchange, settle, discharge loans.'),
      (8, 'windup',        'Wind-up',                      'Defects period, final accounts, distribution to trust, deregister company.')
    ) r(position, stage_key, name, description)
  ) s
  where exists (select 1 from public.project_types pt where pt.owner_id = p_owner and pt.code = s.project_type)
    and not exists (select 1 from public.stage_templates x where x.owner_id = p_owner and x.project_type = s.project_type);

  -- template tasks.  applies_to: L = land + commercial, R = residential build, A = all three.
  insert into public.stage_template_tasks (owner_id, stage_template_id, title, lead_time_days, warning, sort_order)
  select p_owner, st.id, k.title, k.lead_time_days, k.warning, k.sort_order
  from (values
    ('A', 'sourcing',      1, 'Log the site: address, lot / plan, zoning, asking price, source', null::integer, null::text),
    ('A', 'sourcing',      2, 'Drop the agent''s contract, plans and area sales evidence on the deal', null, null),
    ('A', 'sourcing',      3, 'Check title for easements and services (e.g. a water main through the site)', null, null),
    ('A', 'feasibility',   1, 'Run the feaso (Feasely) and record the result', null, null),
    ('A', 'feasibility',   2, 'Check end values and likely yield with an agent', null, null),
    ('A', 'feasibility',   3, 'Go / no-go decision', null, null),
    ('A', 'acquisition',   1, 'Offer and deposit', null, null),
    ('A', 'acquisition',   2, 'Engage solicitor', null, null),
    ('A', 'acquisition',   3, 'Due diligence: title, contamination, services, flooding, bushfire', null, null),
    ('A', 'acquisition',   4, 'Register project company: ABN, GST, bank account', null, null),
    ('A', 'acquisition',   5, 'Exchange contracts', null, null),
    ('A', 'acquisition',   6, 'Settlement', null, null),
    ('L', 'consultants',   1, 'RFQ town planner (3 quotes)', null, null),
    ('L', 'consultants',   2, 'RFQ surveyor (3 quotes)', null, null),
    ('L', 'consultants',   3, 'RFQ civil engineer (3 quotes)', null, null),
    ('L', 'consultants',   4, 'RFQ geotech, ecology, bushfire, flooding and traffic as needed', null, null),
    ('L', 'consultants',   5, 'Engage consultants in the project company name', null, null),
    ('L', 'approval',      1, 'Lodge DA', null, null),
    ('L', 'approval',      2, 'Respond to council RFIs', null, null),
    ('L', 'approval',      3, 'Pay DA fees (GST-free)', null, null),
    ('L', 'approval',      4, 'Review DA conditions and add tasks for them', null, null),
    ('L', 'approval',      5, 'Apply for electricity connection', 90, '3-month lead time: apply as soon as DA lands'),
    ('L', 'construction',  1, 'Tender civil works (3 quotes)', null, null),
    ('L', 'construction',  2, 'Tender electrical reticulation (3 quotes)', null, null),
    ('L', 'construction',  3, 'NBN pit and pipe application', null, null),
    ('L', 'construction',  4, 'Tender landscaping and street trees (3 quotes)', null, null),
    ('L', 'construction',  5, 'Check monthly progress claims against engagements', null, null),
    ('L', 'construction',  6, 'Work-as-executed (WAE) survey and drawings', null, null),
    ('L', 'certification', 1, 'Total up funds needed before sign-off (contributions, bonds, fees)', null, null),
    ('L', 'certification', 2, 'Pay council contributions', null, null),
    ('L', 'certification', 3, 'Certifier sign-off', null, null),
    ('L', 'certification', 4, 'Surveyor and town planner sign-off', null, null),
    ('L', 'certification', 5, 'NBN and utility clearances', null, null),
    ('L', 'certification', 6, 'Bank consent / mortgage discharge arranged', null, null),
    ('L', 'certification', 7, 'Council final sign-off and subdivision certificate', null, null),
    ('L', 'certification', 8, 'Lodge plan for registration (NSW LRS / Titles Queensland)', null, null),
    ('A', 'sales',         1, 'Appoint agent(s)', null, null),
    ('A', 'sales',         2, 'Exchange contracts', null, null),
    ('A', 'sales',         3, 'Bundle settlements and discharge loans', null, null),
    ('A', 'sales',         4, 'GST on sales (margin scheme?): confirm with accountant', null, null),
    ('L', 'windup',        1, 'Maintenance bond lodged (about 12 months)', null, null),
    ('L', 'windup',        2, 'Council inspection and bond return', null, null),
    ('L', 'windup',        3, 'Final accounts to accountant', null, null),
    ('L', 'windup',        4, 'Distribution to trust', null, null),
    ('L', 'windup',        5, 'Deregister project company', null, null),
    ('R', 'approval',      1, 'Brief architect / building designer', null, null),
    ('R', 'approval',      2, 'Engineering and energy rating (BASIX / NatHERS)', null, null),
    ('R', 'approval',      3, 'Lodge DA or CDC', null, null),
    ('R', 'approval',      4, 'Construction certificate', null, null),
    ('R', 'approval',      5, 'Apply for electricity and water connections', 90, '3-month lead time: apply as soon as approval lands'),
    ('R', 'construction',  1, 'Tender builder or trades (3 quotes)', null, null),
    ('R', 'construction',  2, 'Home warranty insurance (icare HBCF / QBCC)', null, null),
    ('R', 'construction',  3, 'Check progress claims against the contract', null, null),
    ('R', 'construction',  4, 'Practical completion inspection', null, null),
    ('R', 'certification', 1, 'Total up funds needed before sign-off', null, null),
    ('R', 'certification', 2, 'Final inspections', null, null),
    ('R', 'certification', 3, 'Occupation certificate', null, null),
    ('R', 'certification', 4, 'Utility connections signed off', null, null),
    ('R', 'certification', 5, 'Bank consent / mortgage discharge arranged', null, null),
    ('R', 'certification', 6, 'Strata or subdivision registration (if selling separately)', null, null),
    ('R', 'windup',        1, 'Defects period', null, null),
    ('R', 'windup',        2, 'Final accounts to accountant', null, null),
    ('R', 'windup',        3, 'Distribution to trust', null, null),
    ('R', 'windup',        4, 'Deregister project company', null, null)
  ) k(applies_to, stage_key, sort_order, title, lead_time_days, warning)
  join public.stage_templates st
    on st.owner_id = p_owner and st.stage_key = k.stage_key
   and (k.applies_to = 'A'
        or (k.applies_to = 'L' and st.project_type in ('land_subdivision', 'commercial_industrial'))
        or (k.applies_to = 'R' and st.project_type = 'residential_build'))
  where not exists (select 1 from public.stage_template_tasks x where x.stage_template_id = st.id);

  -- default date rules on template tasks (Dan edits these in Settings):
  --   DD ends 60 days after exchange; settlement 120 days after DD ends
  --   (his most common terms); electricity application as soon as DA lands.
  update public.stage_template_tasks tt
     set anchor_milestone = r.milestone::public.task_milestone, offset_days = r.offset_days
    from public.stage_templates st,
         (values ('acquisition', 'Due diligence: title, contamination, services, flooding, bushfire', 'exchange',    60),
                 ('approval',    'Apply for electricity connection',                                'da_approval',  0),
                 ('approval',    'Review DA conditions and add tasks for them',                     'da_approval',  7),
                 ('approval',    'Apply for electricity and water connections',                     'da_approval',  0)
         ) r(stage_key, title, milestone, offset_days)
   where st.id = tt.stage_template_id and st.owner_id = p_owner
     and st.stage_key = r.stage_key and tt.title = r.title
     and tt.anchor_milestone is null and tt.depends_on_template_task_id is null;

  update public.stage_template_tasks tt
     set depends_on_template_task_id = dd.id, anchor_on = 'due', offset_days = 120
    from public.stage_template_tasks dd
   where tt.owner_id = p_owner and dd.stage_template_id = tt.stage_template_id
     and dd.title = 'Due diligence: title, contamination, services, flooding, bushfire'
     and tt.title = 'Settlement'
     and tt.anchor_milestone is null and tt.depends_on_template_task_id is null;

  -- zonings (only if Dan has none yet): common NSW Standard Instrument zones
  -- and Queensland planning scheme zones
  if not exists (select 1 from public.zonings z where z.owner_id = p_owner) then
    insert into public.zonings (owner_id, state, code, name, sort_order) values
      (p_owner, 'NSW', 'RU1', 'Primary Production',               1),
      (p_owner, 'NSW', 'RU2', 'Rural Landscape',                  2),
      (p_owner, 'NSW', 'RU4', 'Primary Production Small Lots',    3),
      (p_owner, 'NSW', 'RU5', 'Village',                          4),
      (p_owner, 'NSW', 'R1',  'General Residential',              5),
      (p_owner, 'NSW', 'R2',  'Low Density Residential',          6),
      (p_owner, 'NSW', 'R3',  'Medium Density Residential',       7),
      (p_owner, 'NSW', 'R5',  'Large Lot Residential',            8),
      (p_owner, 'NSW', 'E1',  'Local Centre',                     9),
      (p_owner, 'NSW', 'E3',  'Productivity Support',            10),
      (p_owner, 'NSW', 'E4',  'General Industrial',              11),
      (p_owner, 'NSW', 'E5',  'Heavy Industrial',                12),
      (p_owner, 'NSW', 'MU1', 'Mixed Use',                       13),
      (p_owner, 'NSW', 'C4',  'Environmental Living',            14),
      (p_owner, 'QLD', null,  'Low density residential',         21),
      (p_owner, 'QLD', null,  'Low-medium density residential',  22),
      (p_owner, 'QLD', null,  'Medium density residential',      23),
      (p_owner, 'QLD', null,  'Rural residential',               24),
      (p_owner, 'QLD', null,  'Emerging community',              25),
      (p_owner, 'QLD', null,  'Mixed use',                       26),
      (p_owner, 'QLD', null,  'Low impact industry',             27),
      (p_owner, 'QLD', null,  'Medium impact industry',          28),
      (p_owner, 'QLD', null,  'Rural',                           29);
  end if;

  -- offer term bank (only if Dan has none yet): his exact wording from page 2
  -- ("Term Bank") of "Letter of Offer template (21 Table top).docx".
  if not exists (select 1 from public.offer_terms t where t.owner_id = p_owner) then
    insert into public.offer_terms (owner_id, field, sort_order, wording) values
    (p_owner, 'deposit', 1, '$50,000 paid on contract exchange – refundable prior to satisfaction of DD. Balance to 5% upon satisfaction of DD.'),
    (p_owner, 'deposit', 2, '$10,000 paid on contract exchange – refundable prior to satisfaction of DD. Balance to 5% upon satisfaction of DD.'),
    (p_owner, 'deposit', 3, '$100,000 paid on contract exchange – refundable prior to satisfaction of DD. Balance to 10% upon satisfaction of DD.'),
    (p_owner, 'deposit', 4, '5% deposit paid in full on contract exchange – released to vendor only on satisfaction of DD.'),
    (p_owner, 'deposit', 5, '10% deposit on contract exchange – deposit bond acceptable to the vendor.'),
    (p_owner, 'deposit', 6, '$1 deposit on exchange (option structure), balance to 5% on satisfaction of DD.'),
    (p_owner, 'due_diligence', 1, '60 days from contract exchange date.'),
    (p_owner, 'due_diligence', 2, '60 days from the later of Contract exchange date, or receipt of all requested and relevant documents.'),
    (p_owner, 'due_diligence', 3, '90 days from the later of Contract exchange date, or receipt of all requested and relevant documents.'),
    (p_owner, 'due_diligence', 4, '120 days from the later of Contract exchange date, or receipt of all requested and relevant documents.'),
    (p_owner, 'due_diligence', 5, '30 days from Contract exchange date.'),
    (p_owner, 'due_diligence', 6, '60 days from Contract exchange date, with one 30-day extension at the purchaser’s election.'),
    (p_owner, 'due_diligence', 7, '60 days from exchange, expiring no earlier than 14 days after receipt of the final survey, geotechnical and contamination reports.'),
    (p_owner, 'due_diligence', 8, 'DD satisfied on exchange – due diligence completed prior to offer.'),
    (p_owner, 'settlement', 1, '120 days from Contract Unconditional date'),
    (p_owner, 'settlement', 2, '90 days from Contract Unconditional date'),
    (p_owner, 'settlement', 3, '180 days from Contract Unconditional date'),
    (p_owner, 'settlement', 4, '60 days from Contract Unconditional date'),
    (p_owner, 'settlement', 5, 'The later of 120 days from Contract Unconditional date, or determination of the DA'),
    (p_owner, 'settlement', 6, '14 days from registration of the plan of subdivision'),
    (p_owner, 'settlement', 7, 'Staged settlement – 50% at [stage 1], balance at [stage 2]'),
    (p_owner, 'settlement', 8, '60 Days from Satisfaction of DA Approval'),
    (p_owner, 'settlement', 9, '60 Days From issued of DA and Subdivision works Certificate or 12 Months from date of Exchange.'),
    (p_owner, 'condition', 1, 'Settlement is subject to receipt of satisfactory DA approval.'),
    (p_owner, 'condition', 2, 'Purchaser to have 7 days to review and advise of satisfaction of DA.'),
    (p_owner, 'condition', 3, 'Vendor to provide signed “owners consent to lodge DA” as part of contract exchange documentation.'),
    (p_owner, 'condition', 4, 'Vendor to allow Marketing Signage to be erected after satisfaction of Due Diligence.'),
    (p_owner, 'condition', 5, 'Access to site for purchaser’s consultants post exchange'),
    (p_owner, 'condition', 6, 'Receipt of all relevant reports and approvals on exchange of contract'),
    (p_owner, 'condition', 7, 'Comprehensive list of all consultants on contract exchange'),
    (p_owner, 'condition', 8, 'Vendor to provide all existing survey, geotechnical and contamination reports'),
    (p_owner, 'condition', 9, 'Subject to purchaser obtaining development consent for not less than XX lots'),
    (p_owner, 'condition', 10, 'Subject to satisfactory geotechnical and contamination investigation'),
    (p_owner, 'condition', 11, 'Subject to confirmation of servicing capacity – water, sewer, power and NBN'),
    (p_owner, 'condition', 12, 'Subject to purchaser’s finance approval'),
    (p_owner, 'condition', 13, 'Vendor to maintain the land in its current condition until settlement'),
    (p_owner, 'condition', 14, 'Contract to include a licence for early works following DA approval'),
    (p_owner, 'condition', 15, 'Subject to registration of the plan of subdivision for the balance land'),
    (p_owner, 'condition', 16, 'No further encumbrances or leases to be registered on title after exchange'),
    (p_owner, 'condition', 17, 'Contract Sunset date; 18 Month from Satisfaction of DA date with option in favour of Purchaser to extend Sunset Period an Extra 6 Months due to delays from 3rd Party authorities such as, but not limited to, (add Council) . Purchaser to pay additional $10,000, and released to Vendor, if an extension is Sought.'),
    (p_owner, 'solicitor', 1, 'To be advised once agreed.');
  end if;

  -- contact categories and roles (only if Dan has none yet)
  if not exists (select 1 from public.contact_categories c where c.owner_id = p_owner) then
    insert into public.contact_categories (owner_id, name, sort_order) values
      (p_owner, 'Consultants',           1),
      (p_owner, 'Civil contractors',     2),
      (p_owner, 'Building contractors',  3),
      (p_owner, 'Agents & advisers',     4),
      (p_owner, 'Council & government',  5),
      (p_owner, 'Banks & vendors',       6);

    insert into public.contact_roles (owner_id, category_id, name, sort_order)
    select p_owner, c.id, r.role_name, r.sort_order
    from (values
      ('Consultants',          1, 'Town planner'),
      ('Consultants',          2, 'Surveyor'),
      ('Consultants',          3, 'Civil engineer'),
      ('Consultants',          4, 'Geotechnical engineer'),
      ('Consultants',          5, 'Ecologist'),
      ('Consultants',          6, 'Bushfire consultant'),
      ('Consultants',          7, 'Flooding / stormwater engineer'),
      ('Consultants',          8, 'Traffic engineer'),
      ('Consultants',          9, 'Architect / building designer'),
      ('Consultants',         10, 'Certifier'),
      ('Civil contractors',    1, 'Civil contractor'),
      ('Civil contractors',    2, 'Electrical contractor'),
      ('Civil contractors',    3, 'NBN / telecoms'),
      ('Civil contractors',    4, 'Landscaping'),
      ('Civil contractors',    5, 'Water and sewer'),
      ('Building contractors', 1, 'Builder'),
      ('Building contractors', 2, 'Trades / subcontractor'),
      ('Agents & advisers',    1, 'Buyer''s agent'),
      ('Agents & advisers',    2, 'Real estate agent'),
      ('Agents & advisers',    3, 'Solicitor / conveyancer'),
      ('Agents & advisers',    4, 'Accountant'),
      ('Agents & advisers',    5, 'Valuer'),
      ('Council & government', 1, 'Council'),
      ('Council & government', 2, 'State government'),
      ('Council & government', 3, 'Utility authority'),
      ('Council & government', 4, 'Land registry (LRS / Titles Qld)'),
      ('Banks & vendors',      1, 'Bank'),
      ('Banks & vendors',      2, 'Lender'),
      ('Banks & vendors',      3, 'Vendor')
    ) r(category_name, sort_order, role_name)
    join public.contact_categories c on c.owner_id = p_owner and c.name = r.category_name;
  end if;

  -- Wellco Developments itself, as the project manager (fill in ABN etc. in Settings)
  if not exists (select 1 from public.companies c where c.owner_id = p_owner and c.is_project_manager) then
    insert into public.companies (owner_id, legal_name, short_name, status, gst_registered, is_project_manager, notes)
    values (p_owner, 'Wellco Developments Pty Ltd', 'Wellco', 'active', true, true,
            'Project manager. Stays on Xero; charges each project company the management fee.');
  end if;

  -- document types
  insert into public.document_types (owner_id, code, name, sort_order) values
    (p_owner, 'contract',        'Contract',           1),
    (p_owner, 'plans',           'Plans',              2),
    (p_owner, 'sales_evidence',  'Sales evidence',     3),
    (p_owner, 'planning_zoning', 'Planning / zoning',  4),
    (p_owner, 'report',          'Report',             5),
    (p_owner, 'quote',           'Quote',              6),
    (p_owner, 'engagement',      'Engagement',         7),
    (p_owner, 'bill',            'Bill',               8),
    (p_owner, 'sales_invoice',   'Sales invoice',      9),
    (p_owner, 'survey',          'Survey',            10),
    (p_owner, 'company',         'Company',           11),
    (p_owner, 'correspondence',  'Correspondence',    12),
    (p_owner, 'offer',           'Letter of offer',   13)
  on conflict do nothing;

  perform public.set_quiet_log(false);
end;
$$;

-- Not callable from the app (it runs at sign-up and from the SQL editor only).
revoke execute on function public.seed_owner_defaults(uuid) from public, anon, authenticated;

-- (l) New login => create Wellco settings row and default lists automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wellco_settings (owner_id) values (new.id)
  on conflict (owner_id) do nothing;
  perform public.seed_owner_defaults(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_wellco on auth.users;
create trigger on_auth_user_created_wellco after insert on auth.users
  for each row execute function public.handle_new_user();

-- ...and for any user that already exists when this script is run
insert into public.wellco_settings (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

select public.seed_owner_defaults(u.id) from auth.users u;


-- -----------------------------------------------------------------------------
-- 1.6  Views (ready-made answers for the screens and the Excel exports)
--      security_invoker = true means the view obeys the same RLS rules as the
--      tables underneath, so it only ever shows the logged-in owner's rows.
--      Every money view adds up BILL LINES, not bill headers.
-- -----------------------------------------------------------------------------

-- QUICK FEASO RESULTS: Dan's "Quick Feso Subdivision" spreadsheet, row for row.
-- Everything is worked at full precision and rounded only at the end (money to
-- the cent, margin on cost to 4 places), like Excel showing his sheet.
-- His sheet's fixed 30s and 29 now follow the lot count (and existing-lot credit).
--   Revenue:  lots x price; less agency %, legal per lot, GST on sales
--             (margin scheme = (revenue - land price) / 11).
--   Land:     price + stamp duty % + legals            = acquisition
--   Build:    (electrics + civils + landscaping) per lot x lots, + contingency %
--   Consult.: electrical design + other + engineer + surveyor per lot x lots + planning
--   Fees:     marketing + PM (monthly x months) + bond (% of civils) + accounting
--             + holding + council CC fee + s94 per lot x (lots - existing-lot credit)
--   Finance:  land debt = acquisition - equity, at the land rate for the land
--             loan months; construction debt = (total cost - equity) - land debt,
--             at the construction rate on half (average draw) for the construction
--             loan months; interest = debt x rate x months / 12 (12 months = his
--             sheet).  Establishment fee on both debts.
--   Net profit = net revenue - total cost inc finance; MoC = net profit / that.
-- Where his sheet would go below zero (equity bigger than the land cost, land
-- dearer than revenue) the debts / margin GST stop at $0.
create view public.v_deal_feasos
with (security_invoker = true) as
select
  f.id                                                             as feaso_id,
  f.deal_id,
  f.version,
  f.label,
  f.version = max(f.version) over (partition by f.deal_id)         as is_latest,
  f.created_at,
  f.lots,
  f.price_per_lot,
  f.sales_gst_method,
  -- revenue
  round(r.revenue, 2)                                              as revenue,
  round(r.agency, 2)                                               as agency,
  round(r.legal, 2)                                                as legal,
  round(r.gst_on_sales, 2)                                         as gst_on_sales,
  round(r.net_revenue, 2)                                          as net_revenue,
  -- costs
  round(c.stamp_duty, 2)                                           as stamp_duty,
  round(c.acquisition, 2)                                          as acquisition,
  round(c.construction_subtotal, 2)                                as construction_subtotal,
  round(c.contingency, 2)                                          as contingency,
  round(c.total_construction, 2)                                   as total_construction,
  round(c.surveyor, 2)                                             as surveyor,
  round(c.total_consultants, 2)                                    as total_consultants,
  round(c.project_mgmt, 2)                                         as project_mgmt,
  round(c.bond, 2)                                                 as bond,
  c.s94_lots,
  round(c.s94, 2)                                                  as s94,
  round(c.total_fees, 2)                                           as total_fees,
  round(c.total_cost, 2)                                           as total_cost,
  round(r.net_revenue - c.total_cost, 2)                           as gross_profit_before_finance,
  -- finance
  f.equity,
  f.land_loan_months,
  f.construction_loan_months,
  round(fi.funds_to_complete, 2)                                   as funds_to_complete,
  round(fi.land_debt, 2)                                           as land_debt,
  round(fi.land_interest, 2)                                       as land_interest,
  round(fi.construction_debt, 2)                                   as construction_debt,
  round(fi.construction_interest, 2)                               as construction_interest,
  round(fi.establishment_fee, 2)                                   as establishment_fee,
  round(fi.finance_costs, 2)                                       as finance_costs,
  round(c.total_cost + fi.finance_costs, 2)                        as total_cost_inc_finance,
  round(r.net_revenue - c.total_cost - fi.finance_costs, 2)        as net_profit,
  round((r.net_revenue - c.total_cost - fi.finance_costs) / nullif(c.total_cost + fi.finance_costs, 0), 4) as margin_on_cost,
  -- per lot (his column E)
  round(r.net_revenue / f.lots, 2)                                 as net_revenue_per_lot,
  round(c.acquisition / f.lots, 2)                                 as acquisition_per_lot,
  round(c.total_construction / f.lots, 2)                          as construction_per_lot,
  round(c.total_consultants / f.lots, 2)                           as consultants_per_lot,
  round((c.total_cost - c.acquisition) / f.lots, 2)                as cost_to_complete_per_lot,   -- his "Total cost" per lot: excludes the land
  round((c.total_cost + fi.finance_costs) / f.lots, 2)             as total_cost_inc_finance_per_lot,
  round((r.net_revenue - c.total_cost - fi.finance_costs) / f.lots, 2) as net_profit_per_lot
from public.deal_feasos f
cross join lateral (
  select x.revenue, x.agency, x.legal, x.gst_on_sales,
         x.revenue - x.agency - x.legal - x.gst_on_sales as net_revenue
  from (select f.lots * f.price_per_lot                              as revenue,
               f.agency_pct * f.lots * f.price_per_lot               as agency,
               f.legal_per_lot * f.lots                              as legal,
               case f.sales_gst_method
                 when 'margin_scheme' then greatest(f.lots * f.price_per_lot - f.land_price, 0) / 11
                 when 'full_gst'      then f.lots * f.price_per_lot / 11
                 else 0 end                                          as gst_on_sales) x
) r
cross join lateral (
  select y.*, y.acquisition + y.total_construction + y.total_consultants + y.total_fees as total_cost
  from (select
          f.land_price * f.stamp_duty_pct                                            as stamp_duty,
          f.land_price + f.land_price * f.stamp_duty_pct + f.land_legals             as acquisition,
          (f.electrics_comms_per_lot + f.civils_per_lot + f.landscaping_per_lot) * f.lots as construction_subtotal,
          (f.electrics_comms_per_lot + f.civils_per_lot + f.landscaping_per_lot) * f.lots * f.contingency_pct as contingency,
          (f.electrics_comms_per_lot + f.civils_per_lot + f.landscaping_per_lot) * f.lots * (1 + f.contingency_pct) as total_construction,
          f.surveyor_per_lot * f.lots                                                as surveyor,
          f.electrical_design + f.consultants_other + f.engineer
            + f.surveyor_per_lot * f.lots + f.planning                               as total_consultants,
          f.pm_fee_per_month * f.pm_months                                           as project_mgmt,
          f.civils_per_lot * f.lots * f.bond_pct_of_civils                           as bond,
          greatest(f.lots - f.existing_lot_credit, 0)                                as s94_lots,
          f.s94_per_lot * greatest(f.lots - f.existing_lot_credit, 0)                as s94,
          f.marketing + f.pm_fee_per_month * f.pm_months + f.civils_per_lot * f.lots * f.bond_pct_of_civils
            + f.accounting_admin + f.holding + f.council_cc_fee
            + f.s94_per_lot * greatest(f.lots - f.existing_lot_credit, 0)            as total_fees) y
) c
cross join lateral (
  select w.*,
         w.land_interest + w.construction_interest + w.establishment_fee as finance_costs
  from (select v.*,
               f.land_interest_rate * v.land_debt * f.land_loan_months / 12                     as land_interest,
               v.construction_debt * f.construction_interest_rate / 2 * f.construction_loan_months / 12 as construction_interest,
               f.establishment_fee_pct * (v.construction_debt + v.land_debt) as establishment_fee
        from (select c.total_cost - f.equity                                         as funds_to_complete,
                     greatest(c.acquisition - f.equity, 0)                           as land_debt,
                     greatest(c.total_cost - f.equity - greatest(c.acquisition - f.equity, 0), 0) as construction_debt) v
       ) w
) fi;

-- LETTER OF OFFER, laid out like Dan's Word template (page 1).
create view public.v_offer_letters
with (security_invoker = true) as
select
  o.id                                                              as offer_id,
  o.deal_id,
  o.offer_no,
  o.status,
  coalesce(o.sent_on, public.today_syd())                           as letter_date,
  'WELLCO DEVELOPMENTS'::text                                       as letterhead,
  'Letter of Offer'::text                                           as title,
  o.property_text                                                   as property_address,
  case when o.price is not null
       then '$ ' || to_char(o.price, 'FM999,999,999,990') || coalesce(' ' || nullif(trim(o.gst_wording), ''), '')
  end                                                               as price_line,
  o.purchaser,
  o.deposit,
  o.due_diligence,
  o.settlement,
  (select string_agg(u.n || '. ' || u.c, E'\n' order by u.n)
     from unnest(o.conditions) with ordinality as u(c, n))          as conditions_numbered,
  o.solicitor                                                       as purchaser_solicitor,
  'Dan Wellman'::text                                               as signatory_name,
  'Director'::text                                                  as signatory_title,
  'Wellco Developments PL'::text                                    as signatory_company,
  o.letter_format,
  o.document_id
from public.deal_offers o;

-- DEALS LIST: each deal with its zoning, latest Quick Feaso headline and offers.
create view public.v_deals
with (security_invoker = true) as
select
  d.*,
  concat_ws(' ', z.code, z.name)                                    as zoning_label,
  lf.version                                                        as feaso_version,
  lf.net_profit                                                     as feaso_net_profit,
  lf.margin_on_cost                                                 as feaso_margin_on_cost,
  coalesce(oc.offers, 0)                                            as offers,
  ao.offer_no                                                       as accepted_offer_no,
  ao.price                                                          as accepted_price,
  ao.exchange_on
from public.deals d
left join public.zonings z on z.id = d.zoning_id
left join lateral (
  select vf.version, vf.net_profit, vf.margin_on_cost
  from public.v_deal_feasos vf where vf.deal_id = d.id order by vf.version desc limit 1
) lf on true
left join lateral (select count(*) as offers from public.deal_offers o where o.deal_id = d.id) oc on true
left join public.deal_offers ao on ao.deal_id = d.id and ao.status = 'accepted';

-- STAGE STEPPER: a project's stages in order, numbered 1..n, with progress.
create view public.v_project_stages
with (security_invoker = true) as
select
  ps.id                                                             as stage_id,
  ps.project_id,
  row_number() over (partition by ps.project_id order by ps.position) as stage_no,
  ps.position,
  ps.name,
  ps.description,
  ps.stage_key,
  ps.id = p.current_stage_id                                        as is_current,
  coalesce(t.tasks, 0)                                              as tasks,
  coalesce(t.tasks_done, 0)                                         as tasks_done,
  coalesce(dc.documents, 0)                                         as documents
from public.project_stages ps
join public.projects p on p.project_id = ps.project_id
left join lateral (
  select count(*) as tasks, count(*) filter (where tk.done) as tasks_done
  from public.tasks tk where tk.stage_id = ps.id
) t on true
left join lateral (
  select count(*) as documents from public.documents d where d.stage_id = ps.id
) dc on true;

-- DOCUMENTS: with type name and stage, for "by stage" and "by type" folders.
create view public.v_documents
with (security_invoker = true) as
select
  d.*,
  dt.name           as doc_type_name,
  ps.name           as stage_name,
  ps.position       as stage_position,
  case when d.deal_id is not null then 'deal' else 'project' end as belongs_to
from public.documents d
left join public.document_types dt on dt.owner_id = d.owner_id and dt.code = d.doc_type
left join public.project_stages ps on ps.id = d.stage_id;

-- FUNDS NEEDED, item by item.  needed = the linked bill line's total once the
-- bill is in (the actual), else the estimate.  Paid = paid_on set, or the
-- linked bill is paid.  Amounts incl GST (cash to find) and ex GST.
create view public.v_funds_needed_items
with (security_invoker = true) as
select
  f.id,
  f.project_id,
  f.stage_id,
  ps.name                                                           as stage_name,
  f.description,
  f.contact_id,
  f.category,
  f.due_date,
  f.invoice_in_line_id,
  coalesce(l.total, f.total)                                        as needed_incl_gst,
  coalesce(l.amount_ex_gst, f.amount_ex_gst)                        as needed_ex_gst,
  (f.paid_on is not null or coalesce(ii.status = 'paid', false))   as is_paid,
  coalesce(f.paid_on, case when ii.status = 'paid' then ii.paid_on end) as paid_on
from public.funds_needed f
join public.project_stages ps on ps.id = f.stage_id
left join public.invoice_in_lines l on l.id = f.invoice_in_line_id
left join public.invoices_in ii on ii.id = l.invoice_id;

-- FUNDS NEEDED BEFORE SIGN-OFF: one row per project: total, paid, still to find.
create view public.v_funds_needed
with (security_invoker = true) as
select
  p.project_id,
  p.name,
  cert.id                                                                   as stage_id,
  cert.name                                                                 as stage_name,
  cert.position                                                             as stage_position,
  cur.position                                                              as current_stage_position,
  count(i.id)                                                               as items,
  count(i.id) filter (where not i.is_paid)                                  as items_unpaid,
  coalesce(sum(i.needed_incl_gst), 0)                                       as total_needed,
  coalesce(sum(i.needed_incl_gst) filter (where i.is_paid), 0)              as paid,
  coalesce(sum(i.needed_incl_gst) filter (where not i.is_paid), 0)          as still_to_find,
  coalesce(sum(i.needed_ex_gst), 0)                                         as total_needed_ex_gst,
  coalesce(sum(i.needed_ex_gst) filter (where not i.is_paid), 0)            as still_to_find_ex_gst,
  min(i.due_date) filter (where not i.is_paid)                              as next_due
from public.projects p
left join public.project_stages cert on cert.project_id = p.project_id and cert.stage_key = 'certification'
left join public.project_stages cur  on cur.id = p.current_stage_id
left join public.v_funds_needed_items i on i.project_id = p.project_id
group by p.project_id, p.name, cert.id, cert.name, cert.position, cur.position;

-- HOME SCREEN: one row per project: stage, next deadline, budget vs committed vs paid, overdue tasks.
--   committed = engagements issued/complete  +  approved/paid bill LINES with no engagement
--               (council fees, stamp duty and other one-off costs)
--   paid      = bill lines on bills marked paid
create view public.v_project_summary
with (security_invoker = true) as
select
  p.project_id,
  p.name,
  p.owner_company_id,
  coalesce(co.legal_name, p.interim_owner_name)                   as company_name,
  co.abn,
  co.status                                                       as company_status,
  p.state,
  p.project_type,
  pt.name                                                         as project_type_name,
  p.status,
  p.current_stage_id,
  cs.stage_no,
  cs.name                                                         as stage_name,
  coalesce(sc.stage_count, 0)                                     as stage_count,
  coalesce(nullif(b.budget_ex_gst, 0), p.budget, 0)               as budget_ex_gst,
  coalesce(e.engaged_ex_gst, 0) + coalesce(i.direct_ex_gst, 0)    as committed_ex_gst,
  coalesce(i.paid_ex_gst, 0)                                      as paid_ex_gst,
  coalesce(nullif(b.budget_ex_gst, 0), p.budget, 0)
    - (coalesce(e.engaged_ex_gst, 0) + coalesce(i.direct_ex_gst, 0)) as uncommitted_ex_gst,
  coalesce(fn.still_to_find, 0)                                   as funds_still_to_find,
  nt.due_on                                                       as next_deadline,
  nt.title                                                        as next_task,
  coalesce(t.open_tasks, 0)                                       as open_tasks,
  coalesce(t.overdue_tasks, 0)                                    as overdue_tasks,
  coalesce(t.lead_time_alerts, 0)                                 as lead_time_alerts,
  coalesce(a.pending_approvals, 0)                                as pending_approvals
from public.projects p
left join public.companies co on co.id = p.owner_company_id
left join public.project_types pt on pt.owner_id = p.owner_id and pt.code = p.project_type
left join lateral (
  select ps.name,
         (select count(*) from public.project_stages x
           where x.project_id = ps.project_id and x.position <= ps.position) as stage_no
  from public.project_stages ps where ps.id = p.current_stage_id
) cs on true
left join lateral (
  select count(*) as stage_count from public.project_stages ps where ps.project_id = p.project_id
) sc on true
left join lateral (
  select sum(bl.budget_ex_gst) as budget_ex_gst
  from public.budget_lines bl where bl.project_id = p.project_id
) b on true
left join lateral (
  select sum(en.value_ex_gst) as engaged_ex_gst
  from public.engagements en
  where en.project_id = p.project_id and en.status in ('issued', 'complete')
) e on true
left join lateral (
  select sum(l.amount_ex_gst) filter (where ii.engagement_id is null and ii.status in ('approved', 'paid')) as direct_ex_gst,
         sum(l.amount_ex_gst) filter (where ii.status = 'paid')                                             as paid_ex_gst
  from public.invoices_in ii
  join public.invoice_in_lines l on l.invoice_id = ii.id
  where ii.project_id = p.project_id
) i on true
left join public.v_funds_needed fn on fn.project_id = p.project_id
left join lateral (
  select count(*) filter (where not tk.done)                                                          as open_tasks,
         count(*) filter (where not tk.done and tk.due_on < public.today_syd())                     as overdue_tasks,
         count(*) filter (where not tk.done and tk.lead_time_days is not null
                            and tk.due_on - tk.lead_time_days <= public.today_syd() + 7)            as lead_time_alerts
  from public.tasks tk where tk.project_id = p.project_id
) t on true
left join lateral (
  select tk.due_on, tk.title
  from public.tasks tk
  where tk.project_id = p.project_id and not tk.done and tk.due_on is not null
  order by tk.due_on, tk.sort_order
  limit 1
) nt on true
left join lateral (
  select count(*) as pending_approvals
  from public.approvals ap where ap.project_id = p.project_id and ap.status = 'pending'
) a on true;

-- WHO ISSUES IT: the name, ABN, address and bank every issued document for a
-- project uses (RFQs, engagement letters, POs, sales invoices, bills addressed
-- to).  Before a company is assigned it reads "Dan Wellman and/or nominee".
create view public.v_project_issuer
with (security_invoker = true) as
select
  p.project_id,
  p.owner_company_id                                    as company_id,
  coalesce(c.legal_name, p.interim_owner_name)          as issuer_name,
  c.short_name,
  c.abn,
  c.acn,
  c.registered_address,
  c.gst_registered,
  c.bank_name,
  c.bank_bsb,
  c.bank_account,
  c.status                                              as company_status,
  p.owner_company_id is null                            as is_interim
from public.projects p
left join public.companies c on c.id = p.owner_company_id;

-- GST / BAS building block: every approved / issued money LINE with its BAS
-- period and the company that owns the project.  Uses invoice date (accruals
-- basis).  If the accountant lodges on a CASH basis, swap invoice_date for
-- paid_on below.
--   ATO labels:  G1 = total sales (incl GST)   1A = GST on sales (collected)
--                G11 = purchases (incl GST)    1B = GST on purchases (credits)
create view public.v_bas_lines
with (security_invoker = true) as
with lines as (
  select ii.project_id, ii.fy, ii.bas_quarter, public.au_quarter_start(ii.invoice_date) as quarter_start,
         0::numeric        as sales_incl_gst,
         0::numeric        as gst_collected,
         0::numeric        as margin_scheme_sales,
         0::numeric        as gst_free_sales,
         l.total           as purchases_incl_gst,
         l.gst_amount      as gst_paid,
         case when l.gst_treatment = 'gst_free'    then l.amount_ex_gst else 0 end as gst_free_spend,
         case when l.gst_treatment = 'input_taxed' then l.amount_ex_gst else 0 end as input_taxed_spend
  from public.invoices_in ii
  join public.invoice_in_lines l on l.invoice_id = ii.id
  where ii.status in ('approved', 'paid')
  union all
  select io.project_id, io.fy, io.bas_quarter, public.au_quarter_start(io.invoice_date),
         l.total,
         l.gst_amount,
         case when l.gst_treatment = 'margin_scheme' then l.total else 0 end,
         case when l.gst_treatment in ('gst_free', 'input_taxed') then l.total else 0 end,
         0, 0, 0, 0
  from public.invoices_out io
  join public.invoice_out_lines l on l.invoice_id = io.id
  where io.status in ('issued', 'paid')
)
select l.*, p.owner_company_id as company_id
from lines l
join public.projects p on p.project_id = l.project_id;

-- BAS PER COMPANY PER QUARTER (one BAS workbook each): across all of that
-- company's projects.  A project with no company yet shows under company_id
-- null, "Dan Wellman and/or nominee": assign the company before lodging.
create view public.v_bas_summary
with (security_invoker = true) as
select
  l.company_id,
  coalesce(c.legal_name, 'Dan Wellman and/or nominee (no company assigned)') as company_name,
  c.abn,
  c.bas_cycle,
  l.fy,
  l.bas_quarter,
  l.fy || ' ' || l.bas_quarter                       as period,       -- 'FY2025-26 Q2'
  l.quarter_start,
  (l.quarter_start + interval '3 months - 1 day')::date as quarter_end,
  array_agg(distinct l.project_id order by l.project_id) as projects,
  sum(l.sales_incl_gst)                              as sales_incl_gst_g1,
  sum(l.gst_collected)                               as gst_collected_1a,
  sum(l.margin_scheme_sales)                         as margin_scheme_sales,
  sum(l.gst_free_sales)                              as gst_free_sales,
  sum(l.purchases_incl_gst)                          as purchases_incl_gst_g11,
  sum(l.gst_paid)                                    as gst_paid_1b,
  sum(l.gst_free_spend)                              as gst_free_spend,
  sum(l.input_taxed_spend)                           as input_taxed_spend,
  sum(l.gst_collected) - sum(l.gst_paid)             as net_gst           -- positive = pay ATO, negative = refund
from public.v_bas_lines l
left join public.companies c on c.id = l.company_id
group by l.company_id, c.legal_name, c.abn, c.bas_cycle, l.fy, l.bas_quarter, l.quarter_start;

-- The same figures split by project (for the project workbook's GST-BAS tab).
create view public.v_bas_by_project
with (security_invoker = true) as
select
  l.project_id,
  l.company_id,
  l.fy,
  l.bas_quarter,
  l.fy || ' ' || l.bas_quarter                       as period,
  l.quarter_start,
  sum(l.sales_incl_gst)                              as sales_incl_gst_g1,
  sum(l.gst_collected)                               as gst_collected_1a,
  sum(l.margin_scheme_sales)                         as margin_scheme_sales,
  sum(l.gst_free_sales)                              as gst_free_sales,
  sum(l.purchases_incl_gst)                          as purchases_incl_gst_g11,
  sum(l.gst_paid)                                    as gst_paid_1b,
  sum(l.gst_free_spend)                              as gst_free_spend,
  sum(l.input_taxed_spend)                           as input_taxed_spend,
  sum(l.gst_collected) - sum(l.gst_paid)             as net_gst
from public.v_bas_lines l
group by l.project_id, l.company_id, l.fy, l.bas_quarter, l.quarter_start;

-- QUARTER END CHECKLIST: every project company for every quarter it existed
-- (formed / first transaction -> closed or today), with what to do:
--   lodge             there's activity: lodge a BAS from v_bas_summary
--   nil_bas           registered for GST and lodging quarterly, but no activity
--   nothing_to_lodge  dormant / not lodging yet / not GST registered, and no activity
-- e.g.  select * from v_bas_company_quarters where period = 'FY2026-27 Q2';
create view public.v_bas_company_quarters
with (security_invoker = true) as
select
  c.id                                               as company_id,
  c.legal_name                                       as company_name,
  c.status,
  c.bas_cycle,
  c.gst_registered,
  public.au_fy(q.quarter_start::date) || ' ' || public.au_bas_quarter(q.quarter_start::date) as period,
  q.quarter_start::date                              as quarter_start,
  b.period is not null                               as has_activity,
  case
    when b.period is not null then 'lodge'
    when c.gst_registered and c.bas_cycle = 'quarterly' and c.status <> 'dormant' then 'nil_bas'
    else 'nothing_to_lodge'
  end                                                as to_do,
  coalesce(b.net_gst, 0)                             as net_gst
from public.companies c
cross join lateral generate_series(
  public.au_quarter_start(least(coalesce(c.formed_on, c.created_at::date),
                                coalesce((select min(l.quarter_start) from public.v_bas_lines l where l.company_id = c.id),
                                         'infinity'::date))),
  public.au_quarter_start(coalesce(c.closed_on, public.today_syd())),
  interval '3 months') as q(quarter_start)
left join public.v_bas_summary b on b.company_id = c.id and b.quarter_start = q.quarter_start::date
where not c.is_project_manager;

-- MONEY TAB: budget vs committed vs paid by cost category, from bill LINES.
-- category is null for costs not yet allocated ("Unallocated").
create view public.v_budget_vs_actual
with (security_invoker = true) as
with b as (
  select project_id, category, sum(budget_ex_gst) as budget_ex_gst
  from public.budget_lines group by project_id, category
),
c as (
  select x.project_id, x.category, sum(x.amount) as committed_ex_gst
  from (
    select en.project_id, bl.category, en.value_ex_gst as amount
    from public.engagements en
    left join public.budget_lines bl on bl.id = en.budget_line_id
    where en.status in ('issued', 'complete')
    union all
    select l.project_id, l.category, l.amount_ex_gst
    from public.invoices_in ii
    join public.invoice_in_lines l on l.invoice_id = ii.id
    where ii.engagement_id is null and ii.status in ('approved', 'paid')
  ) x
  group by x.project_id, x.category
),
pd as (
  -- a progress claim's lines take its engagement's budget category unless given one
  select l.project_id, l.category, sum(l.amount_ex_gst) as paid_ex_gst
  from public.invoices_in ii
  join public.invoice_in_lines l on l.invoice_id = ii.id
  where ii.status = 'paid'
  group by l.project_id, l.category
),
k as (
  select project_id, category from b
  union select project_id, category from c
  union select project_id, category from pd
)
select
  k.project_id,
  k.category,
  coalesce(b.budget_ex_gst, 0)                                as budget_ex_gst,
  coalesce(c.committed_ex_gst, 0)                             as committed_ex_gst,
  coalesce(pd.paid_ex_gst, 0)                                 as paid_ex_gst,
  coalesce(b.budget_ex_gst, 0) - coalesce(c.committed_ex_gst, 0) as variance_ex_gst   -- negative = over budget
from k
left join b  on b.project_id  = k.project_id and b.category  is not distinct from k.category
left join c  on c.project_id  = k.project_id and c.category  is not distinct from k.category
left join pd on pd.project_id = k.project_id and pd.category is not distinct from k.category;

-- RFQs: quotes count per scope, minimum-3 check, the winner.
create view public.v_rfq_status
with (security_invoker = true) as
select
  r.id                                                        as rfq_scope_id,
  r.project_id,
  r.stage_id,
  r.name,
  r.status,
  r.min_quotes,
  count(q.id)                                                 as quotes_requested,
  count(q.id) filter (where q.status = 'received')            as quotes_received,
  count(q.id) filter (where q.status = 'received') >= r.min_quotes as meets_minimum,
  min(q.amount_ex_gst) filter (where q.status = 'received')   as lowest_ex_gst,
  max(q.amount_ex_gst) filter (where q.status = 'received')   as highest_ex_gst,
  (array_agg(q.contact_id) filter (where q.chosen))[1]        as chosen_contact_id,
  (array_agg(q.amount_ex_gst) filter (where q.chosen))[1]     as chosen_ex_gst,
  (array_agg(q.chosen_reason) filter (where q.chosen))[1]     as chosen_reason
from public.rfq_scopes r
left join public.quotes q on q.rfq_scope_id = r.id
group by r.id, r.project_id, r.stage_id, r.name, r.status, r.min_quotes;

-- ENGAGEMENTS: % claimed against each engagement (from bill lines).
create view public.v_engagement_progress
with (security_invoker = true) as
select
  en.id                                                     as engagement_id,
  en.project_id,
  en.contact_id,
  en.reference,
  en.scope,
  en.status,
  en.value_ex_gst,
  coalesce(x.claimed_ex_gst, 0)                             as claimed_ex_gst,
  coalesce(x.paid_ex_gst, 0)                                as paid_ex_gst,
  case when en.value_ex_gst > 0
       then round(100 * coalesce(x.claimed_ex_gst, 0) / en.value_ex_gst, 1)
  end                                                       as pct_claimed
from public.engagements en
left join lateral (
  select sum(l.amount_ex_gst) filter (where ii.status in ('approved', 'paid')) as claimed_ex_gst,
         sum(l.amount_ex_gst) filter (where ii.status = 'paid')               as paid_ex_gst
  from public.invoices_in ii
  join public.invoice_in_lines l on l.invoice_id = ii.id
  where ii.engagement_id = en.id
) x on true;

-- CONTACTS: roles, categories, projects worked on + licence / insurance expiring within 60 days.
-- List them alphabetically:  order by sort_name, name
create view public.v_contacts
with (security_invoker = true) as
select
  c.*,
  lower(coalesce(nullif(trim(c.company), ''), c.name))               as sort_name,
  coalesce((
    select array_agg(r.name order by cc.sort_order, r.sort_order)
    from public.contact_role_links crl
    join public.contact_roles r       on r.id = crl.role_id
    join public.contact_categories cc on cc.id = r.category_id
    where crl.contact_id = c.id
  ), '{}')                                                            as role_names,
  coalesce((
    select array_agg(x.name order by x.sort_order)
    from (
      select cc.name, cc.sort_order
      from public.contact_role_links crl
      join public.contact_roles r       on r.id = crl.role_id
      join public.contact_categories cc on cc.id = r.category_id
      where crl.contact_id = c.id
      union
      select cc.name, cc.sort_order
      from public.contact_extra_categories ce
      join public.contact_categories cc on cc.id = ce.category_id
      where ce.contact_id = c.id
    ) x
  ), '{}')                                                            as category_names,
  coalesce((
    select array_agg(distinct x.project_id order by x.project_id)
    from (
      select q.project_id  from public.quotes q       where q.contact_id = c.id
      union select e.project_id  from public.engagements e  where e.contact_id = c.id
      union select ii.project_id from public.invoices_in ii where ii.contact_id = c.id
    ) x
  ), '{}')                                                            as projects,
  c.licence_expiry   is not null and c.licence_expiry   < public.today_syd() + 60 as licence_expiring,
  c.insurance_expiry is not null and c.insurance_expiry < public.today_syd() + 60 as insurance_expiring
from public.contacts c;

-- CONTACTS BY CATEGORY (the Contacts screen's branches).  A contact appears
-- under the category of each of its roles, and under any extra category.
create view public.v_contacts_by_category
with (security_invoker = true) as
select
  cc.id                                                        as category_id,
  cc.name                                                      as category_name,
  cc.sort_order                                                as category_sort,
  c.id                                                         as contact_id,
  c.name,
  c.company,
  lower(coalesce(nullif(trim(c.company), ''), c.name))           as sort_name,
  coalesce(array_agg(distinct r.name) filter (where r.id is not null), '{}') as roles_in_category,
  bool_or(x.via_extra)                                         as added_directly
from (
  select crl.contact_id, r.category_id, r.id as role_id, false as via_extra
  from public.contact_role_links crl join public.contact_roles r on r.id = crl.role_id
  union all
  select ce.contact_id, ce.category_id, null::uuid, true
  from public.contact_extra_categories ce
) x
join public.contact_categories cc on cc.id = x.category_id
join public.contacts c            on c.id = x.contact_id
left join public.contact_roles r  on r.id = x.role_id
group by cc.id, cc.name, cc.sort_order, c.id, c.name, c.company;

-- HOME "NEEDS YOU TODAY": everything that needs a decision or a chase, in one list.
create view public.v_needs_attention
with (security_invoker = true) as
-- approvals waiting
select 1 as priority, 'approval'::text as item_type, ap.project_id, ap.title,
       null::text as detail, ap.requested_at::date as due_date, 'approvals'::text as entity_type, ap.id as entity_id
from public.approvals ap where ap.status = 'pending'
union all
-- overdue tasks
select 2, 'overdue_task', tk.project_id, tk.title, tk.warning, tk.due_on, 'tasks', tk.id
from public.tasks tk where not tk.done and tk.due_on < public.today_syd()
union all
-- lead-time warnings: time to start (due date minus lead time is within 7 days)
select 3, 'lead_time', tk.project_id, tk.title,
       coalesce(tk.warning, tk.lead_time_days || '-day lead time'),
       tk.due_on - tk.lead_time_days, 'tasks', tk.id
from public.tasks tk
where not tk.done and tk.lead_time_days is not null and tk.due_on >= public.today_syd()
  and tk.due_on - tk.lead_time_days <= public.today_syd() + 7
union all
-- tasks due in the next 7 days
select 4, 'due_soon', tk.project_id, tk.title, tk.warning, tk.due_on, 'tasks', tk.id
from public.tasks tk
where not tk.done and tk.due_on between public.today_syd() and public.today_syd() + 7
  and tk.lead_time_days is null
union all
-- quotes requested more than 7 days ago with no reply (and not chased in the last 7 days)
select 5, 'chase_quote', q.project_id,
       'Chase quote: ' || coalesce(ct.company, ct.name) || ' (' || r.name || ')',
       'Requested ' || to_char(q.requested_at, 'DD Mon'), q.requested_at + 7, 'quotes', q.id
from public.quotes q
join public.rfq_scopes r on r.id = q.rfq_scope_id
join public.contacts ct on ct.id = q.contact_id
where q.status = 'requested'
  and q.requested_at < public.today_syd() - 7
  and coalesce(q.last_chased_at, q.requested_at) < public.today_syd() - 7
union all
-- bills due in the next 7 days (or overdue) and not paid; amount = sum of its lines
select 6, 'invoice_due', ii.project_id,
       'Pay: ' || ii.description,
       '$' || to_char(coalesce((select sum(l.total) from public.invoice_in_lines l where l.invoice_id = ii.id), 0),
                      'FM999,999,990.00'),
       ii.due_date, 'invoices_in', ii.id
from public.invoices_in ii
where ii.status <> 'paid' and ii.due_date <= public.today_syd() + 7
union all
-- money still to find before sign-off, once the project is at Construction or later
select 7, 'funds_needed', fn.project_id,
       'Funds needed before sign-off: $' || to_char(fn.still_to_find, 'FM999,999,990.00') || ' still to find',
       fn.items_unpaid || ' item(s) unpaid of $' || to_char(fn.total_needed, 'FM999,999,990.00'),
       fn.next_due, 'funds_needed', null::uuid
from public.v_funds_needed fn
where fn.still_to_find > 0 and fn.current_stage_position >= fn.stage_position - 1
union all
-- contractor licence / insurance expiring in 60 days
select 8, 'contact_expiry', null, coalesce(c.company, c.name) || ': licence or insurance expiring',
       'Licence ' || coalesce(to_char(c.licence_expiry, 'DD Mon YYYY'), 'n/a')
         || ', insurance ' || coalesce(to_char(c.insurance_expiry, 'DD Mon YYYY'), 'n/a'),
       least(c.licence_expiry, c.insurance_expiry), 'contacts', c.id
from public.contacts c
where c.licence_expiry < public.today_syd() + 60 or c.insurance_expiry < public.today_syd() + 60;


-- -----------------------------------------------------------------------------
-- 1.7  Security: Row Level Security (RLS)
--      Only the logged-in owner sees or changes their rows.  The anon (public)
--      key alone can read nothing.  Sign-ups must be switched OFF in Supabase
--      after Dan's user is created (README step A5).
-- -----------------------------------------------------------------------------
-- Owner can do everything on their own rows (same policy on every main table).
-- (select auth.uid()) is wrapped in a sub-select so Postgres works it out once per query, not per row.
do $$
declare t text;
begin
  foreach t in array array['wellco_settings', 'project_types', 'stage_templates', 'stage_template_tasks',
                           'contact_categories', 'contact_roles', 'document_types', 'companies',
                           'zonings', 'offer_terms', 'deal_feasos', 'deal_offers',
                           'contacts', 'contact_role_links', 'contact_extra_categories',
                           'projects', 'project_stages', 'deals', 'tasks', 'budget_lines',
                           'documents', 'rfq_scopes', 'quotes', 'engagements', 'invoices_in',
                           'invoice_in_lines', 'invoices_out', 'invoice_out_lines', 'funds_needed', 'approvals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Owner full access" on public.%I
         for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Activity log: read and add only.  No update or delete policy = log can't be altered.
alter table public.activity_log enable row level security;
create policy "Owner reads log" on public.activity_log
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owner adds to log" on public.activity_log
  for insert to authenticated with check (owner_id = (select auth.uid()));

commit;


-- #############################################################################
-- PART 2  -  FILE STORAGE (any file type: PDF, Excel, Word, photos...)
--   Bucket : project-documents   (PRIVATE: files are opened with signed links;
--            no file-type restriction)
--   Paths  : <ProjectID>/<doc_type>/<ProjectID>_<DocType>_<Party>_<YYYY-MM-DD>.<ext>
--              e.g. CROOBYAR/quote/CROOBYAR_Quote_SouthcoastCivil_2026-10-14.pdf
--            deals/<deal_id>/<doc_type>/Deal-<Address>_<DocType>_<Party>_<YYYY-MM-DD>.<ext>
--              (files dropped on a deal; they stay at this path after the deal
--               becomes a project)
--   Rule   : you can only read / upload / change / delete a file inside a folder
--            named after one of YOUR projects, under deals/<one of YOUR deals>/,
--            or one that a document of yours points at.  Project IDs are upper
--            case, so the lower-case "deals" folder can't clash with a project.
--   Note   : deleting a project row does NOT delete its files.  Delete the
--            folder in Storage too if you really mean it (back it up first).
--   If this part errors (e.g. bucket already exists from the dashboard), the
--   database from PART 1 is already saved; fix and run just this part again
--   (it is safe to re-run).
-- #############################################################################
begin;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('project-documents', 'project-documents', false, null)
on conflict (id) do update set public = false, allowed_mime_types = null;

-- Who may touch a file at this path.  Runs as the logged-in user, so the
-- projects / deals / documents lookups only see their own rows (RLS).
create or replace function public.can_access_document_path(p_name text)
returns boolean
language sql stable
as $$
  select case
    when (storage.foldername(p_name))[1] = 'deals'
      then exists (select 1 from public.deals d where d.id::text = (storage.foldername(p_name))[2])
    else exists (select 1 from public.projects p where p.project_id = (storage.foldername(p_name))[1])
  end
  or exists (select 1 from public.documents d
             where d.storage_bucket = 'project-documents' and d.storage_path = p_name)
$$;

drop policy if exists "Owner reads project documents"   on storage.objects;
drop policy if exists "Owner uploads project documents" on storage.objects;
drop policy if exists "Owner updates project documents" on storage.objects;
drop policy if exists "Owner deletes project documents" on storage.objects;

create policy "Owner reads project documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-documents' and public.can_access_document_path(name));

create policy "Owner uploads project documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-documents' and public.can_access_document_path(name));

create policy "Owner updates project documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-documents' and public.can_access_document_path(name))
  with check (bucket_id = 'project-documents' and public.can_access_document_path(name));

create policy "Owner deletes project documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-documents' and public.can_access_document_path(name));

commit;

-- =============================================================================
--  DONE.  Quick checks (run separately, AFTER Dan's login exists):
--    select project_type, count(*) from stage_templates group by 1 order by 1;
--        -- commercial_industrial 9 | land_subdivision 9 | residential_build 8
--    select name from contact_categories order by sort_order;     -- 6 rows
--    select field, count(*) from offer_terms group by 1;          -- condition 17, deposit 6, due_diligence 8, settlement 9, solicitor 1
--    select public.au_fy('2026-11-02'), public.au_bas_quarter('2026-11-02');  -- FY2026-27 | Q2
--  Tests: supabase-tests.sql (local Postgres only, not on Dan's live project).
-- =============================================================================
