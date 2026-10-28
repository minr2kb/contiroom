import { NextResponse } from 'next/server';
import { contiColumns, toConti } from '@/lib/data-records';
import { contiSchema } from '@/lib/data-router';
import { requireUser } from '@/lib/supabase/require-user';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('contis').select(contiColumns).order('title');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = [...new Set((data ?? []).map((row) => row.creator_user_id))];
  const { data: profiles, error: profilesError } = ids.length
    ? await supabase.from('profiles').select('id,handle').in('id', ids)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  const handles = new Map((profiles ?? []).map((profile) => [profile.id, profile.handle]));
  return NextResponse.json((data ?? []).map((row) => toConti(row, handles.get(row.creator_user_id))), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function PUT(request: Request) {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;

  const parsed = contiSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const conti = parsed.data;

  const { data: existing, error: lookupError } = await supabase
    .from('contis')
    .select('visibility,owner_id')
    .eq('id', conti.id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing && existing.owner_id !== userId)
    return NextResponse.json({ error: 'Only the conti owner can edit it.' }, { status: 403 });

  const values = {
    title: conti.title,
    scheduled_date: conti.scheduledDate ?? null,
    youtube_playlist_url: conti.youtubePlaylistUrl ?? null,
    items: conti.items,
    visibility: conti.visibility ?? existing?.visibility ?? 'private',
  };
  const { data, error } = await (existing
    ? supabase.from('contis').update(values).eq('id', conti.id)
    : supabase.from('contis').insert({ id: conti.id, ...values }))
    .select(contiColumns)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  if (!data) return NextResponse.json({ error: 'Conti not found or access denied.' }, { status: 403 });
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', data.creator_user_id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json(toConti(data, profile?.handle));
}
