-- Dawaa Pharmacy 2027 full operations, marketing, and training upgrade.
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

create table if not exists public.shelf_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shelf_sections (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.shelf_zones(id) on delete set null,
  name text not null,
  branch text,
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shelf_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  branch text not null,
  zone text,
  section text,
  alphabet_from text,
  alphabet_to text,
  responsible_staff_id uuid,
  responsible_staff_name text,
  due_date date,
  frequency text default 'one_time',
  status text default 'pending',
  progress integer default 0,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.shelf_task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.shelf_tasks(id) on delete cascade,
  label text not null,
  checked boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shelf_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.shelf_tasks(id) on delete cascade,
  event_type text not null,
  description text,
  branch text,
  staff_id uuid,
  staff_name text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.branch_cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  task_date date default current_date,
  shift text default 'morning',
  responsible_staff_id uuid,
  responsible_staff_name text,
  status text default 'pending',
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.branch_cleaning_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.branch_cleaning_tasks(id) on delete cascade,
  label text not null,
  checked boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  branch text not null,
  count_type text not null,
  alphabet_from text,
  alphabet_to text,
  responsible_staff_id uuid,
  responsible_staff_name text,
  due_date date,
  status text default 'planned',
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closed_at timestamptz
);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.inventory_count_sessions(id) on delete cascade,
  item_name text not null,
  expected_qty numeric default 0,
  actual_qty numeric default 0,
  difference numeric generated always as (coalesce(actual_qty, 0) - coalesce(expected_qty, 0)) stored,
  reason text,
  action text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_count_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.inventory_count_sessions(id) on delete cascade,
  event_type text not null,
  description text,
  staff_id uuid,
  staff_name text,
  created_at timestamptz default now()
);

create table if not exists public.shortage_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  branch text not null,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric default 0,
  requested_qty numeric default 0,
  average_sales numeric default 0,
  priority text default 'medium',
  category text,
  allowed_customer_category text,
  max_dispense_per_customer numeric,
  alternative_item text,
  supplier text,
  status text default 'shortage',
  responsible_staff_id uuid,
  responsible_staff_name text,
  notes text,
  source_module text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shortage_events (
  id uuid primary key default gen_random_uuid(),
  shortage_id uuid references public.shortage_items(id) on delete cascade,
  event_type text not null,
  description text,
  staff_id uuid,
  staff_name text,
  created_at timestamptz default now()
);

create table if not exists public.supplies_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  branch text not null,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric default 0,
  requested_qty numeric default 0,
  status text default 'available',
  responsible_staff_id uuid,
  weekly_checker_staff_id uuid,
  supplier text,
  last_checked_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (item_name, branch)
);

create table if not exists public.supplies_checks (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid references public.supplies_items(id) on delete cascade,
  checked_qty numeric default 0,
  status text,
  notes text,
  checked_by uuid,
  checked_at timestamptz default now()
);

create table if not exists public.supplies_import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  imported_rows integer default 0,
  skipped_rows integer default 0,
  errors jsonb default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.accessory_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  branch text not null,
  current_qty numeric default 0,
  min_qty numeric default 0,
  max_qty numeric default 0,
  status text default 'available',
  needs_display_improvement boolean default false,
  slow_moving boolean default false,
  supplier text,
  last_checked_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (item_name, branch)
);

create table if not exists public.accessory_checks (
  id uuid primary key default gen_random_uuid(),
  accessory_id uuid references public.accessory_items(id) on delete cascade,
  checked_qty numeric default 0,
  display_status text,
  notes text,
  checked_by uuid,
  checked_at timestamptz default now()
);

alter table public.customer_requests add column if not exists current_stage text default 'registered';
alter table public.customer_requests add column if not exists item_image_url text;
alter table public.customer_requests add column if not exists expected_price numeric;
alter table public.customer_requests add column if not exists doctor_notes text;
alter table public.customer_requests add column if not exists purchasing_notes text;
alter table public.customer_requests add column if not exists supplier_notes text;
alter table public.customer_requests add column if not exists assigned_to uuid;
alter table public.customer_requests add column if not exists due_date date;
alter table public.customer_requests add column if not exists last_action_at timestamptz;
alter table public.customer_requests add column if not exists closed_at timestamptz;

