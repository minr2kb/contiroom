-- A private conti can retain an unavailable song for editing, but publishing
-- it must recheck every song. Only an already-public conti may retain an
-- unchanged unavailable reference after its source is withdrawn.
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
          if old.visibility = 'public' and old.items @> jsonb_build_array(item) then
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

-- Publishing can be reversed even after a public live session has ended.
-- Make every linked public session private and erase its snapshot when the
-- conti is withdrawn.
drop trigger check_private_conti_references on public.contis;
create function public.privatize_conti_live_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.live_sessions l
     set visibility = 'private', active = false, snapshot = null
   where l.conti_id = new.id and l.visibility = 'public';
  return new;
end;
$$;
revoke all on function public.privatize_conti_live_sessions() from public, anon, authenticated;
create trigger privatize_conti_live_sessions
  after update of visibility on public.contis
  for each row when (old.visibility = 'public' and new.visibility = 'private')
  execute function public.privatize_conti_live_sessions();
