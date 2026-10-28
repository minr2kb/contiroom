-- A saved song is a reference, not a copy. Keep its ID when the source is
-- deleted so the library can show that the original is unavailable.
create table public.saved_songs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id text not null check (btrim(song_id) <> ''),
  saved_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
create index saved_songs_song_id_idx on public.saved_songs (song_id);
create index saved_songs_user_saved_at_idx on public.saved_songs (user_id, saved_at desc);

alter table public.saved_songs enable row level security;
revoke all on public.saved_songs from public, anon, authenticated;
grant select, insert, delete on public.saved_songs to authenticated;
create policy "Read own saved songs" on public.saved_songs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Save another user's public song" on public.saved_songs
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
    and exists (
      select 1 from public.songs s
      where s.id = song_id and s.visibility = 'public' and s.owner_id <> (select auth.uid())
    )
  );
create policy "Remove own saved songs" on public.saved_songs
  for delete to authenticated using (user_id = (select auth.uid()));

-- Retained favorite and origin IDs must never point to a newly created song.
-- Reserve every ID at creation so concurrent delete/insert cannot race.
create table public.song_id_registry (
  id text primary key,
  deleted_at timestamptz
);
insert into public.song_id_registry (id) select id from public.songs;
alter table public.song_id_registry enable row level security;
revoke all on public.song_id_registry from public, anon, authenticated;

create function public.guard_song_id_reuse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.song_id_registry set deleted_at = now() where id = old.id;
    return old;
  end if;
  perform 1 from public.song_id_registry r where r.id = new.id;
  if found then
    -- Existing-row upserts execute BEFORE INSERT triggers before ON CONFLICT.
    -- They remain valid while the original row still exists.
    perform 1 from public.songs s where s.id = new.id for key share;
    if not found then
      raise exception 'Deleted song ID cannot be reused';
    end if;
  else
    insert into public.song_id_registry (id) values (new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.guard_song_id_reuse() from public, anon, authenticated;
create trigger guard_song_id_reuse_insert before insert on public.songs
  for each row execute function public.guard_song_id_reuse();
create trigger guard_song_id_reuse_delete before delete on public.songs
  for each row execute function public.guard_song_id_reuse();

-- A source link is proof of an actual initial copy. Existing-row upserts are
-- checked by guard_song_metadata; a fresh clone must match its public source.
create function public.guard_song_clone_provenance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_song public.songs%rowtype;
begin
  if new.origin_song_id is null then return new; end if;
  perform 1 from public.songs s where s.id = new.id for key share;
  if found then return new; end if;

  select s.* into source_song from public.songs s
   where s.id = new.origin_song_id and s.visibility = 'public'
   for share;
  if not found then
    raise exception 'Clone source is unavailable';
  end if;
  if new.title is distinct from source_song.title
     or new.base_key is distinct from source_song.base_key
     or new.bpm is distinct from source_song.bpm
     or new.sections is distinct from source_song.sections
     or new.artist is distinct from source_song.artist then
    raise exception 'Clone content must initially match its source';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_song_clone_provenance() from public, anon, authenticated;
create trigger guard_song_clone_provenance before insert on public.songs
  for each row execute function public.guard_song_clone_provenance();

-- A conti can use its owner's song or another user's currently public song.
-- An unchanged item may remain after its source becomes private or is deleted;
-- editing that item must wait until the source is available again.
create or replace function public.validate_conti_document()
returns trigger language plpgsql set search_path = '' as $$
declare
  item jsonb;
  step jsonb;
  song_sections jsonb;
  item_ids text[] := '{}';
  step_ids text[];
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.owner_id <> old.owner_id) then
    raise exception 'Conti identity and owner cannot be changed';
  end if;
  if jsonb_typeof(new.items) is distinct from 'array' then
    raise exception 'Conti items must be an array';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'id') is distinct from 'string'
       or btrim(item->>'id') = ''
       or jsonb_typeof(item->'songId') is distinct from 'string'
       or btrim(item->>'songId') = ''
       or jsonb_typeof(item->'form') is distinct from 'array' then
      raise exception 'Invalid conti item';
    end if;
    if item ? 'key' and (jsonb_typeof(item->'key') is distinct from 'string' or btrim(item->>'key') = '') then
      raise exception 'Invalid conti item key';
    end if;
    if item ? 'bpm' then
      if jsonb_typeof(item->'bpm') is distinct from 'number' then
        raise exception 'Invalid conti item BPM';
      end if;
      if (item->>'bpm')::numeric <= 0 then
        raise exception 'Invalid conti item BPM';
      end if;
    end if;
    if item->>'id' = any(item_ids) then
      raise exception 'Duplicate conti item ID: %', item->>'id';
    end if;
    item_ids := array_append(item_ids, item->>'id');
    select s.sections into song_sections
      from public.songs s
      where s.id = item->>'songId'
        and (s.owner_id = new.owner_id or s.visibility = 'public');
    if not found then
      if tg_op = 'UPDATE' then
        if old.items @> jsonb_build_array(item) then
          continue;
        end if;
      end if;
      raise exception 'Conti song % is unavailable', item->>'songId';
    end if;
    step_ids := '{}';
    for step in select value from jsonb_array_elements(item->'form') loop
      if jsonb_typeof(step) is distinct from 'object'
         or jsonb_typeof(step->'id') is distinct from 'string'
         or btrim(step->>'id') = ''
         or jsonb_typeof(step->'sectionId') is distinct from 'string'
         or btrim(step->>'sectionId') = '' then
        raise exception 'Invalid conti form step';
      end if;
      if step->>'id' = any(step_ids) then
        raise exception 'Duplicate conti form step ID: %', step->>'id';
      end if;
      step_ids := array_append(step_ids, step->>'id');
      if not song_sections @> jsonb_build_array(jsonb_build_object('id', step->>'sectionId')) then
        raise exception 'Conti section % is not in song %', step->>'sectionId', item->>'songId';
      end if;
    end loop;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;

