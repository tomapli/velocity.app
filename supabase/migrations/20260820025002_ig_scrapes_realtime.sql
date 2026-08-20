-- Realtime broadcast for ig_scrapes (replaces the empty ig_profiles_realtime placeholder).

drop policy if exists "Authenticated users can receive ig scrape broadcasts" on realtime.messages;
create policy "Authenticated users can receive ig scrape broadcasts"
  on realtime.messages
  for select
  to authenticated
  using ((select realtime.topic()) = 'public:ig_scrapes');

drop policy if exists "Authenticated users can send ig scrape broadcasts" on realtime.messages;
create policy "Authenticated users can send ig scrape broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check ((select realtime.topic()) = 'public:ig_scrapes');

create or replace function public.broadcast_ig_scrape_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'public:ig_scrapes',
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

revoke all on function public.broadcast_ig_scrape_changes() from public;

do $outer$
begin
  if to_regclass('public.ig_scrapes') is null then
    return;
  end if;

  execute 'grant select, insert, update on table public.ig_scrapes to authenticated';
  execute 'drop trigger if exists ig_scrapes_broadcast_trigger on public.ig_scrapes';
  execute $sql$
    create trigger ig_scrapes_broadcast_trigger
      after insert or update or delete on public.ig_scrapes
      for each row
      execute function public.broadcast_ig_scrape_changes()
  $sql$;
end;
$outer$;
