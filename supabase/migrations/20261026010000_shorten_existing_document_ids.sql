-- Run only after a database backup. The transaction aborts if a live snapshot
-- exists, because its line references need a separate shape-aware migration.
begin;

lock table public.songs, public.contis, public.live_sessions,
  public.saved_songs, public.song_id_registry in access exclusive mode;

do $$
begin
  if exists (select 1 from public.live_sessions where snapshot is not null)
     or exists (select 1 from public.songs s where not exists
       (select 1 from public.song_id_registry r where r.id = s.id and r.deleted_at is null))
     or exists (select 1 from public.songs s where s.origin_song_id is not null
       and not exists (select 1 from public.song_id_registry r where r.id = s.origin_song_id))
     or exists (select 1 from public.saved_songs s where not exists
       (select 1 from public.song_id_registry r where r.id = s.song_id))
     or exists (select 1 from public.contis c,
       jsonb_array_elements(c.items) item(value)
       where not exists (select 1 from public.song_id_registry r
         where r.id = item.value->>'songId')) then
    raise exception 'Cannot shorten IDs: snapshot or unresolved song reference exists';
  end if;
end;
$$;

create temporary table id_candidates (id text primary key) on commit drop;
insert into id_candidates (id)
select distinct id from (
  select id from public.songs
  union all select origin_song_id from public.songs where origin_song_id is not null
  union all select id from public.contis
  union all select id from public.live_sessions
  union all select conti_id from public.live_sessions
  union all select song_id from public.saved_songs
  union all select id from public.song_id_registry
  union all select section.value->>'id' from public.songs s,
    jsonb_array_elements(s.sections) section(value)
  union all select line.value->>'id' from public.songs s,
    jsonb_array_elements(s.sections) section(value),
    jsonb_array_elements(section.value->'lines') line(value)
  union all select chord.value->>'id' from public.songs s,
    jsonb_array_elements(s.sections) section(value),
    jsonb_array_elements(section.value->'lines') line(value),
    jsonb_array_elements(line.value->'chords') chord(value)
  union all select item.value->>'id' from public.contis c,
    jsonb_array_elements(c.items) item(value)
  union all select item.value->>'songId' from public.contis c,
    jsonb_array_elements(c.items) item(value)
  union all select step.value->>'id' from public.contis c,
    jsonb_array_elements(c.items) item(value),
    jsonb_array_elements(item.value->'form') step(value)
  union all select step.value->>'sectionId' from public.contis c,
    jsonb_array_elements(c.items) item(value),
    jsonb_array_elements(item.value->'form') step(value)
) existing where id is not null;

create temporary table id_map (old_id text primary key, new_id text not null unique) on commit drop;
create temporary table id_map_source on commit drop as select id from id_candidates;
do $$
declare old_value text; candidate text;
begin
  for old_value in
    select id from id_map_source order by id
  loop
    loop
      candidate := translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');
      exit when not exists (select 1 from id_candidates where id = candidate);
    end loop;
    insert into id_map values (old_value, candidate);
    insert into id_candidates values (candidate);
  end loop;
end;
$$;

-- Keep the exact mapping for audit and recovery without exposing it via the API.
create schema if not exists migration_audit;
revoke all on schema migration_audit from public, anon, authenticated;
create table migration_audit.id_map_20261026 as
  select old_id, new_id from id_map;
alter table migration_audit.id_map_20261026 add primary key (old_id);
create unique index on migration_audit.id_map_20261026 (new_id);
revoke all on migration_audit.id_map_20261026 from public, anon, authenticated;

-- Keep exact source rows for recovery after the transaction commits.
create table migration_audit.songs_before_20261026 as table public.songs;
create table migration_audit.contis_before_20261026 as table public.contis;
create table migration_audit.live_sessions_before_20261026 as table public.live_sessions;
create table migration_audit.saved_songs_before_20261026 as table public.saved_songs;
create table migration_audit.song_id_registry_before_20261026 as table public.song_id_registry;
revoke all on all tables in schema migration_audit from public, anon, authenticated;

create function pg_temp.map_id(value text) returns text language sql stable as $$
  select coalesce((select new_id from id_map where old_id = value), value)
$$;

create function pg_temp.map_sections(sections jsonb) returns jsonb language plpgsql as $$
declare section jsonb; line jsonb; chord jsonb;
  next_sections jsonb := '[]'; next_lines jsonb; next_chords jsonb;
begin
  for section in select value from jsonb_array_elements(sections) loop
    next_lines := '[]';
    for line in select value from jsonb_array_elements(section->'lines') loop
      next_chords := '[]';
      for chord in select value from jsonb_array_elements(line->'chords') loop
        next_chords := next_chords || jsonb_build_array(
          jsonb_set(chord, '{id}', to_jsonb(pg_temp.map_id(chord->>'id'))));
      end loop;
      next_lines := next_lines || jsonb_build_array(
        jsonb_set(jsonb_set(line, '{id}', to_jsonb(pg_temp.map_id(line->>'id'))),
          '{chords}', next_chords));
    end loop;
    next_sections := next_sections || jsonb_build_array(
      jsonb_set(jsonb_set(section, '{id}', to_jsonb(pg_temp.map_id(section->>'id'))),
        '{lines}', next_lines));
  end loop;
  return next_sections;
end;
$$;

