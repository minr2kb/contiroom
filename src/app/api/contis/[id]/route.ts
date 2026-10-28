import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/require-user';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const { id } = await params;
  const { data, error } = await supabase.from('contis').delete().eq('id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  if (!data) return NextResponse.json({ error: `Conti not found: ${id}` }, { status: 404 });
  return NextResponse.json({ id: data.id });
}
