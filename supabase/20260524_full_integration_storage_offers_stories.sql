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

alter table if exists public.customers
  add column if not exists team_notes text,
  add column if not exists handling_notes text,
  add column if not exists customer_flags jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.employee_transactions
  add column if not exists executor_name text,
  add column if not exists approved_by_name text,
  add column if not exists clean_reason text,
  add column if not exists display_reason text,
  add column if not exists item_name text,
  add column if not exists item_quantity numeric,
  add column if not exists source_label text,
  add column if not exists display_source text,
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table if exists public.customer_requests
  add column if not exists item_image_url text,
  add column if not exists item_image_path text,
  add column if not exists medicine_image_url text,
  add column if not exists requested_at timestamptz default now(),
  add column if not exists needed_by_date date,
  add column if not exists expected_fulfillment_days integer,
  add column if not exists potential_source_id uuid,
  add column if not exists potential_source_text text;

create table if not exists public.customer_request_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  image_path text,
  branch text,
  item_name text,
  item_code text,
  current_qty numeric default 0,
  original_price numeric default 0,
  discount_type text,
  discount_value numeric default 0,
  final_price numeric default 0,
  start_date date,
  end_date date,
  status text default 'active',
  has_doctor_incentive boolean default false,
  doctor_incentive_type text,
  doctor_incentive_value numeric default 0,
  incentive_notes text,
  team_notes text,
  whatsapp_script text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.offers
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists item_name text,
  add column if not exists item_code text,
  add column if not exists current_qty numeric default 0,
  add column if not exists original_price numeric default 0,
  add column if not exists final_price numeric default 0,
  add column if not exists has_doctor_incentive boolean default false,
  add column if not exists doctor_incentive_type text,
  add column if not exists doctor_incentive_value numeric default 0,
  add column if not exists incentive_notes text,
  add column if not exists team_notes text,
  add column if not exists whatsapp_script text,
  add column if not exists initial_qty numeric default 0,
  add column if not exists remaining_qty numeric default 0,
  add column if not exists boxes_dispensed numeric default 0,
  add column if not exists sales_count integer default 0,
  add column if not exists sales_value numeric default 0,
  add column if not exists customer_id uuid,
  add column if not exists customer_code text,
  add column if not exists customer_name text,
  add column if not exists doctor_name text;

create table if not exists public.offer_dispenses (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.offers(id) on delete set null,
  customer_id uuid,
  customer_name text,
  customer_code text,
  customer_phone text,
  doctor_id uuid,
  doctor_name text,
  invoice_no text,
  quantity numeric default 1,
  sale_price numeric default 0,
  discount_value numeric default 0,
  total_value numeric default 0,
  dispensed_at timestamptz default now(),
  branch text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_stories (
  id uuid primary key default gen_random_uuid(),
  title text,
  story_date date,
  story_time time,
  story_order integer,
  story_type text,
  image_url text,
  image_path text,
  video_url text,
  related_offer_id uuid references public.offers(id) on delete set null,
  related_item_name text,
  related_item_code text,
  planned_quantity numeric default 0,
  uploaded_by_staff_id uuid,
  uploaded_by_staff_name text,
  branch text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.whatsapp_stories
  add column if not exists story_time time,
  add column if not exists image_url text,
  add column if not exists image_path text,
  add column if not exists video_url text,
  add column if not exists related_offer_id uuid,
  add column if not exists related_item_name text,
  add column if not exists related_item_code text,
  add column if not exists planned_quantity numeric default 0,
  add column if not exists uploaded_by_staff_id uuid,
  add column if not exists uploaded_by_staff_name text,
  add column if not exists branch text,
  add column if not exists doctor_name text,
  add column if not exists boxes_dispensed numeric default 0,
  add column if not exists customer_id uuid,
  add column if not exists customer_code text,
  add column if not exists customer_name text,
  add column if not exists sales_value numeric default 0;

create table if not exists public.story_performance_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.whatsapp_stories(id) on delete cascade,
  report_date date,
  views_count integer default 0,
  inquiries_count integer default 0,
  sales_count integer default 0,
  sales_value numeric default 0,
  report_notes text,
  report_by_staff_id uuid,
  report_by_staff_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_sales (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.whatsapp_stories(id) on delete cascade,
  customer_id uuid,
  customer_name text,
  customer_code text,
  customer_phone text,
  doctor_id uuid,
  doctor_name text,
  item_name text,
  item_code text,
  quantity numeric default 1,
  invoice_no text,
  sale_value numeric default 0,
  sold_at timestamptz default now(),
  branch text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.manager_role_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid,
  staff_name text not null,
  role_key text not null,
  role_label text,
  branch text,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manager_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid,
  staff_name text not null,
  role_key text not null,
  month_cycle text,
  score numeric default 0,
  status text default 'pending',
  details jsonb default '{}'::jsonb,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['customers','customer_request_sources','offers','whatsapp_stories','story_performance_reports','manager_role_assignments','manager_performance_reviews']
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
      execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    end if;
  end loop;
end $$;

create index if not exists idx_offers_status_dates on public.offers(status, start_date, end_date);
create index if not exists idx_offers_branch on public.offers(branch);
create index if not exists idx_offer_dispenses_offer_id on public.offer_dispenses(offer_id);
create index if not exists idx_offer_dispenses_customer_code on public.offer_dispenses(customer_code);
create index if not exists idx_offer_dispenses_doctor_name on public.offer_dispenses(doctor_name);
create index if not exists idx_whatsapp_stories_story_date on public.whatsapp_stories(story_date);
create index if not exists idx_story_reports_story_id on public.story_performance_reports(story_id);
create index if not exists idx_story_sales_story_id on public.story_sales(story_id);
create index if not exists idx_story_sales_customer_code on public.story_sales(customer_code);
create index if not exists idx_story_sales_doctor_name on public.story_sales(doctor_name);
create index if not exists idx_customer_requests_customer_code on public.customer_requests(customer_code);
create index if not exists idx_customer_requests_customer_phone on public.customer_requests(customer_phone);
create index if not exists idx_employee_transactions_source on public.employee_transactions(source);
create index if not exists idx_employee_transactions_staff_id on public.employee_transactions(staff_id);

insert into storage.buckets (id, name, public)
values
  ('customer-request-images', 'customer-request-images', true),
  ('offer-assets', 'offer-assets', true),
  ('story-assets', 'story-assets', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  create policy "Public read Dawaa image buckets"
  on storage.objects for select
  using (bucket_id in ('customer-request-images', 'offer-assets', 'story-assets'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Upload Dawaa image buckets"
  on storage.objects for insert
  with check (
    bucket_id in ('customer-request-images', 'offer-assets', 'story-assets')
    and lower(split_part(name, '.', array_length(string_to_array(name, '.'), 1))) in ('jpg','jpeg','png','webp','gif')
  );
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
