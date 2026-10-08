-- MavRent: fix receipt notifications and maintenance status vocabulary
-- Receipt notifications must target the tenant's auth/profile UUID,
-- not the tenant-row UUID.

create or replace function public.notify_receipt_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  tenant_profile uuid;
begin
  select t.profile_id
    into tenant_profile
  from public.tenants t
  where t.id = new.tenant_id;

  if tenant_profile is not null then
    perform public.create_notification(
      tenant_profile,
      '🧾 Receipt issued',
      'Your payment receipt ' || new.receipt_number || ' has been issued.',
      'receipt',
      new.id
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.notify_receipt_created() from public;
grant execute on function public.notify_receipt_created() to authenticated;

-- maintenance_requests.status already uses:
-- pending, in_progress, completed, cancelled
-- The web app's landlord "Close" action now writes cancelled.
