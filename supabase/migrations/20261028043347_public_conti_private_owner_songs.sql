-- A public conti may include its owner's private songs. An unavailable song
-- from another owner may remain only as an unchanged placeholder.
create or replace function public.check_public_conti_songs()
returns trigger language plpgsql set search_path = '' as $$
declare
  item jsonb;
begin
  if new.visibility = 'public' then
    for item in select value from jsonb_array_elements(new.items) loop
      perform 1 from public.songs s
       where s.id = item->>'songId'
         and (s.owner_id = new.owner_id or s.visibility = 'public');
      if not found then
        if tg_op = 'UPDATE' then
          if old.visibility = 'public' and old.items @> jsonb_build_array(item) then
            continue;
          end if;
        end if;
        raise exception 'Public conti requires an owned or public song';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- The caller supplies a conti ID, never a song ID. The security definer may
-- bypass song RLS, so every condition for releasing a private song is here.
create function public.read_conti_songs(conti_id text)
returns setof public.songs language sql stable security definer set search_path = '' as $$
  select s.*
    from public.contis c
    cross join lateral jsonb_array_elements(c.items) as item(value)
    join public.songs s on s.id = item.value->>'songId'
   where c.id = conti_id
     and (c.visibility = 'public' or c.owner_id = (select auth.uid()))
     and (s.visibility = 'public' or s.owner_id = c.owner_id)
   group by s.id;
$$;
revoke all on function public.read_conti_songs(text) from public;
grant execute on function public.read_conti_songs(text) to anon, authenticated;

-- A public live view may use the same owner-owned private songs as its conti.
create or replace function public.guard_live_snapshot_songs()
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
       for share;
      if not found then
        raise exception 'Live snapshot requires available songs';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
