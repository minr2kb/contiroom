import { NextResponse } from 'next/server';
import { songColumns, toSong } from '@/lib/data-records';
import { songSchema } from '@/lib/data-router';
import { requireUser } from '@/lib/supabase/require-user';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('songs').select(songColumns).order('title');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = [...new Set((data ?? []).map((row) => row.creator_user_id))];
  const { data: profiles, error: profilesError } = ids.length
    ? await supabase.from('profiles').select('id,handle').in('id', ids)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  const readableIds = new Set((data ?? []).map((row) => row.id));
  return NextResponse.json((data ?? []).map((row) => toSong(
    row,
    handles.get(row.creator_user_id),
    row.origin_song_id ? readableIds.has(row.origin_song_id) : undefined,
  )), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function PUT(request: Request) {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const parsed = songSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const song = parsed.data;

  const { data: existing, error: lookupError } = await supabase
    .from('songs')
    .select('visibility,owner_id')
    .eq('id', song.id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing && existing.owner_id !== userId)
    return NextResponse.json({ error: 'Only the song owner can edit it.' }, { status: 403 });

  const values = {
    title: song.title,
    base_key: song.baseKey,
    bpm: song.bpm ?? null,
    sections: song.sections,
    artist: song.artist?.trim() || null,
    visibility: song.visibility ?? existing?.visibility ?? 'private',
  };
  const { data, error } = await (existing
    ? supabase.from('songs').update(values).eq('id', song.id)
    : supabase.from('songs').insert({ id: song.id, ...values }))
    .select(songColumns)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  if (!data) return NextResponse.json({ error: 'Song not found or access denied.' }, { status: 403 });
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', data.creator_user_id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const { data: origin } = data.origin_song_id
    ? await supabase.from('songs').select('id').eq('id', data.origin_song_id).maybeSingle()
    : { data: null };
  return NextResponse.json(toSong(data, profile?.handle, data.origin_song_id ? Boolean(origin) : undefined));
}
