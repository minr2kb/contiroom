import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/require-user';

export async function DELETE(_request: Request, { params }: { params: Promise<{ songId: string }> }) {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const { songId } = await params;
  const { data, error } = await supabase
    .from('saved_songs')
    .delete()
    .eq('user_id', userId)
    .eq('song_id', songId)
    .select('song_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  if (!data) return NextResponse.json({ error: 'Saved song not found' }, { status: 404 });
  return NextResponse.json({ songId: data.song_id });
}