create table if not exists public.customer_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.customer_requests(id) on delete cascade,
  from_stage text,
  to_stage text,
  event_type text default 'stage_change',
  description text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  branch text,
  start_date date,
  end_date date,
  discount_type text default 'note',
  discount_value numeric,
  included_items text,
  status text default 'scheduled',
  created_by uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.whatsapp_stories (
  id uuid primary key default gen_random_uuid(),
  story_date date default current_date,
  story_order integer default 1,
  title text not null,
  image_url text,
  story_type text default 'offer',
  views_count integer default 0,
  inquiries_count integer default 0,
  sales_count integer default 0,
  sales_value numeric default 0,
  related_offer_id uuid references public.offers(id) on delete set null,
  related_items text,
  uploaded_by uuid,
  report_by uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.story_performance_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.whatsapp_stories(id) on delete cascade,
  report_date date default current_date,
  views_count integer default 0,
  inquiries_count integer default 0,
  sales_count integer default 0,
  sales_value numeric default 0,
  notes text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  content text,
  active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.training_modules(id) on delete cascade,
  staff_id uuid,
  staff_name text,
  role_name text,
  due_date date,
  status text default 'assigned',
  completed_at timestamptz,
  score numeric,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.training_quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.training_modules(id) on delete cascade,
  title text not null,
  frequency text default 'weekly',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.training_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.training_quizzes(id) on delete cascade,
  question text not null,
  choices jsonb default '[]'::jsonb,
  correct_answer text,
  points numeric default 1,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.training_quizzes(id) on delete cascade,
  staff_id uuid,
  staff_name text,
  score numeric default 0,
  passed boolean default false,
  answers jsonb default '[]'::jsonb,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_shelf_tasks_status_due on public.shelf_tasks(status, due_date);
create index if not exists idx_shelf_tasks_branch on public.shelf_tasks(branch);
create index if not exists idx_cleaning_status_date on public.branch_cleaning_tasks(status, task_date);
create index if not exists idx_inventory_sessions_status_due on public.inventory_count_sessions(status, due_date);
create index if not exists idx_shortage_status_priority on public.shortage_items(status, priority);
create index if not exists idx_supplies_branch_status on public.supplies_items(branch, status);
create index if not exists idx_accessory_branch_status on public.accessory_items(branch, status);
create index if not exists idx_customer_requests_stage_due on public.customer_requests(current_stage, due_date);
create index if not exists idx_offers_status_dates on public.offers(status, start_date, end_date);
create index if not exists idx_stories_date on public.whatsapp_stories(story_date);
create index if not exists idx_training_assignments_status_due on public.training_assignments(status, due_date);

insert into public.shelf_zones (name, description, sort_order)
values
  ('منطقة الأقراص والكبسول', 'ترتيب أبجدي للأقراص والكبسولات', 1),
  ('منطقة المعمل', 'الحقن والأشربة والقطرات والفوارات والكريمات واللبوس وأدراج المعمل', 2),
  ('منطقة الإكسسوار', 'منتجات الإكسسوار والعرض', 3),
  ('منطقة المستلزمات', 'الحقن والسرنجات والشاش والدريسينج والمستلزمات', 4),
  ('منطقة البامبرز والأولويز', 'البامبرزات والأولويز', 5),
  ('الثلاجة', 'الأصناف المحفوظة بالثلاجة', 6),
  ('المخزن الداخلي', 'مخزون الفرع الداخلي', 7)
on conflict (name) do nothing;

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename in (
    'shelf_zones','shelf_sections','shelf_tasks','shelf_task_items','branch_cleaning_tasks',
    'branch_cleaning_items','inventory_count_sessions','inventory_count_items','shortage_items',
    'supplies_items','accessory_items','offers','whatsapp_stories','training_modules',
    'training_assignments','training_quizzes','training_questions'
  )
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', r.tablename, r.tablename);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', r.tablename, r.tablename);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values
  ('customer-request-images', 'customer-request-images', true),
  ('story-assets', 'story-assets', true),
  ('offer-assets', 'offer-assets', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
