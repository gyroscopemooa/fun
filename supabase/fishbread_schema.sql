-- Active project: pzqlzomrvondxikyafvy (manytool organization), migrated 2026-10-29.
-- Fishbread map schema (anonymous reports/comments + admin moderation)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.fishbread_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  flavor text not null default '팥',
  detail text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  up_count integer not null default 0 check (up_count >= 0),
  down_count integer not null default 0 check (down_count >= 0),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.fishbread_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.fishbread_reports(id) on delete cascade,
  body text not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.fishbread_votes (
  report_id uuid not null references public.fishbread_reports(id) on delete cascade,
  device_hash text not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  primary key (report_id, device_hash)
);

create table if not exists public.fishbread_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.fishbread_reports enable row level security;
alter table public.fishbread_comments enable row level security;
alter table public.fishbread_votes enable row level security;
alter table public.fishbread_admins enable row level security;

drop policy if exists reports_read on public.fishbread_reports;
create policy reports_read
  on public.fishbread_reports
  for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "anon can insert pending reports" on public.fishbread_reports;
drop policy if exists reports_insert on public.fishbread_reports;
create policy reports_insert
  on public.fishbread_reports
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved') and length(trim(name)) between 1 and 80 and length(detail)<=1000 and up_count=0 and down_count=0);

drop policy if exists comments_read on public.fishbread_comments;
create policy comments_read
  on public.fishbread_comments
  for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "anon can insert pending comments" on public.fishbread_comments;
drop policy if exists comments_insert on public.fishbread_comments;
create policy comments_insert
  on public.fishbread_comments
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved') and length(trim(body)) between 1 and 2000 and exists(select 1 from public.fishbread_reports r where r.id=report_id and r.status='approved'));

drop policy if exists "anon can insert vote rows" on public.fishbread_votes;
-- Votes are written only through the atomic RPC below.

drop policy if exists reports_admin on public.fishbread_reports;
create policy reports_admin
  on public.fishbread_reports
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.fishbread_admins a
      where a.email = auth.email()
    )
  )
  with check (
    exists (
      select 1
      from public.fishbread_admins a
      where a.email = auth.email()
    )
  );

drop policy if exists comments_admin on public.fishbread_comments;
create policy comments_admin
  on public.fishbread_comments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.fishbread_admins a
      where a.email = auth.email()
    )
  )
  with check (
    exists (
      select 1
      from public.fishbread_admins a
      where a.email = auth.email()
    )
  );

drop policy if exists admins_read on public.fishbread_admins;
create policy admins_read
  on public.fishbread_admins
  for select
  to authenticated
  using (auth.email() = email);

drop function if exists public.submit_fishbread_vote(uuid, text, text);
create or replace function public.submit_fishbread_vote(
  p_report_id uuid,
  p_vote_type text,
  p_device_hash text
)
returns table(applied boolean, up_count integer, down_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  r public.fishbread_reports%rowtype;
begin
  if p_vote_type is null or p_vote_type not in ('up', 'down') or p_device_hash is null or length(trim(p_device_hash)) not between 1 and 128 then
    raise exception 'invalid vote type';
  end if;

  -- Serialize votes for a report and reject missing/unpublished reports.
  select * into r from public.fishbread_reports
  where id = p_report_id and status = 'approved' for update;
  if not found then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.fishbread_votes(report_id, device_hash, vote_type)
  values (p_report_id, p_device_hash, p_vote_type)
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.fishbread_reports as fr
    set
      up_count = fr.up_count + case when p_vote_type = 'up' then 1 else 0 end,
      down_count = fr.down_count + case when p_vote_type = 'down' then 1 else 0 end
    where fr.id = p_report_id
      and fr.status = 'approved'
    returning * into r;
    -- Remove only when down votes exceed up votes by at least 100.
    -- Related comments and vote records are removed through ON DELETE CASCADE.
    if r.down_count - r.up_count >= 100 then
      delete from public.fishbread_reports where id = p_report_id;
    end if;
    return query select true, coalesce(r.up_count, 0), coalesce(r.down_count, 0);
  else
    select * into r from public.fishbread_reports where id = p_report_id;
    return query select false, coalesce(r.up_count, 0), coalesce(r.down_count, 0);
  end if;
end;
$$;

revoke all on function public.submit_fishbread_vote(uuid, text, text) from public;
grant execute on function public.submit_fishbread_vote(uuid, text, text) to anon, authenticated;

-- Register the real administrator in fishbread_admins after creating their Auth user.
-- Do not insert a placeholder administrator.

-- Explicit privileges: public clients cannot set counters or insert votes directly.
revoke all on public.fishbread_reports, public.fishbread_comments, public.fishbread_votes, public.fishbread_admins from anon, authenticated;
grant select on public.fishbread_reports, public.fishbread_comments to anon, authenticated;
grant insert(name,region,flavor,detail,lat,lng,status) on public.fishbread_reports to anon, authenticated;
grant insert(report_id,body,status) on public.fishbread_comments to anon, authenticated;
grant select on public.fishbread_admins to authenticated;
grant update,delete on public.fishbread_reports,public.fishbread_comments to authenticated;
create index if not exists fishbread_reports_status_created on public.fishbread_reports(status,created_at desc);
create index if not exists fishbread_comments_report on public.fishbread_comments(report_id,status,created_at);
