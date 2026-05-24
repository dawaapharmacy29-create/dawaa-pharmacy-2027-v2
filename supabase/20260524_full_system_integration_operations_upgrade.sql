-- Dawaa Pharmacy 2027 full system integration and operations upgrade
-- Safe to run multiple times. No destructive changes.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table if exists public.customers add column if not exists team_notes text;
alter table if exists public.customers add column if not exists handling_notes text;
alter table if exists public.customers add column if not exists customer_flags jsonb not null default '{}'::jsonb;
alter table if exists public.customers add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_customers_customer_flags on public.customers using gin (customer_flags);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'customer_code'
  ) then
    create index if not exists idx_customers_customer_code on public.customers (customer_code);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'code'
  ) then
    create index if not exists idx_customers_code on public.customers (code);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'phone'
  ) then
    create index if not exists idx_customers_phone on public.customers (phone);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'customer_phone'
  ) then
    create index if not exists idx_customers_customer_phone on public.customers (customer_phone);
  end if;
end $$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table if not exists public.shelf_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shelf_sections (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.shelf_zones(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(zone_id, name)
);

create table if not exists public.shelf_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  branch text,
  zone_id uuid references public.shelf_zones(id) on delete set null,
  section_id uuid references public.shelf_sections(id) on delete set null,
  area text,
  section text,
  task_type text not null default 'organize',
  alphabet_from text,
  alphabet_to text,
  responsible_staff_id uuid,
  responsible_staff_name text,
  due_date date,
  frequency text not null default 'one_time',
  progress numeric not null default 0,
  status text not null default 'pending',
  notes text,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shelf_task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.shelf_tasks(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shelf_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.shelf_tasks(id) on delete cascade,
  event_type text not null,
  event_note text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.branch_cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  date date not null default current_date,
  shift text not null default 'morning',
  responsible_staff_id uuid,
  responsible_staff_name text,
  status text not null default 'pending',
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.branch_cleaning_tasks add column if not exists branch text;
alter table if exists public.branch_cleaning_tasks add column if not exists date date not null default current_date;
alter table if exists public.branch_cleaning_tasks add column if not exists shift text not null default 'morning';
alter table if exists public.branch_cleaning_tasks add column if not exists responsible_staff_id uuid;
alter table if exists public.branch_cleaning_tasks add column if not exists responsible_staff_name text;
alter table if exists public.branch_cleaning_tasks add column if not exists status text not null default 'pending';
alter table if exists public.branch_cleaning_tasks add column if not exists notes text;
alter table if exists public.branch_cleaning_tasks add column if not exists approved_by uuid;
alter table if exists public.branch_cleaning_tasks add column if not exists approved_at timestamptz;
alter table if exists public.branch_cleaning_tasks add column if not exists created_by uuid;
alter table if exists public.branch_cleaning_tasks add column if not exists created_at timestamptz not null default now();
alter table if exists public.branch_cleaning_tasks add column if not exists updated_at timestamptz not null default now();

create table if not exists public.branch_cleaning_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.branch_cleaning_tasks(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  branch text,
  count_type text not null default 'full',
  section text,
  alphabet_from text,
  alphabet_to text,
  responsible_staff_id uuid,
  responsible_staff_name text,
  due_date date,
  status text not null default 'planned',
  notes text,
  created_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.inventory_count_sessions(id) on delete cascade,
  item_name text not null,
  expected_qty numeric,
  actual_qty numeric,
  difference numeric generated always as (coalesce(actual_qty,0) - coalesce(expected_qty,0)) stored,
  reason text,
  action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_count_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.inventory_count_sessions(id) on delete cascade,
  event_type text not null,
  event_note text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.shortage_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  branch text,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric,
  requested_qty numeric,
  average_sales numeric,
  priority text not null default 'medium',
  category text,
  allowed_customer_category text,
  max_dispense_per_customer numeric,
  alternative_item text,
  supplier text,
  status text not null default 'shortage',
  responsible_staff_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shortage_events (
  id uuid primary key default gen_random_uuid(),
  shortage_id uuid references public.shortage_items(id) on delete cascade,
  event_type text not null,
  event_note text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplies_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  branch text,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric,
  requested_qty numeric,
  status text not null default 'available',
  responsible_staff_id uuid,
  weekly_checker_staff_id uuid,
  supplier text,
  last_checked_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_name, branch)
);

create table if not exists public.supplies_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.supplies_items(id) on delete cascade,
  checked_by uuid,
  checked_by_name text,
  current_qty numeric,
  notes text,
  checked_at timestamptz not null default now()
);

create table if not exists public.supplies_import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  imported_by uuid,
  imported_by_name text,
  rows_count integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.accessory_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  branch text,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric,
  status text not null default 'available',
  needs_display_improvement boolean not null default false,
  slow_moving boolean not null default false,
  supplier text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_name, branch)
);

create table if not exists public.accessory_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.accessory_items(id) on delete cascade,
  checked_by uuid,
  checked_by_name text,
  display_status text,
  notes text,
  checked_at timestamptz not null default now()
);

