-- =============================================================================
--  WELLCO PROJECT BRAIN  -  Supabase database schema  (v1)
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
--
--  WHAT'S IN HERE:
--    PART 1  Database: helpers, enums, tables, triggers, views, security (RLS)
--    PART 2  Storage: the private "project-documents" bucket + its access rules
--
--  THE BIG RULES THIS SCHEMA ENFORCES (so the app can't get them wrong):
--    * One owner (Dan).  Every row carries owner_id; Row Level Security means a
--      logged-in user only ever sees rows where owner_id = their user id.
--    * Projects never mix.  Quotes, engagements, invoices, budget lines and
--      documents are tied to ONE project, and links between them are checked so
--      a Croobyar invoice can never point at an Ulladulla engagement.
--      Only Projects and Contacts are shared registers.
--    * Every money row has a GST treatment: taxable / gst_free / input_taxed /
--      margin_scheme (sales only).  GST-free and input-taxed rows must carry $0 GST.
--    * Financial year and BAS quarter are worked out automatically from the
--      invoice date (AU FY = 1 Jul - 30 Jun, e.g. 'FY2025-26', quarters Q1-Q4).
--    * Nothing is sent, issued or paid without Dan's approval: moving an RFQ to
--      'sent', an engagement to 'issued', an invoice-in to 'approved'/'paid', or
--      an invoice-out to 'issued' is blocked unless an approved approval exists.
--    * Every insert / change / delete on the main tables is written to
--      activity_log automatically (the per-project "Log" tab).
--
--  MONEY CONVENTION: all budget / committed / paid figures are EX GST (each
--  project company is GST registered, so GST is not a cost).  GST sits in its
--  own column and only matters for BAS.
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
-- 1.2  Enums (fixed pick-lists).  To add a value later:
--        alter type public.contact_role add value 'heritage';
-- -----------------------------------------------------------------------------
create type public.au_state          as enum ('NSW', 'QLD');   -- add more states with ALTER TYPE if Wellco goes further afield
create type public.project_type      as enum ('land_subdivision', 'commercial_industrial');
create type public.project_status    as enum ('live', 'closed');
create type public.feaso_result      as enum ('pending', 'go', 'no_go');

create type public.contact_role as enum (
  'buyers_agent', 'solicitor', 'town_planner', 'surveyor', 'civil_engineer',
  'geotech', 'ecology', 'bushfire', 'flooding', 'traffic', 'civil_contractor',
  'electrical', 'nbn', 'builder', 'landscaping', 'real_estate_agent',
  'accountant', 'council', 'state_government', 'utility', 'bank', 'lender', 'other'
);

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

create type public.doc_type as enum (
  'contract', 'due_diligence', 'planning_report', 'da', 'consultant_report',
  'quote', 'engagement', 'invoice_in', 'invoice_out', 'receipt', 'certificate',
  'plans', 'correspondence', 'sales', 'finance', 'council', 'other'
);

create type public.approval_status as enum ('pending', 'approved', 'rejected');
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

-- The 8 lifecycle stages. Same list for every project (land or commercial).
create table public.stages (
  stage_no     smallint primary key check (stage_no between 1 and 8),
  name         text not null unique,
  description  text not null
);
comment on table public.stages is 'Fixed list of the 8 project stages. Shared, read-only.';

insert into public.stages (stage_no, name, description) values
  (1, 'Sourcing',               'Site found via listing or buyer''s agent; log the site.'),
  (2, 'Feasibility',            'Feaso (Feasely); go / no-go.'),
  (3, 'Acquisition & DD',       'Offer, deposit, solicitor, due diligence; register project company (ABN, GST, bank); exchange; settlement.'),
  (4, 'Consultants',            'Planner, surveyor, civil engineer, geotech, ecology, bushfire, flooding. 3 quotes each.'),
  (5, 'Development Approval',   'Lodge DA, respond to RFIs, pay council fees, DA conditions.'),
  (6, 'Construction',           'Tender civils, electrical, NBN, landscaping (3 quotes each); monthly claims; contributions; WAE; subdivision certificate; plan registration.'),
  (7, 'Sales & Settlements',    'Appoint agent(s), sell lots / units, bundle settlements, discharge loans, GST margin scheme.'),
  (8, 'Bonds & Wind-up',        'Maintenance bonds (~12 months), council inspection, bond return, final accounts, distribution to trust, deregister company.');

-- Shared CONTACTS register (one of only two registers shared across projects).
create table public.contacts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,                     -- person
  company           text,                              -- business name
  roles             public.contact_role[] not null default '{}',
  email             text,
  phone             text,
  abn               text check (abn is null or regexp_replace(abn, '\s', '', 'g') ~ '^\d{11}$'),
  licence_number    text,
  licence_expiry    date,
  insurance_expiry  date,                              -- public liability / PI
  rating            smallint check (rating between 1 and 5),
  notes             text,                              -- performance notes: "good on price, slow on paperwork"
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.contacts is 'Shared register of every party: consultants, contractors, agents, solicitors, council, banks.';

-- The PROJECTS register. One row = one project company.
create table public.projects (
  project_id           text primary key
                       check (project_id ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),  -- e.g. 'CROOBYAR', 'ULLADULLA-IND'
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                 text not null,                  -- 'Croobyar Rd, Milton'
  address              text,
  lot_plan             text not null,                  -- 'Lot 12 DP 1187234' (NSW) or 'Lot 2 SP 301887' (QLD)
  state                public.au_state not null default 'NSW',
  project_type         public.project_type not null default 'land_subdivision',
  lots_or_units        integer check (lots_or_units >= 0),
  description          text,                           -- '14-lot residential subdivision'
  -- the project company (each one standalone: own ABN, GST, bank, books)
  company_name         text not null,
  abn                  text check (abn is null or regexp_replace(abn, '\s', '', 'g') ~ '^\d{11}$'),
  acn                  text,
  gst_registered       boolean not null default true,
  gst_registered_from  date,
  bank_name            text,
  bank_bsb             text,
  bank_account         text,                           -- tip: store last 4 digits only if you prefer
  trust_name           text,                           -- shareholder (the trust)
  -- where it's at
  stage                smallint not null default 1 references public.stages (stage_no),
  status               public.project_status not null default 'live',
  budget               numeric(14,2) check (budget >= 0),  -- headline feaso budget, ex GST (detail in budget_lines)
  opened_on            date not null default public.today_syd(),
  closed_on            date,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.projects is 'Master project register. One row per project company. Project ID = location ref (lot/plan held separately).';

-- DEALS: the sourcing pipeline (sites before they become projects).
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  address            text not null,
  state              public.au_state not null default 'NSW',
  lot_plan           text,
  source             text,                             -- 'realestate.com.au', 'Ray White Commercial', 'off-market'
  source_contact_id  uuid references public.contacts (id) on delete set null,  -- buyer's agent / listing agent
  asking_price       numeric(14,2),
  site_area_m2       numeric(12,2),
  lot_yield          integer,
  zoning             text,
  feaso_result       public.feaso_result not null default 'pending',
  feaso_link         text,                             -- link to the Feasely study
  notes              text,
  logged_on          date not null default public.today_syd(),
  project_id         text references public.projects (project_id) on delete set null,  -- set when "Create project" is used
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.deals is 'Sourcing pipeline: every site looked at, with feaso result. A Go site becomes a project.';

-- TASKS: the per-stage checklist for each project ("have I chased that up?").
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null references public.projects (project_id) on delete cascade,
  stage_no        smallint not null references public.stages (stage_no),
  title           text not null,
  notes           text,
  due_date        date,
  done            boolean not null default false,
  done_at         timestamptz,
  lead_time_days  integer check (lead_time_days >= 0),  -- e.g. 90 for an Endeavour Energy connection application
  warning         text,                                 -- e.g. '3-month lead time: apply as soon as DA lands'
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
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

-- DOCUMENTS: every PDF, stored in the project-documents bucket.
-- Naming convention (set automatically): [ProjectID]_[DocType]_[Party]_[Date]
--   e.g. CROOBYAR_Quote_SouthcoastCivil_2026-10-14
-- Storage path (set automatically if the app doesn't send one):
--   project-documents/<ProjectID>/<doc_type>/<standard_name>.<ext>
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null references public.projects (project_id) on delete cascade,
  doc_type        public.doc_type not null,
  party           text,                                -- who it's from/to; falls back to the contact's company
  contact_id      uuid references public.contacts (id) on delete set null,
  doc_date        date not null default public.today_syd(),
  original_name   text,                                -- filename as uploaded
  file_ext        text default 'pdf',
  standard_name   text not null default '',            -- filled by trigger
  storage_bucket  text not null default 'project-documents',
  storage_path    text,                                -- filled by trigger if blank
  mime_type       text default 'application/pdf',
  size_bytes      bigint,
  tags            text[] not null default '{}',
  notes           text,
  backed_up_at    timestamptz,                         -- last copied to OneDrive
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, project_id)
);
comment on table public.documents is 'File register for the project-documents storage bucket. Name = [ProjectID]_[DocType]_[Party]_[Date].';

-- RFQ SCOPES: one per thing being priced ('Civil works', 'Town planning').
create table public.rfq_scopes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id     text not null references public.projects (project_id) on delete cascade,
  stage_no       smallint references public.stages (stage_no),
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
  unique (id, project_id)
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

-- INVOICES IN (bills to the project company).
-- One row = one GST line.  If a single invoice mixes taxable and GST-free
-- amounts (common on council invoices), enter it as two rows with the same
-- supplier_invoice_no.
-- Wellco's management fee is a COST to the project company, so it goes here
-- (category management_fee, flag 'management_fee').  Wellco raises the matching
-- invoice in its own Xero.
-- Land bought where the vendor used the margin scheme: record as gst_free (no
-- GST credit to claim) and note it.  Confirm treatment with the accountant.
create table public.invoices_in (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id           text not null references public.projects (project_id) on delete cascade,
  contact_id           uuid references public.contacts (id),   -- supplier (council, contractor, OSR...)
  engagement_id        uuid,
  budget_line_id       uuid,
  supplier_invoice_no  text,
  invoice_date         date not null,
  due_date             date,
  description          text not null,
  gst_treatment        public.gst_treatment not null default 'taxable',
  amount_ex_gst        numeric(14,2) not null,
  gst_amount           numeric(14,2) not null default 0,
  total                numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  status               public.invoice_in_status not null default 'draft',
  paid_on              date,
  flag                 public.money_flag,               -- intercompany loan / distribution / mgmt fee
  document_id          uuid,
  notes                text,
  fy                   text generated always as (public.au_fy(invoice_date)) stored,          -- 'FY2025-26'
  bas_quarter          text generated always as (public.au_bas_quarter(invoice_date)) stored, -- 'Q2'
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (engagement_id, project_id)  references public.engagements (id, project_id),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id),
  foreign key (document_id, project_id)    references public.documents (id, project_id),
  constraint invoices_in_no_gst_when_free check (gst_treatment = 'taxable' or gst_amount = 0),
  constraint invoices_in_no_margin_scheme check (gst_treatment <> 'margin_scheme'),
  constraint invoices_in_paid_has_date    check (status <> 'paid' or paid_on is not null)
);
comment on table public.invoices_in is 'Bills to the project company. Every line flagged taxable / gst_free / input_taxed. fy and bas_quarter are automatic.';

