-- Preserve every existing scrape request before group_id becomes a foreign key.
insert into public.groups (
  id,
  ig_profile_id,
  created_by,
  requested_post_count,
  since_when,
  created_at
)
select distinct on (group_id)
  group_id,
  ig_profile_id,
  started_by,
  requested_post_count,
  since_when,
  created_at
from public.scheduled_scrapes
order by group_id, created_at
on conflict (id) do nothing;

grant select, insert on table public.groups to authenticated;
grant select, insert, delete on table public.groups to service_role;

drop policy if exists "Authenticated users can receive item broadcasts" on realtime.messages;
drop policy if exists "Authenticated users can send item broadcasts" on realtime.messages;
drop function if exists public.broadcast_item_changes();

create policy "Authenticated users can receive group broadcasts"
  on realtime.messages
  for select
  to authenticated
  using ((select realtime.topic()) = 'public:groups');

create policy "Authenticated users can send group broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check ((select realtime.topic()) = 'public:groups');

create or replace function public.broadcast_group_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'public:groups',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  return coalesce(NEW, OLD);
end;
$$;

revoke all on function public.broadcast_group_changes() from public;

create trigger groups_broadcast_trigger
  after insert or update or delete on public.groups
  for each row
  execute function public.broadcast_group_changes();
