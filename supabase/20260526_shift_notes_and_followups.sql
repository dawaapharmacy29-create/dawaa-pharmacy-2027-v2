-- Dawaa Pharmacy 2027
-- Shift notes + daily customer follow-up repair.
-- Safe to run multiple times. No destructive changes.

create extension if not exists pgcrypto;

alter table if exists public.daily_followups
  add column if not exists customer_code text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists phone text,
  add column if not exists branch text,
  add column if not exists category text,
  add column if not exists suggested_action text,
  add column if not exists followup_status text default 'pending',
  add column if not exists contact_status text,
  add column if not exists contact_result text,
  add column if not exists contacted_at timestamptz,
  add column if not exists responsible_name text,
  add column if not exists followup_summary text,
  add column if not exists followup_result text,
  add column if not exists next_followup_date date,
  add column if not exists last_purchase_date date,
  add column if not exists purchase_count_current_month integer default 0,
  add column if not exists average_monthly_purchase_count numeric default 0,
  add column if not exists purchase_frequency_status text,
  add column if not exists followup_type text,
  add column if not exists priority text,
  add column if not exists purchase_after_followup boolean default false,
  add column if not exists purchase_invoice_no text,
  add column if not exists purchase_amount numeric default 0,
  add column if not exists purchase_date date,
  add column if not exists closed_at timestamptz,
  add column if not exists created_by text,
  add column if not exists created_by_name text,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  note_type text default 'general',
  branch text,
  customer_id uuid null,
  customer_name text,
  customer_phone text,
  invoice_id uuid null,
  invoice_no text,
  author_id text,
  author_name text,
  due_at timestamptz,
  assigned_to_id text,
  assigned_to_name text,
  priority text default 'normal',
  status text default 'new',
  is_recurring boolean default false,
  repeat_days integer,
  recurrence_times text[] default '{}',
  handed_over boolean default false,
  handed_over_at timestamptz,
  closed_at timestamptz,
  closed_by_id text,
  closed_by_name text,
  closure_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.shift_note_logs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.shift_notes(id) on delete cascade,
  action text not null,
  actor_id text,
  actor_name text,
  details text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.shift_note_occurrences (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.shift_notes(id) on delete cascade,
  occurrence_at timestamptz,
  status text default 'pending',
  completed_by_id text,
  completed_by_name text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_daily_followups_date on public.daily_followups(followup_date);
create index if not exists idx_daily_followups_customer_code on public.daily_followups(customer_code);
create index if not exists idx_daily_followups_customer_phone on public.daily_followups(customer_phone);
create index if not exists idx_daily_followups_status on public.daily_followups(followup_status);

create index if not exists idx_shift_notes_due on public.shift_notes(due_at);
create index if not exists idx_shift_notes_status on public.shift_notes(status);
create index if not exists idx_shift_notes_priority on public.shift_notes(priority);
create index if not exists idx_shift_notes_branch on public.shift_notes(branch);
create index if not exists idx_shift_notes_assigned on public.shift_notes(assigned_to_name);
create index if not exists idx_shift_notes_customer_phone on public.shift_notes(customer_phone);
create index if not exists idx_shift_note_logs_note on public.shift_note_logs(note_id);
create index if not exists idx_shift_note_occurrences_note on public.shift_note_occurrences(note_id);
create index if not exists idx_shift_note_occurrences_due on public.shift_note_occurrences(occurrence_at);

do $$
begin
  if exists (select 1 from pg_class where relname = 'shift_notes') then
    alter table public.shift_notes enable row level security;
  end if;
  if exists (select 1 from pg_class where relname = 'shift_note_logs') then
    alter table public.shift_note_logs enable row level security;
  end if;
  if exists (select 1 from pg_class where relname = 'shift_note_occurrences') then
    alter table public.shift_note_occurrences enable row level security;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_notes' and policyname = 'shift_notes_app_access') then
    create policy shift_notes_app_access on public.shift_notes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_note_logs' and policyname = 'shift_note_logs_app_access') then
    create policy shift_note_logs_app_access on public.shift_note_logs for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_note_occurrences' and policyname = 'shift_note_occurrences_app_access') then
    create policy shift_note_occurrences_app_access on public.shift_note_occurrences for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
