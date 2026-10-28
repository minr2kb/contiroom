-- Auth identity survives handle changes. Existing documents were created by
-- their current owners; a clone receives its own creator and creation date.
alter table public.songs
  add column creator_user_id uuid references auth.users (id) on delete restrict,
  add column artist text,
  -- Keep provenance even when the source song is deleted.
  add column origin_song_id text;
update public.songs set creator_user_id = owner_id;
alter table public.songs
  alter column creator_user_id set not null,
  alter column creator_user_id set default auth.uid(),
  add constraint songs_artist_not_blank check (artist is null or btrim(artist) <> ''),
  add constraint songs_origin_not_self check (origin_song_id is null or origin_song_id <> id);

alter table public.contis
  add column creator_user_id uuid references auth.users (id) on delete restrict;
update public.contis set creator_user_id = owner_id;
alter table public.contis
  alter column creator_user_id set not null,
  alter column creator_user_id set default auth.uid();

create index songs_creator_user_id_idx on public.songs (creator_user_id);
create index songs_origin_song_id_idx on public.songs (origin_song_id) where origin_song_id is not null;
create index contis_creator_user_id_idx on public.contis (creator_user_id);

create function public.guard_song_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.creator_user_id is distinct from new.owner_id then
      raise exception 'Song creator must be the owner';
    end if;
    new.created_at := now();
    if new.origin_song_id is not null then
      perform 1 from public.songs s
       where s.id = new.origin_song_id
         and (s.visibility = 'public' or s.owner_id = new.owner_id)
       for share;
      if not found then
        raise exception 'Original song is unavailable';
      end if;
    end if;
  elsif new.creator_user_id is distinct from old.creator_user_id
     or new.created_at is distinct from old.created_at
     or new.origin_song_id is distinct from old.origin_song_id then
    raise exception 'Song creator, creation date, and origin cannot be changed';
  end if;
  return new;
end;
$$;
create trigger guard_song_metadata before insert or update on public.songs
  for each row execute function public.guard_song_metadata();

create function public.guard_conti_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.creator_user_id is distinct from new.owner_id then
      raise exception 'Conti creator must be the owner';
    end if;
    new.created_at := now();
  elsif new.creator_user_id is distinct from old.creator_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Conti creator and creation date cannot be changed';
  end if;
  return new;
end;
$$;
create trigger guard_conti_metadata before insert or update on public.contis
  for each row execute function public.guard_conti_metadata();

drop policy "Create own songs" on public.songs;
create policy "Create own songs" on public.songs
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and creator_user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())));
drop policy "Update own songs" on public.songs;
create policy "Update own songs" on public.songs
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and creator_user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())));
drop policy "Create own contis" on public.contis;
create policy "Create own contis" on public.contis
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and creator_user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())));
drop policy "Update own contis" on public.contis;
create policy "Update own contis" on public.contis
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and creator_user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())));
