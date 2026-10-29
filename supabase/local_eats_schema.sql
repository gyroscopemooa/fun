-- Apply in the existing ManyTool Supabase project before deploying the page.
begin;
create table if not exists public.local_eats_places (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 80),
 region text not null check(length(trim(region)) between 1 and 40),
 menu text not null default '' check(length(menu)<=120),
 address text not null check(length(trim(address)) between 1 and 300),
 solo text not null check(solo in ('yes','conditional','no','unknown')),
 solo_note text not null default '' check(length(solo_note)<=300),
 lat double precision not null check(lat between 33 and 39),
 lng double precision not null check(lng between 124 and 132),
 created_at timestamptz not null default now()
);
create table if not exists public.local_eats_reviews (
 id uuid primary key default gen_random_uuid(),
 place_id uuid not null references public.local_eats_places(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 body text not null check(length(trim(body)) between 1 and 1000),
 solo text not null check(solo in ('yes','conditional','no','unknown')),
 created_at timestamptz not null default now()
);
create index if not exists local_eats_reviews_place on public.local_eats_reviews(place_id,created_at desc);
alter table public.local_eats_places enable row level security;
alter table public.local_eats_reviews enable row level security;
drop policy if exists places_read on public.local_eats_places;
create policy places_read on public.local_eats_places for select to anon,authenticated using(true);
drop policy if exists places_insert on public.local_eats_places;
create policy places_insert on public.local_eats_places for insert to anon,authenticated with check(true);
drop policy if exists reviews_read on public.local_eats_reviews;
create policy reviews_read on public.local_eats_reviews for select to anon,authenticated using(true);
drop policy if exists reviews_insert on public.local_eats_reviews;
create policy reviews_insert on public.local_eats_reviews for insert to anon,authenticated with check(true);
grant select,insert on public.local_eats_places,public.local_eats_reviews to anon,authenticated;
commit;
