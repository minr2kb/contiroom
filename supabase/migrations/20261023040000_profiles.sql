-- Handles are tied to the Auth user ID. A future OAuth migration must link
-- providers to the existing Auth user to preserve ownership and the handle.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{1,30}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to authenticated;

create policy "Anyone can read handles" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users can register their own handle" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