create function pg_temp.map_items(items jsonb) returns jsonb language plpgsql as $$
declare item jsonb; step jsonb; next_items jsonb := '[]'; next_form jsonb;
begin
  for item in select value from jsonb_array_elements(items) loop
    next_form := '[]';
    for step in select value from jsonb_array_elements(item->'form') loop
      next_form := next_form || jsonb_build_array(
        jsonb_set(jsonb_set(step, '{id}', to_jsonb(pg_temp.map_id(step->>'id'))),
          '{sectionId}', to_jsonb(pg_temp.map_id(step->>'sectionId'))));
    end loop;
    next_items := next_items || jsonb_build_array(
      jsonb_set(jsonb_set(jsonb_set(item, '{id}', to_jsonb(pg_temp.map_id(item->>'id'))),
        '{songId}', to_jsonb(pg_temp.map_id(item->>'songId'))), '{form}', next_form));
  end loop;
  return next_items;
end;
$$;

-- Identity guards and publication invalidation would reject this one-time
-- identity migration or clear live state. The exclusive locks block app writes.
alter table public.songs disable trigger user;
alter table public.contis disable trigger user;
alter table public.live_sessions disable trigger user;
alter table public.live_sessions drop constraint live_sessions_owned_conti;

update public.songs s set id = pg_temp.map_id(s.id),
  origin_song_id = pg_temp.map_id(s.origin_song_id),
  sections = pg_temp.map_sections(s.sections);

update public.contis c set id = pg_temp.map_id(c.id), items = pg_temp.map_items(c.items);

update public.live_sessions l set id = pg_temp.map_id(l.id),
  conti_id = pg_temp.map_id(l.conti_id);

update public.saved_songs s set song_id = pg_temp.map_id(s.song_id)
where s.song_id in (select old_id from id_map);

-- Preserve old IDs as tombstones so a stale open tab cannot recreate a song
-- under an expired URL after the migration.
insert into public.song_id_registry (id, deleted_at)
select m.new_id, r.deleted_at
  from public.song_id_registry r join id_map m on m.old_id = r.id;
update public.song_id_registry r set deleted_at = now()
where r.id in (select old_id from id_map) and r.deleted_at is null;

alter table public.live_sessions add constraint live_sessions_owned_conti
  foreign key (conti_id, owner_id) references public.contis (id, owner_id)
  on delete cascade;
alter table public.songs enable trigger user;
alter table public.contis enable trigger user;
alter table public.live_sessions enable trigger user;

-- An editor tab opened before migration must not recreate an expired conti URL.
create function public.reject_migrated_conti_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from migration_audit.id_map_20261026 m where m.old_id = new.id) then
    raise exception 'Migrated conti ID cannot be reused';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_migrated_conti_id() from public, anon, authenticated;
create trigger reject_migrated_conti_id before insert on public.contis
  for each row execute function public.reject_migrated_conti_id();

do $$
begin
  if exists (
    with functional_ids as (
      select id from public.songs
      union all select origin_song_id from public.songs where origin_song_id is not null
      union all select id from public.contis
      union all select id from public.live_sessions
      union all select conti_id from public.live_sessions
      union all select song_id from public.saved_songs
      union all select id from public.song_id_registry where deleted_at is null
      union all select section.value->>'id' from public.songs s,
        jsonb_array_elements(s.sections) section(value)
      union all select line.value->>'id' from public.songs s,
        jsonb_array_elements(s.sections) section(value),
        jsonb_array_elements(section.value->'lines') line(value)
      union all select chord.value->>'id' from public.songs s,
        jsonb_array_elements(s.sections) section(value),
        jsonb_array_elements(section.value->'lines') line(value),
        jsonb_array_elements(line.value->'chords') chord(value)
      union all select item.value->>'id' from public.contis c,
        jsonb_array_elements(c.items) item(value)
      union all select item.value->>'songId' from public.contis c,
        jsonb_array_elements(c.items) item(value)
      union all select step.value->>'id' from public.contis c,
        jsonb_array_elements(c.items) item(value),
        jsonb_array_elements(item.value->'form') step(value)
      union all select step.value->>'sectionId' from public.contis c,
        jsonb_array_elements(c.items) item(value),
        jsonb_array_elements(item.value->'form') step(value)
    )
    select 1 from functional_ids f join id_map m on m.old_id = f.id
  ) then
    raise exception 'Short ID migration left an old functional ID';
  end if;
  if exists (select 1 from public.songs s where not exists
      (select 1 from public.song_id_registry r where r.id = s.id and r.deleted_at is null))
     or exists (select 1 from public.songs s where s.origin_song_id is not null
      and not exists (select 1 from public.song_id_registry r where r.id = s.origin_song_id))
     or exists (select 1 from public.saved_songs s where not exists
      (select 1 from public.song_id_registry r where r.id = s.song_id))
     or exists (select 1 from public.contis c,
        jsonb_array_elements(c.items) item(value)
        where not exists (select 1 from public.song_id_registry r
          where r.id = item.value->>'songId'))
     or exists (select 1 from public.contis c
        cross join lateral jsonb_array_elements(c.items) item(value)
        cross join lateral jsonb_array_elements(item.value->'form') step(value)
        join public.songs s on s.id = item.value->>'songId'
        where not s.sections @> jsonb_build_array(
          jsonb_build_object('id', step.value->>'sectionId'))) then
    raise exception 'Short ID migration left an unresolved song reference';
  end if;
end;
$$;

commit;
