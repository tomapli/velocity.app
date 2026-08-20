-- Custom SQL migration file, put your code below! --
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_profiles" TO "authenticated";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "scheduled_scrapes" TO "authenticated";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_posts" TO "authenticated";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_profiles" TO "service_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "scheduled_scrapes" TO "service_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "ig_posts" TO "service_role";

drop policy if exists "Authenticated users can receive ig scrape broadcasts" on realtime.messages;
drop policy if exists "Authenticated users can send ig scrape broadcasts" on realtime.messages;

create policy "Authenticated users can receive scheduled scrape broadcasts"
  on realtime.messages
  for select
  to authenticated
  using ((select realtime.topic()) = 'public:scheduled_scrapes');

create policy "Authenticated users can send scheduled scrape broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check ((select realtime.topic()) = 'public:scheduled_scrapes');

create policy "Authenticated users can receive ig profile broadcasts"
  on realtime.messages
  for select
  to authenticated
  using ((select realtime.topic()) = 'public:ig_profiles');

create policy "Authenticated users can send ig profile broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check ((select realtime.topic()) = 'public:ig_profiles');

create or replace function public.broadcast_scheduled_scrape_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'public:scheduled_scrapes',
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

create or replace function public.broadcast_ig_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'public:ig_profiles',
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

revoke all on function public.broadcast_scheduled_scrape_changes() from public;
revoke all on function public.broadcast_ig_profile_changes() from public;
revoke all on function public.broadcast_ig_scrape_changes() from public;

drop trigger if exists ig_scrapes_broadcast_trigger on public.ig_profiles;
drop trigger if exists scheduled_scrapes_broadcast_trigger on public.scheduled_scrapes;
drop trigger if exists ig_profiles_broadcast_trigger on public.ig_profiles;

create trigger scheduled_scrapes_broadcast_trigger
  after insert or update or delete on public.scheduled_scrapes
  for each row
  execute function public.broadcast_scheduled_scrape_changes();

create trigger ig_profiles_broadcast_trigger
  after insert or update or delete on public.ig_profiles
  for each row
  execute function public.broadcast_ig_profile_changes();