alter table if exists public.customer_requests add column if not exists item_image_url text;
alter table if exists public.customer_requests add column if not exists current_stage text not null default 'registered';
alter table if exists public.customer_requests add column if not exists priority text not null default 'medium';
alter table if exists public.customer_requests add column if not exists is_urgent boolean not null default false;
alter table if exists public.customer_requests add column if not exists expected_price numeric;
alter table if exists public.customer_requests add column if not exists doctor_notes text;
alter table if exists public.customer_requests add column if not exists purchasing_notes text;
alter table if exists public.customer_requests add column if not exists supplier_notes text;
alter table if exists public.customer_requests add column if not exists assigned_to uuid;
alter table if exists public.customer_requests add column if not exists due_date date;
alter table if exists public.customer_requests add column if not exists last_action_at timestamptz;
alter table if exists public.customer_requests add column if not exists closed_at timestamptz;
alter table if exists public.customer_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.customer_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.customer_requests(id) on delete cascade,
  from_stage text,
  to_stage text,
  event_type text not null default 'stage_change',
  event_note text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  branch text,
  start_date date,
  end_date date,
  discount_type text,
  discount_value numeric,
  included_items text,
  status text not null default 'scheduled',
  created_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_stories (
  id uuid primary key default gen_random_uuid(),
  story_date date not null default current_date,
  story_order integer,
  title text not null,
  image_url text,
  story_type text,
  views_count integer default 0,
  inquiries_count integer default 0,
  sales_count integer default 0,
  sales_value numeric default 0,
  related_offer_id uuid references public.offers(id) on delete set null,
  related_items text,
  uploaded_by uuid,
  report_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_performance_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.whatsapp_stories(id) on delete cascade,
  report_by uuid,
  views_count integer default 0,
  inquiries_count integer default 0,
  sales_count integer default 0,
  sales_value numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  description text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.training_modules(id) on delete cascade,
  staff_id uuid,
  staff_name text,
  role text,
  due_date date,
  status text not null default 'pending',
  score numeric,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.training_modules(id) on delete cascade,
  title text not null,
  frequency text,
  passing_score numeric default 70,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.training_quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text,
  points numeric default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.training_quizzes(id) on delete cascade,
  assignment_id uuid references public.training_assignments(id) on delete set null,
  staff_id uuid,
  staff_name text,
  score numeric,
  passed boolean,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.shelf_zones(name, description) values
  ('منطقة الأقراص والكبسول', 'ترتيب وجرد الأدوية الأبجدية'),
  ('منطقة المعمل', 'الحقن والأشربة والقطرات والفوارات والكريمات واللبوس ومستلزمات المعمل'),
  ('منطقة الإكسسوار', 'منتجات الإكسسوار والعرض'),
  ('منطقة المستلزمات', 'المستلزمات الطبية'),
  ('منطقة البامبرز والأولويز', 'البامبرز والأولويز'),
  ('الثلاجة', 'أدوية ومنتجات الثلاجة'),
  ('المخزن الداخلي', 'مخزون داخلي')
on conflict (name) do nothing;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='shelf_tasks' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='shelf_tasks' and column_name='due_date') then
    create index if not exists idx_shelf_tasks_status_due on public.shelf_tasks(status, due_date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='branch_cleaning_tasks' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='branch_cleaning_tasks' and column_name='date') then
    create index if not exists idx_cleaning_tasks_status_date on public.branch_cleaning_tasks(status, date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='inventory_count_sessions' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='inventory_count_sessions' and column_name='due_date') then
    create index if not exists idx_inventory_sessions_status_due on public.inventory_count_sessions(status, due_date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='shortage_items' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='shortage_items' and column_name='priority') then
    create index if not exists idx_shortage_items_status_priority on public.shortage_items(status, priority);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='supplies_items' and column_name='branch')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='supplies_items' and column_name='status') then
    create index if not exists idx_supplies_items_branch_status on public.supplies_items(branch, status);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='accessory_items' and column_name='branch')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='accessory_items' and column_name='status') then
    create index if not exists idx_accessory_items_branch_status on public.accessory_items(branch, status);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customer_requests' and column_name='current_stage')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='customer_requests' and column_name='due_date') then
    create index if not exists idx_customer_requests_stage_due on public.customer_requests(current_stage, due_date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='offers' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='offers' and column_name='start_date')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='offers' and column_name='end_date') then
    create index if not exists idx_offers_status_dates on public.offers(status, start_date, end_date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_stories' and column_name='story_date') then
    create index if not exists idx_whatsapp_stories_date on public.whatsapp_stories(story_date);
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='training_assignments' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='training_assignments' and column_name='due_date') then
    create index if not exists idx_training_assignments_status_due on public.training_assignments(status, due_date);
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'shelf_zones','shelf_sections','shelf_tasks','shelf_task_items',
    'branch_cleaning_tasks','branch_cleaning_items',
    'inventory_count_sessions','inventory_count_items',
    'shortage_items','supplies_items','accessory_items',
    'offers','whatsapp_stories','training_modules','training_assignments','training_quizzes'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values
  ('customer-request-images', 'customer-request-images', true),
  ('story-assets', 'story-assets', true),
  ('offer-assets', 'offer-assets', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
