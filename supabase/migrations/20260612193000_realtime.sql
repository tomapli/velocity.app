-- Hand-authored (before the Drizzle baseline). Realtime.messages policies
-- and the broadcast function do not need public.items. Grants and the
-- trigger no-op until that table exists, then `pnpm db:push` reapplies this file.

drop policy if exists "Authenticated users can receive item broadcasts" on realtime.messages;
create policy "Authenticated users can receive item broadcasts"
  on realtime.messages
  for select
  to authenticated
  using ((select realtime.topic()) = 'public:items');

drop policy if exists "Authenticated users can send item broadcasts" on realtime.messages;
create policy "Authenticated users can send item broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check ((select realtime.topic()) = 'public:items');

create or replace function public.broadcast_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'public:items',
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

revoke all on function public.broadcast_item_changes() from public;

do $outer$
begin
  if to_regclass('public.items') is null then
    return;
  end if;

  execute 'grant select, insert, delete on table public.items to authenticated';
  execute 'drop trigger if exists items_broadcast_trigger on public.items';
  execute $sql$
    create trigger items_broadcast_trigger
      after insert or update or delete on public.items
      for each row
      execute function public.broadcast_item_changes()
  $sql$;
end;
$outer$;