-- INVOICES OUT (from the project company): lot deposits, settlements, unit sales.
-- Margin scheme sales: gst_amount = 1/11 of the margin (enter it; the
-- accountant confirms the margin).  margin_amount is kept for the workbook.
create table public.invoices_out (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id      text not null references public.projects (project_id) on delete cascade,
  contact_id      uuid references public.contacts (id),       -- buyer / their solicitor
  kind            public.invoice_out_kind not null default 'lot_settlement',
  invoice_no      text,                                       -- e.g. 'CROOBYAR-INV-003'
  lot_number      text,
  invoice_date    date not null,
  due_date        date,
  description     text not null,
  gst_treatment   public.gst_treatment not null default 'margin_scheme',
  amount_ex_gst   numeric(14,2) not null,
  gst_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) generated always as (amount_ex_gst + gst_amount) stored,
  margin_amount   numeric(14,2),                              -- margin scheme only
  status          public.invoice_out_status not null default 'draft',
  paid_on         date,
  flag            public.money_flag,
  document_id     uuid,
  notes           text,
  fy              text generated always as (public.au_fy(invoice_date)) stored,
  bas_quarter     text generated always as (public.au_bas_quarter(invoice_date)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, invoice_no),
  foreign key (document_id, project_id) references public.documents (id, project_id),
  constraint invoices_out_no_gst_when_free check (gst_treatment in ('taxable', 'margin_scheme') or gst_amount = 0),
  constraint invoices_out_paid_has_date    check (status <> 'paid' or paid_on is not null)
);
comment on table public.invoices_out is 'Invoices from the project company (sales, deposits, settlements). fy and bas_quarter are automatic.';

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
  action       text not null,                        -- 'insert' / 'update' / 'delete' / 'rfq.sent' ...
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
create index contacts_owner_idx            on public.contacts (owner_id);
create index contacts_roles_idx            on public.contacts using gin (roles);
create index contacts_name_idx             on public.contacts (lower(coalesce(company, name)));
create index deals_owner_result_idx        on public.deals (owner_id, feaso_result);
create index deals_project_idx             on public.deals (project_id);
create index tasks_project_open_idx        on public.tasks (project_id, done, due_date);
create index tasks_open_due_idx            on public.tasks (due_date) where not done;
create index budget_lines_project_idx      on public.budget_lines (project_id, category);
create index documents_project_type_idx    on public.documents (project_id, doc_type);
create index documents_contact_idx         on public.documents (contact_id);
create unique index documents_storage_path_uidx on public.documents (storage_bucket, storage_path);
create index rfq_scopes_project_idx        on public.rfq_scopes (project_id, status);
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
create index invoices_out_project_fy_idx   on public.invoices_out (project_id, fy, bas_quarter);
create index invoices_out_contact_idx      on public.invoices_out (contact_id);
create index approvals_pending_idx         on public.approvals (owner_id, requested_at) where status = 'pending';
create index approvals_entity_idx          on public.approvals (entity_type, entity_id);
create index approvals_project_idx         on public.approvals (project_id);
create index activity_log_project_at_idx   on public.activity_log (project_id, at desc);
create index activity_log_owner_at_idx     on public.activity_log (owner_id, at desc);


