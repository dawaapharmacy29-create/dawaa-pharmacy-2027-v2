-- Dawaa Pharmacy 2027
-- Repair monthly incentive baseline and keep employee_transactions as the only live ledger.
-- Safe to run more than once.

alter table if exists public.staff
  add column if not exists points numeric default 500,
  add column if not exists max_points numeric default 500;

update public.staff
set max_points = 500
where max_points is null or max_points < 500;

-- Old staff.points values such as 300 are legacy snapshots. The app now calculates
-- live points from employee_transactions, but this keeps old screens and exports sane.
update public.staff
set points = 500
where points is null or points < 500;

alter table if exists public.employee_transactions
  add column if not exists staff_id uuid,
  add column if not exists employee_id uuid,
  add column if not exists employee_name text,
  add column if not exists type text,
  add column if not exists points numeric,
  add column if not exists points_delta numeric,
  add column if not exists status text default 'approved',
  add column if not exists month_cycle text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.employee_transactions
set status = 'approved'
where status is null or lower(status) in ('active', 'معتمد', 'تم الاعتماد', 'مقبول');

update public.employee_transactions
set status = 'pending'
where lower(status) in ('قيد المراجعة', 'معلق');

update public.employee_transactions
set status = 'rejected'
where lower(status) in ('cancelled', 'canceled', 'ملغي', 'ملغى', 'مرفوض');

-- Normalize deltas so penalty rows always subtract and reward rows always add.
update public.employee_transactions
set points_delta = -abs(coalesce(points_delta, points, 0))
where lower(coalesce(type, '')) in ('penalty', 'deduction', 'خصم', 'جزاء')
  and coalesce(points_delta, points, 0) <> 0;

update public.employee_transactions
set points_delta = abs(coalesce(points_delta, points, 0))
where lower(coalesce(type, '')) in ('reward', 'bonus', 'مكافأة')
  and coalesce(points_delta, points, 0) <> 0;

update public.employee_transactions
set points = abs(coalesce(points, points_delta, 0))
where points is null or points < 0;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='staff' and column_name='max_points') then
    create index if not exists idx_staff_max_points on public.staff(max_points);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_transactions' and column_name='staff_id') then
    create index if not exists idx_employee_transactions_staff_id on public.employee_transactions(staff_id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_transactions' and column_name='employee_id') then
    create index if not exists idx_employee_transactions_employee_id on public.employee_transactions(employee_id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_transactions' and column_name='employee_name') then
    create index if not exists idx_employee_transactions_employee_name on public.employee_transactions(employee_name);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_transactions' and column_name='status') then
    create index if not exists idx_employee_transactions_status on public.employee_transactions(status);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_transactions' and column_name='month_cycle') then
    create index if not exists idx_employee_transactions_month_cycle on public.employee_transactions(month_cycle);
  end if;
end $$;

notify pgrst, 'reload schema';
