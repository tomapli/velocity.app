-- Allowlist enforcement: only emails in public.authorized_users may sign up.
-- user_id cannot be set in the before-user-created hook (the auth row does not
-- exist yet), so an after-insert trigger on auth.users fills it in.

comment on table public.authorized_users is
  'Allowlist of email addresses permitted to create an account. user_id is set when the matching auth user is created.';

revoke all on table public.authorized_users from anon, authenticated, public;

grant usage on schema public to supabase_auth_admin;
grant select, update on table public.authorized_users to supabase_auth_admin;

create or replace function public.prepare_authorized_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));

  if new.user_id is null then
    select users.id
    into new.user_id
    from auth.users as users
    where lower(trim(users.email)) = new.email
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_authorized_user() from public, anon, authenticated;
grant execute on function public.prepare_authorized_user() to postgres, service_role;

drop trigger if exists authorized_users_prepare on public.authorized_users;

create trigger authorized_users_prepare
  before insert or update of email, user_id on public.authorized_users
  for each row
  execute function public.prepare_authorized_user();

create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text;
  is_authorized boolean;
begin
  signup_email := lower(trim(coalesce(event -> 'user' ->> 'email', '')));

  if signup_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'message', 'An email address is required to sign up.',
        'http_code', 400
      )
    );
  end if;

  select exists (
    select 1
    from public.authorized_users
    where authorized_users.email = signup_email
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

  return '{}'::jsonb;
end;
$$;

revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

create or replace function public.link_authorized_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or trim(new.email) = '' then
    return new;
  end if;

  update public.authorized_users
  set user_id = new.id
  where authorized_users.email = lower(trim(new.email))
    and authorized_users.user_id is null;

  return new;
end;
$$;

revoke all on function public.link_authorized_user() from public, anon, authenticated;
grant execute on function public.link_authorized_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created_link_authorized on auth.users;

create trigger on_auth_user_created_link_authorized
  after insert on auth.users
  for each row
  execute function public.link_authorized_user();

update public.authorized_users as authorized_users
set user_id = users.id
from auth.users as users
where authorized_users.user_id is null
  and authorized_users.email = lower(trim(users.email));