-- -----------------------------------------------------------------------------
-- 1.5  Triggers (the automatic bits)
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
  foreach t in array array['wellco_settings', 'contacts', 'projects', 'deals', 'tasks', 'budget_lines',
                           'documents', 'rfq_scopes', 'quotes', 'engagements', 'invoices_in',
                           'invoices_out', 'approvals']
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

-- (d) documents: build the standard file name and storage path
--     [ProjectID]_[DocType]_[Party]_[YYYY-MM-DD]   (adds _2, _3 if it already exists)
create or replace function public.doc_type_code(t public.doc_type)
returns text
language sql immutable parallel safe
as $$
  select case t
    when 'contract'          then 'Contract'
    when 'due_diligence'     then 'DD'
    when 'planning_report'   then 'PlanningReport'
    when 'da'                then 'DA'
    when 'consultant_report' then 'Report'
    when 'quote'             then 'Quote'
    when 'engagement'        then 'Engagement'
    when 'invoice_in'        then 'Invoice'
    when 'invoice_out'       then 'TaxInvoice'
    when 'receipt'           then 'Receipt'
    when 'certificate'       then 'Certificate'
    when 'plans'             then 'Plans'
    when 'correspondence'    then 'Correspondence'
    when 'sales'             then 'Sales'
    when 'finance'           then 'Finance'
    when 'council'           then 'Council'
    else 'Other'
  end
