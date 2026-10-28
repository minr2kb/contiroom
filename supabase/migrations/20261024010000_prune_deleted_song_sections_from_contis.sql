-- Removing a song section also removes its stale form steps from every conti
-- that references it. The song item and its remaining form steps stay intact.
create function public.prune_deleted_song_sections_from_contis()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  conti record;
  next_items jsonb;
begin
  if tg_op <> 'UPDATE'
     or jsonb_typeof(new.sections) is distinct from 'array'
     or new.sections is not distinct from old.sections then
    return new;
  end if;

  if not exists (
    select 1
      from jsonb_array_elements(old.sections) as section(value)
     where not new.sections @> jsonb_build_array(jsonb_build_object('id', section.value->>'id'))
  ) then
    return new;
  end if;

  for conti in
    select c.id, c.items
      from public.contis c
     where c.items @> jsonb_build_array(jsonb_build_object('songId', new.id))
     for update
  loop
    select coalesce(jsonb_agg(
      case when entry.item->>'songId' = new.id then
        jsonb_set(
          entry.item,
          '{form}',
          coalesce((
            select jsonb_agg(step.value order by step.ordinality)
              from jsonb_array_elements(entry.item->'form') with ordinality as step(value, ordinality)
             where new.sections @> jsonb_build_array(jsonb_build_object('id', step.value->>'sectionId'))
          ), '[]'::jsonb),
          false
        )
      else entry.item end
      order by entry.ordinality
    ), '[]'::jsonb)
      into next_items
      from jsonb_array_elements(conti.items) with ordinality as entry(item, ordinality);

    update public.contis c
       set items = next_items
     where c.id = conti.id and conti.items is distinct from next_items;
  end loop;

  return new;
end;
$$;
revoke all on function public.prune_deleted_song_sections_from_contis() from public, anon, authenticated;

-- Run before validate_song, which otherwise rejects removal of an in-use section.
create trigger a_prune_deleted_song_sections
  before update of sections on public.songs
  for each row execute function public.prune_deleted_song_sections_from_contis();
