-- Run this in Supabase SQL Editor
-- Purpose: allow immediate publish inserts from anonymous users

drop policy if exists "anon can insert pending reports" on public.fishbread_reports;
drop policy if exists "anon can insert reports" on public.fishbread_reports;
create policy "anon can insert reports"
  on public.fishbread_reports
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved'));

drop policy if exists "anon can insert pending comments" on public.fishbread_comments;
drop policy if exists "anon can insert comments" on public.fishbread_comments;
create policy "anon can insert comments"
  on public.fishbread_comments
  for insert
  to anon, authenticated
  with check (status in ('pending', 'approved'));