$$;

create or replace function public.documents_set_name()
returns trigger
language plpgsql
as $$
declare
  v_party text;
  v_base  text;
  v_name  text;
  v_n     integer := 1;
begin
  v_party := coalesce(
    nullif(trim(new.party), ''),
    (select coalesce(c.company, c.name) from public.contacts c where c.id = new.contact_id),
    'General');
  -- drop "Pty Ltd" etc, then keep letters and numbers only: 'Southcoast Civil Pty Ltd' -> 'SouthcoastCivil'
  v_party := regexp_replace(v_party, '\s+(pty\.?\s*ltd\.?|pty\.?\s*limited|limited|ltd\.?)\s*$', '', 'i');
  v_party := left(regexp_replace(v_party, '[^A-Za-z0-9]+', '', 'g'), 40);
  if v_party = '' then v_party := 'General'; end if;

  v_base := new.project_id || '_' || public.doc_type_code(new.doc_type) || '_' || v_party || '_'
            || to_char(new.doc_date, 'YYYY-MM-DD');

  -- only rename when it's new or one of the naming inputs changed
  if tg_op = 'UPDATE'
     and new.project_id = old.project_id and new.doc_type = old.doc_type
     and new.doc_date = old.doc_date
     and new.party is not distinct from old.party
     and new.contact_id is not distinct from old.contact_id then
    return new;
  end if;

  v_name := v_base;
  while exists (select 1 from public.documents d
                where d.project_id = new.project_id and d.standard_name = v_name and d.id <> new.id) loop
    v_n := v_n + 1;
    v_name := v_base || '_' || v_n;
  end loop;
  new.standard_name := v_name;

  -- The storage path is fixed once set (renaming it here would not move the
  -- actual file).  standard_name is the display / download name.
  if new.storage_path is null then
    new.storage_path := new.project_id || '/' || new.doc_type::text || '/' || v_name
                        || coalesce('.' || lower(nullif(trim(new.file_ext), '')), '');
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
  if tg_op = 'DELETE' then v_rec := to_jsonb(old); else v_rec := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value)), '{}'::jsonb)
      into v_changed
      from jsonb_each(v_rec) as n
     where n.key not in ('updated_at', 'done_at', 'decided_at')
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
          coalesce(v_rec ->> 'id', v_rec ->> 'project_id'),
          v_summary,
          case when tg_op = 'UPDATE' then v_changed else v_rec end,
          'auto');
  return null;  -- AFTER trigger: return value is ignored
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'contacts', 'deals', 'tasks', 'budget_lines', 'documents',
                           'rfq_scopes', 'quotes', 'engagements', 'invoices_in', 'invoices_out', 'approvals']
  loop
    execute format('create trigger log_activity after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t);
  end loop;
end;
$$;

-- (g) New login => create Wellco settings row automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wellco_settings (owner_id) values (new.id)
  on conflict (owner_id) do nothing;
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


-- -----------------------------------------------------------------------------
-- 1.6  Views (ready-made answers for the screens and the Excel exports)
--      security_invoker = true means the view obeys the same RLS rules as the
--      tables underneath, so it only ever shows the logged-in owner's rows.
-- -----------------------------------------------------------------------------

-- HOME SCREEN: one row per project: stage, next deadline, budget vs committed vs paid, overdue tasks.
--   committed = engagements issued/complete  +  approved/paid invoices with no engagement
--               (council fees, stamp duty and other one-off costs)
--   paid      = invoices in marked paid
create view public.v_project_summary
with (security_invoker = true) as
select
  p.project_id,
  p.name,
  p.company_name,
  p.abn,
  p.state,
  p.project_type,
  p.status,
  p.stage,
  s.name                                                          as stage_name,
  coalesce(nullif(b.budget_ex_gst, 0), p.budget, 0)               as budget_ex_gst,
  coalesce(e.engaged_ex_gst, 0) + coalesce(i.direct_ex_gst, 0)    as committed_ex_gst,
  coalesce(i.paid_ex_gst, 0)                                      as paid_ex_gst,
  coalesce(nullif(b.budget_ex_gst, 0), p.budget, 0)
    - (coalesce(e.engaged_ex_gst, 0) + coalesce(i.direct_ex_gst, 0)) as uncommitted_ex_gst,
  nt.due_date                                                     as next_deadline,
  nt.title                                                        as next_task,
  coalesce(t.open_tasks, 0)                                       as open_tasks,
  coalesce(t.overdue_tasks, 0)                                    as overdue_tasks,
  coalesce(t.lead_time_alerts, 0)                                 as lead_time_alerts,
  coalesce(a.pending_approvals, 0)                                as pending_approvals
from public.projects p
join public.stages s on s.stage_no = p.stage
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
  select sum(ii.amount_ex_gst) filter (where ii.engagement_id is null and ii.status in ('approved', 'paid')) as direct_ex_gst,
         sum(ii.amount_ex_gst) filter (where ii.status = 'paid')                                             as paid_ex_gst
  from public.invoices_in ii where ii.project_id = p.project_id
) i on true
left join lateral (
  select count(*) filter (where not tk.done)                                                          as open_tasks,
         count(*) filter (where not tk.done and tk.due_date < public.today_syd())                     as overdue_tasks,
         count(*) filter (where not tk.done and tk.lead_time_days is not null
                            and tk.due_date - tk.lead_time_days <= public.today_syd() + 7)            as lead_time_alerts
  from public.tasks tk where tk.project_id = p.project_id
) t on true
left join lateral (
  select tk.due_date, tk.title
  from public.tasks tk
  where tk.project_id = p.project_id and not tk.done and tk.due_date is not null
  order by tk.due_date, tk.sort_order
  limit 1
) nt on true
left join lateral (
  select count(*) as pending_approvals
  from public.approvals ap where ap.project_id = p.project_id and ap.status = 'pending'
) a on true;

