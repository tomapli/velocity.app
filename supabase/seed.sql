-- Realtime authorization lives in supabase/migrations/20260612193000_realtime.sql
-- (applied on start / reset, then reapplied by `pnpm db:push` after items exists).
-- Re-run grants and the broadcast trigger here so `supabase start` / `db reset`
-- still attach them when a later migration has already created public.items.

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