-- Existing public contis retain unavailable references as placeholders. New
-- items and changed items still require a public source song.
create or replace function public.check_public_conti_songs()
returns trigger language plpgsql set search_path = '' as $$
declare
  item jsonb;
begin
  if new.visibility = 'public' then
    for item in select value from jsonb_array_elements(new.items) loop
      perform 1 from public.songs s
       where s.id = item->>'songId' and s.visibility = 'public';
      if not found then
        if tg_op = 'UPDATE' then
          if old.items @> jsonb_build_array(item) then
            continue;
          end if;
        end if;
        raise exception 'Public conti requires public songs';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Withdrawal is allowed even when a conti refers to the song. End and clear
-- every referencing live session so its snapshot cannot retain withdrawn lyrics.
drop trigger check_private_song_references on public.songs;
drop trigger cleanup_deleted_song on public.songs;
create function public.withdraw_song_from_live_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  should_withdraw boolean := false;
begin
  if tg_op = 'DELETE' then
    should_withdraw := true;
  elsif old.visibility is distinct from new.visibility
     or old.title is distinct from new.title
     or old.base_key is distinct from new.base_key
     or old.bpm is distinct from new.bpm
     or old.sections is distinct from new.sections
     or old.artist is distinct from new.artist then
    should_withdraw := true;
  end if;
  if should_withdraw then
    update public.live_sessions l
       set active = false, snapshot = null
     where (l.active or l.snapshot is not null)
       and exists (
         select 1 from public.contis c
          where c.id = l.conti_id
            and c.items @> jsonb_build_array(jsonb_build_object('songId', old.id))
       );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.withdraw_song_from_live_sessions() from public, anon, authenticated;
create trigger withdraw_song_from_live_sessions
  after update of visibility, title, base_key, bpm, sections, artist or delete on public.songs
  for each row execute function public.withdraw_song_from_live_sessions();

-- A changed conti invalidates every previously published snapshot, including
-- a snapshot of a song that has just been removed from its items.
create function public.invalidate_conti_live_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.live_sessions l
     set active = false, snapshot = null
   where l.conti_id = new.id
     and (l.active or l.snapshot is not null);
  return new;
end;
$$;
revoke all on function public.invalidate_conti_live_sessions() from public, anon, authenticated;
create trigger invalidate_conti_live_sessions
  after update of items on public.contis
  for each row when (old.items is distinct from new.items)
  execute function public.invalidate_conti_live_sessions();

-- Every snapshot must use songs readable by the session owner. A public
-- snapshot requires every source to remain public.
create function public.guard_live_snapshot_songs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  conti_items jsonb;
begin
  if new.snapshot is not null then
    select c.items into conti_items from public.contis c where c.id = new.conti_id;
    for item in select value from jsonb_array_elements(conti_items) loop
      perform 1 from public.songs s
       where s.id = item->>'songId'
         and (s.owner_id = new.owner_id or s.visibility = 'public')
         and (new.visibility <> 'public' or s.visibility = 'public')
       for share;
      if not found then
        raise exception 'Live snapshot requires available songs';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger guard_live_snapshot_songs
  before insert or update of snapshot, visibility on public.live_sessions
  for each row execute function public.guard_live_snapshot_songs();
revoke all on function public.guard_live_snapshot_songs() from public, anon, authenticated;

drop policy "Create own live sessions" on public.live_sessions;
create policy "Create own live sessions" on public.live_sessions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );
drop policy "Update own live sessions" on public.live_sessions;
create policy "Update own live sessions" on public.live_sessions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );
