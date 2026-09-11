-- DailyPad accounts: run once in Supabase Dashboard > SQL Editor.
-- Uses existing Supabase Auth; do not create a custom password table.
-- Safe to re-run. No existing workspaces are deleted.
begin;

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint workspace_payload_check check (
    jsonb_typeof(data) = 'object'
    and data ->> 'version' = '1'
    and jsonb_typeof(data -> 'tasks') = 'array'
    and jsonb_typeof(data -> 'notes') = 'array'
    and jsonb_typeof(data -> 'habits') = 'array'
    and jsonb_typeof(data -> 'categories') = 'array'
    and jsonb_typeof(data -> 'settings') = 'object'
    and data ?& array['version','tasks','notes','habits','categories','settings']
    and octet_length(data::text) <= 8388608
  )
);

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
revoke all on public.workspaces from anon, authenticated;
grant select, insert, update on public.workspaces to authenticated;

drop policy if exists "Users read own workspace" on public.workspaces;
create policy "Users read own workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own workspace" on public.workspaces;
create policy "Users create own workspace" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own workspace" on public.workspaces;
create policy "Users update own workspace" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Optimistic concurrency: a stale browser cannot silently overwrite another device.
-- SECURITY INVOKER is deliberate; RLS remains enforced under the user's JWT.
create or replace function public.save_workspace(p_data jsonb, p_expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'INVALID_REVISION' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.workspaces (user_id, data, revision, updated_at)
      values (v_uid, p_data, 1, now())
      on conflict (user_id) do nothing
      returning revision into v_revision;
  else
    update public.workspaces
      set data = p_data, revision = revision + 1, updated_at = now()
      where user_id = v_uid and revision = p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'WORKSPACE_CONFLICT' using errcode = '40001';
  end if;
  return v_revision;
end;
$$;
revoke all on function public.save_workspace(jsonb,bigint) from public;
revoke all on function public.save_workspace(jsonb,bigint) from anon;
grant execute on function public.save_workspace(jsonb,bigint) to authenticated;
commit;
