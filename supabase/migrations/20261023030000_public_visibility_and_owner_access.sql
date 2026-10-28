-- Visibility is explicit and private by default. Existing documents remain private.
alter table public.songs
  add column visibility text not null default 'private'
  check (visibility in ('private', 'public'));
alter table public.contis
  add column visibility text not null default 'private'
  check (visibility in ('private', 'public'));
alter table public.live_sessions
  add column visibility text not null default 'private'
  check (visibility in ('private', 'public'));

create index songs_public_idx on public.songs (id) where visibility = 'public';
create index contis_public_idx on public.contis (id) where visibility = 'public';
create index live_sessions_public_idx on public.live_sessions (id) where visibility = 'public';

-- An anonymous viewer of a public conti must be able to read every referenced
-- song. Keep this true when either side changes visibility or conti items.
create function public.check_public_conti_songs()
returns trigger language plpgsql set search_path = '' as $$
declare
  item jsonb;
begin
  if new.visibility = 'public' then
    for item in select value from jsonb_array_elements(new.items) loop
      perform 1 from public.songs s
       where s.id = item->>'songId'
         and s.owner_id = new.owner_id
         and s.visibility = 'public'
       for share;
      if not found then
        raise exception 'Public conti requires public songs';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create function public.check_private_song_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.visibility = 'private' then
    perform 1 from public.contis c
     where c.owner_id = new.owner_id
       and c.visibility = 'public'
       and c.items @> jsonb_build_array(jsonb_build_object('songId', new.id))
     for share;
    if found then
      raise exception 'Song is used by a public conti';
    end if;
  end if;
  return new;
end;
$$;

create function public.check_public_live_conti()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.visibility = 'public' then
    perform 1 from public.contis c
     where c.id = new.conti_id
       and c.owner_id = new.owner_id
       and c.visibility = 'public'
     for share;
    if not found then
      raise exception 'Public live session requires a public conti';
    end if;
  end if;
  return new;
end;
$$;

create function public.check_private_conti_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.visibility = 'private' then
    perform 1 from public.live_sessions l
     where l.conti_id = new.id
       and l.owner_id = new.owner_id
       and l.visibility = 'public'
     for share;
    if found then
      raise exception 'Conti is used by a public live session';
    end if;
  end if;
  return new;
end;
$$;

create trigger check_public_conti_songs
  after insert or update of items, visibility on public.contis
  for each row execute function public.check_public_conti_songs();
create trigger check_private_song_references
  after update of visibility on public.songs
  for each row when (old.visibility = 'public' and new.visibility = 'private')
  execute function public.check_private_song_references();
create trigger check_public_live_conti
  after insert or update of visibility on public.live_sessions
  for each row execute function public.check_public_live_conti();
create trigger check_private_conti_references
  after update of visibility on public.contis
  for each row when (old.visibility = 'public' and new.visibility = 'private')
  execute function public.check_private_conti_references();

drop policy "Admin owns songs" on public.songs;
drop policy "Admin owns contis" on public.contis;
drop policy "Admin owns live sessions" on public.live_sessions;
drop policy "Admin can read own role" on public.app_admins;
revoke all on public.app_admins from public, anon, authenticated;

grant select on public.songs, public.contis, public.live_sessions to anon;

create policy "Read own or public songs" on public.songs
  for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "Create own songs" on public.songs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own songs" on public.songs
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Delete own songs" on public.songs
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Read own or public contis" on public.contis
  for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "Create own contis" on public.contis
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own contis" on public.contis
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Delete own contis" on public.contis
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Read own or public live sessions" on public.live_sessions
  for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "Create own live sessions" on public.live_sessions
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own live sessions" on public.live_sessions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Delete own live sessions" on public.live_sessions
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Public participants may control only the cursor and display options when the
-- owner opted in. The owner supplies title and lyrics through ordinary RLS.
-- This function's definer can bypass RLS, so every authorization condition is
-- part of the UPDATE predicate. The table's snapshot check validates payloads.
create function public.update_live_session_snapshot(session_id text, next_snapshot jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(next_snapshot) is distinct from 'object'
     or jsonb_typeof(next_snapshot->'cursor') is distinct from 'number'
     or next_snapshot->>'cursor' !~ '^[0-9]{1,9}$'
     or jsonb_typeof(next_snapshot->'options') is distinct from 'object'
     or jsonb_typeof(next_snapshot->'options'->'count') is distinct from 'number'
     or next_snapshot->'options'->>'count' not in ('2', '3')
     or jsonb_typeof(next_snapshot->'options'->'showChords') is distinct from 'boolean'
     or jsonb_typeof(next_snapshot->'options'->'showForm') is distinct from 'boolean'
     or jsonb_typeof(next_snapshot->'options'->'showNextLyrics') is distinct from 'boolean' then
    raise exception 'Invalid live controls';
  end if;

  update public.live_sessions
     set snapshot = snapshot || jsonb_build_object(
       'cursor', next_snapshot->'cursor',
       'options', next_snapshot->'options'
     )
   where id = session_id
     and visibility = 'public'
     and allow_anyone_control = true
     and active = true
     and snapshot is not null;
  return found;
end;
$$;

revoke all on function public.update_live_session_snapshot(text, jsonb) from public;
grant execute on function public.update_live_session_snapshot(text, jsonb) to anon, authenticated;
