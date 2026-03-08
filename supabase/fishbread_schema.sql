-- Fishbread map schema (anonymous reports/comments + admin moderation)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.fishbread_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  flavor text not null default '팥',
  detail text not null default '',
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  up_count integer not null default 0,
  down_count integer not null default 0,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.fishbread_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.fishbread_reports(id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
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

drop policy if exists "anon can read approved reports" on public.fishbread_reports;
create policy "anon can read approved reports"
  on public.fishbread_reports
  for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "anon can insert pending reports" on public.fishbread_reports;
drop policy if exists "anon can insert reports" on public.fishbread_reports;
create policy "anon can insert reports"
  on public.fishbread_reports
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved'));

drop policy if exists "anon can read approved comments" on public.fishbread_comments;
create policy "anon can read approved comments"
  on public.fishbread_comments
  for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "anon can insert pending comments" on public.fishbread_comments;
drop policy if exists "anon can insert comments" on public.fishbread_comments;
create policy "anon can insert comments"
  on public.fishbread_comments
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved'));

drop policy if exists "anon can insert vote rows" on public.fishbread_votes;
create policy "anon can insert vote rows"
  on public.fishbread_votes
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins can moderate reports" on public.fishbread_reports;
create policy "admins can moderate reports"
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

drop policy if exists "admins can moderate comments" on public.fishbread_comments;
create policy "admins can moderate comments"
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

drop policy if exists "admins can read admin emails" on public.fishbread_admins;
create policy "admins can read admin emails"
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
  if p_vote_type not in ('up', 'down') then
    raise exception 'invalid vote type';
  end if;

  insert into public.fishbread_votes(report_id, device_hash, vote_type)
  values (p_report_id, p_device_hash, p_vote_type)
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.fishbread_reports
    set
      up_count = up_count + case when p_vote_type = 'up' then 1 else 0 end,
      down_count = down_count + case when p_vote_type = 'down' then 1 else 0 end
    where id = p_report_id
      and status = 'approved'
    returning * into r;
    return query select true, coalesce(r.up_count, 0), coalesce(r.down_count, 0);
  else
    select * into r from public.fishbread_reports where id = p_report_id;
    return query select false, coalesce(r.up_count, 0), coalesce(r.down_count, 0);
  end if;
end;
$$;

revoke all on function public.submit_fishbread_vote(uuid, text, text) from public;
grant execute on function public.submit_fishbread_vote(uuid, text, text) to anon, authenticated;

-- Add at least one admin email after running this script.
insert into public.fishbread_admins(email)
values ('admin@example.com')
on conflict (email) do nothing;
