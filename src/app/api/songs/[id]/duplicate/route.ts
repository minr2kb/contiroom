import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { songColumns, toSong } from '@/lib/data-records';
import { requireUser } from '@/lib/supabase/require-user';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'Complete onboarding first' }, { status: 403 });

  const { id } = await params;
  const { data: source, error: lookupError } = await supabase
    .from('songs')
    .select('id,title,base_key,bpm,sections,translation_enabled,artist,visibility')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!source || source.visibility !== 'public') {
    return NextResponse.json({ error: 'Public song not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('songs')
    .insert({
      id: nanoid(12),
      owner_id: userId,
      creator_user_id: userId,
      origin_song_id: source.id,
      title: source.title,
      base_key: source.base_key,
      bpm: source.bpm,
      sections: source.sections,
      translation_enabled: source.translation_enabled,
      artist: source.artist,
      visibility: 'private',
    })
    .select(songColumns)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  return NextResponse.json(toSong(data, profile.handle, true), {
    status: 201,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