-- GST / BAS: one row per project per BAS quarter.
-- Uses invoice date (accruals basis).  If the accountant lodges on a CASH
-- basis, swap invoice_date for paid_on below.
--   ATO labels:  G1 = total sales (incl GST)   1A = GST on sales (collected)
--                G11 = purchases (incl GST)    1B = GST on purchases (credits)
create view public.v_bas_summary
with (security_invoker = true) as
with lines as (
  select ii.project_id, ii.fy, ii.bas_quarter, public.au_quarter_start(ii.invoice_date) as quarter_start,
         0::numeric        as sales_incl_gst,
         0::numeric        as gst_collected,
         0::numeric        as margin_scheme_sales,
         0::numeric        as gst_free_sales,
         ii.total          as purchases_incl_gst,
         ii.gst_amount     as gst_paid,
         case when ii.gst_treatment = 'gst_free'    then ii.amount_ex_gst else 0 end as gst_free_spend,
         case when ii.gst_treatment = 'input_taxed' then ii.amount_ex_gst else 0 end as input_taxed_spend
  from public.invoices_in ii
  where ii.status in ('approved', 'paid')
  union all
  select io.project_id, io.fy, io.bas_quarter, public.au_quarter_start(io.invoice_date),
         io.total,
         io.gst_amount,
         case when io.gst_treatment = 'margin_scheme' then io.total else 0 end,
         case when io.gst_treatment in ('gst_free', 'input_taxed') then io.total else 0 end,
         0, 0, 0, 0
  from public.invoices_out io
  where io.status in ('issued', 'paid')
)
select
  l.project_id,
  p.company_name,
  p.abn,
  l.fy,
  l.bas_quarter,
  l.fy || ' ' || l.bas_quarter                       as period,       -- 'FY2025-26 Q2'
  l.quarter_start,
  (l.quarter_start + interval '3 months - 1 day')::date as quarter_end,
  sum(l.sales_incl_gst)                              as sales_incl_gst_g1,
  sum(l.gst_collected)                               as gst_collected_1a,
  sum(l.margin_scheme_sales)                         as margin_scheme_sales,
  sum(l.gst_free_sales)                              as gst_free_sales,
  sum(l.purchases_incl_gst)                          as purchases_incl_gst_g11,
  sum(l.gst_paid)                                    as gst_paid_1b,
  sum(l.gst_free_spend)                              as gst_free_spend,
  sum(l.input_taxed_spend)                           as input_taxed_spend,
  sum(l.gst_collected) - sum(l.gst_paid)             as net_gst           -- positive = pay ATO, negative = refund
