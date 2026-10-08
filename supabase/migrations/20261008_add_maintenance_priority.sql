-- MavRent: align maintenance schema with the web app.
alter table public.maintenance_requests
  add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_requests_priority_check'
      and conrelid = 'public.maintenance_requests'::regclass
  ) then
    alter table public.maintenance_requests
      add constraint maintenance_requests_priority_check
      check (priority in ('low','medium','high'));
  end if;
end $$;
