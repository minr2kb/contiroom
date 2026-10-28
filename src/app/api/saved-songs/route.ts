import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/require-user';

const saveRequest = z.object({ songId: z.string().min(1) });
const noStore = { 'Cache-Control': 'private, no-store' };

const toSavedSong = (row: { song_id: string; saved_at: string }) => ({
  songId: row.song_id,
  savedAt: row.saved_at,
});

export async function GET() {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabase
    .from('saved_songs')
    .select('song_id,saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toSavedSong), { headers: noStore });
}

export async function POST(request: Request) {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const parsed = saveRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'Complete onboarding first' }, { status: 403 });

  const { data: source, error: sourceError } = await supabase
    .from('songs')
    .select('id,owner_id,visibility')
    .eq('id', parsed.data.songId)
    .eq('visibility', 'public')
    .maybeSingle();
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: 'Public song not found' }, { status: 404 });
  if (source.owner_id === userId) return NextResponse.json({ error: 'Cannot save your own song' }, { status: 400 });

  const { data, error } = await supabase
    .from('saved_songs')
    .insert({ user_id: userId, song_id: source.id })
    .select('song_id,saved_at')
    .single();
  if (error?.code === '23505') {
    const existing = await supabase
      .from('saved_songs')
      .select('song_id,saved_at')
      .eq('user_id', userId)
      .eq('song_id', source.id)
      .single();
    if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
    return NextResponse.json(toSavedSong(existing.data), { headers: noStore });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  return NextResponse.json(toSavedSong(data), { status: 201, headers: noStore });
}
