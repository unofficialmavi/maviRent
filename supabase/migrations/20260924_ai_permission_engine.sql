-- MavRent AI Permission Engine + Audit Log + Care Mode
-- Run this migration once in Supabase SQL Editor.

create table if not exists public.ai_permission_policies (
  action text primary key,
  permission_level text not null check (permission_level in ('read_only','prepare','confirm','never')),
  care_mode_allowed boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_care_mode (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Africa/Kampala',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,
  action text not null,
  action_type text,
  status text not null check (status in ('prepared','confirmed','cancelled','failed','denied','executed','skipped')),
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  requires_confirmation boolean not null default false,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_audit_log_user_created_idx
  on public.ai_audit_log(user_id, created_at desc);

create table if not exists public.ai_care_tasks (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  task_type text not null,
  status text not null default 'prepared'
    check (status in ('prepared','executed','skipped','failed')),
  priority text not null default 'normal',
  target_type text,
  target_id uuid,
  title text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  run_date date not null default current_date,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  unique(landlord_id, task_key, run_date)
);

create index if not exists ai_care_tasks_landlord_date_idx
  on public.ai_care_tasks(landlord_id, run_date desc);

insert into public.ai_permission_policies(action,permission_level,care_mode_allowed,description)
values
 ('read_data','read_only',true,'Read rental data and answer questions'),
 ('prepare_reminder','prepare',true,'Prepare a routine rent reminder'),
 ('send_reminder','confirm',false,'Send a tenant reminder through an external channel'),
 ('record_payment','confirm',false,'Record a payment and allocate it to rent'),
 ('create_receipt','confirm',false,'Create a receipt for a confirmed payment'),
 ('assign_tenant','confirm',false,'Assign a tenant to a unit'),
 ('change_rent','confirm',false,'Change rent terms'),
 ('approve_expense','confirm',false,'Approve an expense'),
 ('refund','confirm',false,'Issue or approve a refund'),
 ('update_maintenance','confirm',false,'Change maintenance state or details'),
 ('delete_property','never',false,'Delete a property'),
 ('delete_financial_record','never',false,'Delete financial history'),
 ('transfer_money','never',false,'Transfer money'),
 ('change_ownership','never',false,'Change ownership'),
 ('delete_tenant_history','never',false,'Permanently delete tenant history')
on conflict(action) do update set
 permission_level=excluded.permission_level,
 care_mode_allowed=excluded.care_mode_allowed,
 description=excluded.description,
 updated_at=now();

alter table public.ai_permission_policies enable row level security;
alter table public.ai_care_mode enable row level security;
alter table public.ai_audit_log enable row level security;
alter table public.ai_care_tasks enable row level security;

drop policy if exists ai_permission_policies_read on public.ai_permission_policies;
create policy ai_permission_policies_read
on public.ai_permission_policies for select
to authenticated
using (true);

drop policy if exists ai_care_mode_own on public.ai_care_mode;
create policy ai_care_mode_own
on public.ai_care_mode for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ai_audit_log_own on public.ai_audit_log;
create policy ai_audit_log_own
on public.ai_audit_log for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists ai_care_tasks_own on public.ai_care_tasks;
create policy ai_care_tasks_own
on public.ai_care_tasks for select
to authenticated
using (auth.uid() = landlord_id);

revoke all on public.ai_audit_log from anon;
revoke all on public.ai_care_tasks from anon;
revoke all on public.ai_care_mode from anon;

grant select on public.ai_permission_policies to authenticated;
grant select on public.ai_audit_log to authenticated;
grant select on public.ai_care_tasks to authenticated;
grant select,insert,update,delete on public.ai_care_mode to authenticated;

-- The server endpoints use the service-role key and therefore bypass these RLS policies.
