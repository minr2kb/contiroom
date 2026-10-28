import { NextResponse } from 'next/server';
import { songColumns, toSong } from '@/lib/data-records';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('read_conti_songs', { conti_id: id }).select(songColumns);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const songs = Array.isArray(data) ? data : [];
  const ids = [...new Set(songs.map((row) => row.creator_user_id))];
  const originIds = [...new Set(songs.flatMap((row) => (row.origin_song_id ? [row.origin_song_id] : [])))];
  const { data: profiles, error: profilesError } = ids.length
    ? await supabase.from('profiles').select('id,handle').in('id', ids)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  const { data: origins, error: originsError } = originIds.length
    ? await supabase.from('songs').select('id').in('id', originIds)
    : { data: [], error: null };
  if (originsError) return NextResponse.json({ error: originsError.message }, { status: 500 });
  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  const readableOrigins = new Set((origins ?? []).map((row) => row.id));
  return NextResponse.json(
    songs.map((row) =>
      toSong(
        row,
        handles.get(row.creator_user_id),
        row.origin_song_id ? readableOrigins.has(row.origin_song_id) : undefined,
      ),
    ),
    {
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
