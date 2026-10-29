alter table public.songs
  add column translation_enabled boolean not null default false;

create function public.validate_song_translations()
returns trigger language plpgsql set search_path = '' as $$
declare
  section jsonb;
  line jsonb;
begin
  for section in select value from jsonb_array_elements(new.sections) loop
    for line in select value from jsonb_array_elements(section->'lines') loop
      if line ? 'translation' and jsonb_typeof(line->'translation') is distinct from 'string' then
        raise exception 'Song translation must be a string';
      end if;
    end loop;
  end loop;
  return new;
end;
$$;
create trigger validate_song_translations
  before insert or update of sections on public.songs
  for each row execute function public.validate_song_translations();

create function public.invalidate_live_on_translation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.live_sessions l
     set active = false, snapshot = null
   where (l.active or l.snapshot is not null)
     and exists (
       select 1 from public.contis c
        where c.id = l.conti_id
          and c.items @> jsonb_build_array(jsonb_build_object('songId', old.id))
     );
  return new;
end;
$$;
revoke all on function public.invalidate_live_on_translation_change() from public, anon, authenticated;
create trigger invalidate_live_on_translation_change
  after update of translation_enabled on public.songs
  for each row when (old.translation_enabled is distinct from new.translation_enabled)
  execute function public.invalidate_live_on_translation_change();

create or replace function public.guard_song_clone_provenance()
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
     or new.translation_enabled is distinct from source_song.translation_enabled
     or new.artist is distinct from source_song.artist then
    raise exception 'Clone content must initially match its source';
  end if;
  return new;
end;
$$;
