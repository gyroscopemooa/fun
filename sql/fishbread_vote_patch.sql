-- Run in Supabase SQL Editor when vote up/down does not work.

create table if not exists public.fishbread_votes (
  report_id uuid not null references public.fishbread_reports(id) on delete cascade,
  device_hash text not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  primary key (report_id, device_hash)
);

alter table public.fishbread_votes enable row level security;

drop policy if exists "anon can insert vote rows" on public.fishbread_votes;
create policy "anon can insert vote rows"
  on public.fishbread_votes
  for insert
  to anon, authenticated
  with check (true);

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
