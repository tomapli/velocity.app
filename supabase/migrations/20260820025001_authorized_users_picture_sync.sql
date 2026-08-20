-- Sync Google profile picture from auth.users metadata into authorized_users on signup and login.

create or replace function public.extract_auth_user_picture(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(coalesce(meta ->> 'picture', meta ->> 'avatar_url')), '')
$$;

revoke all on function public.extract_auth_user_picture(jsonb) from public, anon, authenticated;
grant execute on function public.extract_auth_user_picture(jsonb) to postgres, service_role, supabase_auth_admin;

create or replace function public.link_authorized_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picture text;
begin
  if new.email is null or trim(new.email) = '' then
    return new;
  end if;

  picture := public.extract_auth_user_picture(new.raw_user_meta_data);

  update public.authorized_users
  set
    user_id = new.id,
    picture_url = coalesce(picture, public.authorized_users.picture_url)
  where public.authorized_users.email = lower(trim(new.email))
    and public.authorized_users.user_id is null;

  return new;
end;
$$;

create or replace function public.sync_authorized_user_picture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picture text;
begin
  if new.email is null or trim(new.email) = '' then
    return new;
  end if;

  picture := public.extract_auth_user_picture(new.raw_user_meta_data);

  if picture is null then
    return new;
  end if;

  update public.authorized_users
  set picture_url = picture
  where public.authorized_users.user_id = new.id
     or public.authorized_users.email = lower(trim(new.email));

  return new;
end;
$$;

revoke all on function public.sync_authorized_user_picture() from public, anon, authenticated;
grant execute on function public.sync_authorized_user_picture() to postgres, service_role, supabase_auth_admin;

drop trigger if exists on_auth_user_updated_sync_picture on auth.users;

create trigger on_auth_user_updated_sync_picture
  after update of raw_user_meta_data on auth.users
  for each row
  execute function public.sync_authorized_user_picture();