from lines l
join public.projects p on p.project_id = l.project_id
group by l.project_id, p.company_name, p.abn, l.fy, l.bas_quarter, l.quarter_start;

-- MONEY TAB: budget vs committed vs paid by cost category.
-- category is null for costs not yet allocated to a budget line ("Unallocated").
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
    select ii.project_id, bl.category, ii.amount_ex_gst
    from public.invoices_in ii
    left join public.budget_lines bl on bl.id = ii.budget_line_id
    where ii.engagement_id is null and ii.status in ('approved', 'paid')
  ) x
  group by x.project_id, x.category
),
pd as (
  -- a progress claim with no budget line of its own uses its engagement's budget line
  select ii.project_id, bl.category, sum(ii.amount_ex_gst) as paid_ex_gst
  from public.invoices_in ii
  left join public.engagements en on en.id = ii.engagement_id
  left join public.budget_lines bl on bl.id = coalesce(ii.budget_line_id, en.budget_line_id)
  where ii.status = 'paid'
  group by ii.project_id, bl.category
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
group by r.id, r.project_id, r.name, r.status, r.min_quotes;

-- ENGAGEMENTS: % claimed against each engagement.
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
  coalesce(sum(ii.amount_ex_gst) filter (where ii.status in ('approved', 'paid')), 0) as claimed_ex_gst,
  coalesce(sum(ii.amount_ex_gst) filter (where ii.status = 'paid'), 0)               as paid_ex_gst,
  case when en.value_ex_gst > 0
       then round(100 * coalesce(sum(ii.amount_ex_gst) filter (where ii.status in ('approved', 'paid')), 0) / en.value_ex_gst, 1)
  end                                                       as pct_claimed
from public.engagements en
left join public.invoices_in ii on ii.engagement_id = en.id
group by en.id;

-- CONTACTS: projects worked on + licence / insurance expiring within 60 days.
create view public.v_contacts
with (security_invoker = true) as
select
  c.*,
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

-- HOME "NEEDS YOU TODAY": everything that needs a decision or a chase, in one list.
create view public.v_needs_attention
with (security_invoker = true) as
-- approvals waiting
select 1 as priority, 'approval'::text as item_type, ap.project_id, ap.title,
       null::text as detail, ap.requested_at::date as due_date, 'approvals'::text as entity_type, ap.id as entity_id
from public.approvals ap where ap.status = 'pending'
union all
-- overdue tasks
select 2, 'overdue_task', tk.project_id, tk.title, tk.warning, tk.due_date, 'tasks', tk.id
from public.tasks tk where not tk.done and tk.due_date < public.today_syd()
union all
-- lead-time warnings: time to start (due date minus lead time is within 7 days)
select 3, 'lead_time', tk.project_id, tk.title,
       coalesce(tk.warning, tk.lead_time_days || '-day lead time'),
       tk.due_date - tk.lead_time_days, 'tasks', tk.id
from public.tasks tk
where not tk.done and tk.lead_time_days is not null and tk.due_date >= public.today_syd()
  and tk.due_date - tk.lead_time_days <= public.today_syd() + 7
union all
-- tasks due in the next 7 days
select 4, 'due_soon', tk.project_id, tk.title, tk.warning, tk.due_date, 'tasks', tk.id
from public.tasks tk
where not tk.done and tk.due_date between public.today_syd() and public.today_syd() + 7
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
-- bills due in the next 7 days (or overdue) and not paid
select 6, 'invoice_due', ii.project_id,
       'Pay: ' || ii.description, '$' || to_char(ii.total, 'FM999,999,990.00'), ii.due_date, 'invoices_in', ii.id
from public.invoices_in ii
where ii.status <> 'paid' and ii.due_date <= public.today_syd() + 7
union all
-- contractor licence / insurance expiring in 60 days
select 7, 'contact_expiry', null, coalesce(c.company, c.name) || ': licence or insurance expiring',
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
alter table public.wellco_settings enable row level security;
alter table public.stages          enable row level security;
alter table public.contacts        enable row level security;
alter table public.projects        enable row level security;
alter table public.deals           enable row level security;
alter table public.tasks           enable row level security;
alter table public.budget_lines    enable row level security;
alter table public.documents       enable row level security;
alter table public.rfq_scopes      enable row level security;
alter table public.quotes          enable row level security;
alter table public.engagements     enable row level security;
alter table public.invoices_in     enable row level security;
alter table public.invoices_out    enable row level security;
alter table public.approvals       enable row level security;
alter table public.activity_log    enable row level security;

-- Owner can do everything on their own rows (same policy on every main table).
-- (select auth.uid()) is wrapped in a sub-select so Postgres works it out once per query, not per row.
do $$
declare t text;
begin
  foreach t in array array['wellco_settings', 'contacts', 'projects', 'deals', 'tasks', 'budget_lines',
                           'documents', 'rfq_scopes', 'quotes', 'engagements', 'invoices_in',
                           'invoices_out', 'approvals']
  loop
    execute format(
      'create policy "Owner full access" on public.%I
         for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Stages: any logged-in user can read the 8 stage names; nobody edits them from the app.
create policy "Read stages" on public.stages
  for select to authenticated using (true);

-- Activity log: read and add only.  No update or delete policy = log can't be altered.
create policy "Owner reads log" on public.activity_log
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owner adds to log" on public.activity_log
  for insert to authenticated with check (owner_id = (select auth.uid()));

commit;


-- #############################################################################
-- PART 2  -  FILE STORAGE (PDFs)
--   Bucket : project-documents   (PRIVATE: files are opened with signed links)
--   Path   : <ProjectID>/<doc_type>/<ProjectID>_<DocType>_<Party>_<YYYY-MM-DD>.pdf
--            e.g. CROOBYAR/quote/CROOBYAR_Quote_SouthcoastCivil_2026-10-14.pdf
--   Rule   : you can only read / upload / delete files inside a folder named
--            after one of YOUR projects (checked against the projects table).
--   Note   : deleting a project row does NOT delete its files.  Delete the
--            folder in Storage too if you really mean it (back it up first).
--   If this part errors (e.g. bucket already exists from the dashboard), the
--   database from PART 1 is already saved; fix and run just this part again.
-- #############################################################################
begin;

insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

create policy "Owner reads project documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-documents'
         and (storage.foldername(name))[1] in (select p.project_id from public.projects p));

create policy "Owner uploads project documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-documents'
              and (storage.foldername(name))[1] in (select p.project_id from public.projects p));

create policy "Owner updates project documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-documents'
         and (storage.foldername(name))[1] in (select p.project_id from public.projects p))
  with check (bucket_id = 'project-documents'
              and (storage.foldername(name))[1] in (select p.project_id from public.projects p));

create policy "Owner deletes project documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-documents'
         and (storage.foldername(name))[1] in (select p.project_id from public.projects p));

commit;

-- =============================================================================
--  DONE.  Quick check (run separately):
--    select * from public.stages order by stage_no;          -- 8 rows
--    select public.au_fy('2026-11-02'), public.au_bas_quarter('2026-11-02');  -- FY2026-27 | Q2
-- =============================================================================
