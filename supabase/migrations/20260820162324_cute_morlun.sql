-- Ongoing allowlist enforcement: JWT claim on every token + live kick via
-- private realtime broadcast when an authorized_users row is removed/unlinked.

comment on table public.authorized_users is
  'Allowlist of email addresses permitted to access the app. user_id is set when the matching auth user exists. Removal revokes access (JWT claim + realtime kick).';

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  uid uuid;
  signup_email text;
  is_authorized boolean;
begin
  uid := nullif(event ->> 'user_id', '')::uuid;
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  signup_email := lower(trim(coalesce(claims ->> 'email', '')));

  select exists (
    select 1
    from public.authorized_users as authorized_users
    where authorized_users.user_id = uid
       or (
         authorized_users.user_id is null
         and signup_email <> ''
         and authorized_users.email = signup_email
       )
  )
  into is_authorized;

  if not is_authorized then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'message', 'This email is not authorized to access the app.',
        'http_code', 403
      )
    );
  end if;

  claims := jsonb_set(claims, '{app_authorized}', 'true'::jsonb);

  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.broadcast_authorized_user_access_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_user_id uuid;
begin
  if tg_op = 'DELETE' then
    revoked_user_id := old.user_id;
  elsif tg_op = 'UPDATE'
    and old.user_id is not null
    and old.user_id is distinct from new.user_id then
    revoked_user_id := old.user_id;
  end if;

  if revoked_user_id is not null then
    perform realtime.send(
      jsonb_build_object('user_id', revoked_user_id),
      'access_revoked',
      'user:' || revoked_user_id::text || ':auth',
      true
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.broadcast_authorized_user_access_revoked() from public;

drop trigger if exists authorized_users_access_revoked on public.authorized_users;

create trigger authorized_users_access_revoked
  after delete or update of user_id on public.authorized_users
  for each row
  execute function public.broadcast_authorized_user_access_revoked();

drop policy if exists "Users can receive own auth access broadcasts" on realtime.messages;

create policy "Users can receive own auth access broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic())
      = 'user:' || (select auth.uid())::text || ':auth'
  );
