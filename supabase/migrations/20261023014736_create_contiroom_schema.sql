-- Contiroom stores the editor's ordered song/conti documents as JSONB while
-- keeping identity, ownership, and live-session relations in SQL columns.
create table public.app_admins (
  slot smallint primary key default 1 check (slot = 1),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.songs (
  id text primary key check (btrim(id) <> ''),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  base_key text not null check (btrim(base_key) <> ''),
  bpm numeric check (bpm > 0),
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.contis (
  id text primary key check (btrim(id) <> ''),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  scheduled_date date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.live_sessions (
  id text primary key check (btrim(id) <> ''),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  conti_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  allow_anyone_control boolean not null default false,
  active boolean not null default true,
  snapshot jsonb check (
    snapshot is null or (
      jsonb_typeof(snapshot) = 'object'
      and jsonb_typeof(snapshot->'title') = 'string'
      and jsonb_typeof(snapshot->'lines') = 'array'
      and jsonb_typeof(snapshot->'cursor') = 'number'
      and snapshot->>'cursor' ~ '^[0-9]{1,9}$'
      and jsonb_typeof(snapshot->'options') = 'object'
    )
  ),
  constraint live_sessions_owned_conti foreign key (conti_id, owner_id)
    references public.contis (id, owner_id) on delete cascade
);

create unique index one_active_live_session_per_conti
  on public.live_sessions (conti_id) where active;
create index songs_owner_id_idx on public.songs (owner_id);
create index contis_owner_id_idx on public.contis (owner_id);
create index live_sessions_owner_id_idx on public.live_sessions (owner_id);

create function public.validate_song_document()
returns trigger language plpgsql set search_path = '' as $$
declare
  section jsonb;
  line jsonb;
  chord jsonb;
  section_ids text[] := '{}';
  line_ids text[] := '{}';
  chord_ids text[] := '{}';
  existing_conti record;
  item jsonb;
  step jsonb;
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.owner_id <> old.owner_id) then
    raise exception 'Song identity and owner cannot be changed';
  end if;
  if jsonb_typeof(new.sections) is distinct from 'array' then
    raise exception 'Song sections must be an array';
  end if;
  for section in select value from jsonb_array_elements(new.sections) loop
    if jsonb_typeof(section) is distinct from 'object'
       or jsonb_typeof(section->'id') is distinct from 'string'
       or btrim(section->>'id') = ''
       or jsonb_typeof(section->'name') is distinct from 'string'
       or btrim(section->>'name') = ''
       or jsonb_typeof(section->'lines') is distinct from 'array' then
      raise exception 'Invalid song section';
    end if;
    if section->>'id' = any(section_ids) then
      raise exception 'Duplicate song section ID: %', section->>'id';
    end if;
    section_ids := array_append(section_ids, section->>'id');
    for line in select value from jsonb_array_elements(section->'lines') loop
      if jsonb_typeof(line) is distinct from 'object'
         or jsonb_typeof(line->'id') is distinct from 'string'
         or btrim(line->>'id') = ''
         or jsonb_typeof(line->'text') is distinct from 'string'
         or jsonb_typeof(line->'chords') is distinct from 'array' then
        raise exception 'Invalid song line';
      end if;
      if line->>'id' = any(line_ids) then
        raise exception 'Duplicate song line ID: %', line->>'id';
      end if;
      line_ids := array_append(line_ids, line->>'id');
      for chord in select value from jsonb_array_elements(line->'chords') loop
        if jsonb_typeof(chord) is distinct from 'object'
           or jsonb_typeof(chord->'id') is distinct from 'string'
           or btrim(chord->>'id') = ''
           or jsonb_typeof(chord->'value') is distinct from 'string'
           or btrim(chord->>'value') = ''
           or jsonb_typeof(chord->'offset') is distinct from 'number'
           or (chord->>'offset') !~ '^[0-9]{1,9}$' then
          raise exception 'Invalid song chord';
        end if;
        if chord->>'id' = any(chord_ids) then
          raise exception 'Duplicate song chord ID: %', chord->>'id';
        end if;
        chord_ids := array_append(chord_ids, chord->>'id');
      end loop;
    end loop;
  end loop;

  -- Updating a song cannot strand a form step in an existing conti.
  if tg_op = 'UPDATE' then
    for existing_conti in
      select c.items from public.contis c where c.owner_id = new.owner_id for share
    loop
      for item in select value from jsonb_array_elements(existing_conti.items) loop
        if item->>'songId' = new.id then
          for step in select value from jsonb_array_elements(item->'form') loop
            if not (step->>'sectionId' = any(section_ids)) then
              raise exception 'Song section % is used by a conti', step->>'sectionId';
            end if;
          end loop;
        end if;
      end loop;
    end loop;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.validate_conti_document()
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
      where s.id = item->>'songId' and s.owner_id = new.owner_id
      for share;
    if not found then
      raise exception 'Conti song % does not belong to owner', item->>'songId';
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

create function public.remove_deleted_song_from_contis()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.contis c
     set items = coalesce((
       select jsonb_agg(entry.item order by entry.ordinality)
       from jsonb_array_elements(c.items) with ordinality as entry(item, ordinality)
       where entry.item->>'songId' <> old.id
     ), '[]'::jsonb)
   where c.owner_id = old.owner_id
     and c.items @> jsonb_build_array(jsonb_build_object('songId', old.id));
  return old;
end;
$$;

create function public.touch_live_session()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.owner_id <> old.owner_id or new.conti_id <> old.conti_id then
    raise exception 'Live session identity, owner, and conti cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_song before insert or update on public.songs
  for each row execute function public.validate_song_document();
create trigger validate_conti before insert or update on public.contis
  for each row execute function public.validate_conti_document();
create trigger cleanup_deleted_song before delete on public.songs
  for each row execute function public.remove_deleted_song_from_contis();
create trigger touch_live_session before update on public.live_sessions
  for each row execute function public.touch_live_session();

alter table public.app_admins enable row level security;
alter table public.songs enable row level security;
alter table public.contis enable row level security;
alter table public.live_sessions enable row level security;

revoke all on public.app_admins, public.songs, public.contis, public.live_sessions from public, anon, authenticated;
grant select on public.app_admins to authenticated;
grant select, insert, update, delete on public.songs, public.contis, public.live_sessions to authenticated;

create policy "Admin can read own role" on public.app_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Admin owns songs" on public.songs
  for all to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ));

create policy "Admin owns contis" on public.contis
  for all to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ));

create policy "Admin owns live sessions" on public.live_sessions
  for all to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  ));

-- Realtime Postgres Changes can deliver the persisted snapshot to other
-- authenticated tabs. RLS still limits subscriptions to the admin's rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'live_sessions'
     ) then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
end;
$$;
