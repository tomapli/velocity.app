-- Allowlist: insert emails that may sign up. The before_user_created hook
-- rejects anyone not listed. After signup, user_id is filled in by trigger.
insert into public.authorized_users (email)
values ('protitom@gmail.com')
on conflict (email) do nothing;
