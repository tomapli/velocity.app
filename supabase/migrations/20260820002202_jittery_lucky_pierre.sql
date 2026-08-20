-- Grants and the broadcast trigger attach only after public.items exists.
-- The earlier realtime migration no-ops when that table is missing.

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
