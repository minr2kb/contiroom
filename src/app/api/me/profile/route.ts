import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/require-user';

const noStore = { 'Cache-Control': 'private, no-store' };
const handlePattern = /^[a-z0-9_]{1,30}$/;

export const GET = async () => {
  const { supabase, userId, response } = await requireUser();
  if (!userId) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('profiles').select('id, handle, created_at').eq('id', userId).maybeSingle();
  if (error) return NextResponse.json({ error: '프로필을 불러오지 못했습니다.' }, { status: 500, headers: noStore });
  if (!data) return NextResponse.json({ profile: null }, { headers: noStore });
  return NextResponse.json({ profile: { id: data.id, handle: data.handle, createdAt: data.created_at } }, { headers: noStore });
};

export const POST = async (request: Request) => {
  const { supabase, userId, response } = await requireUser();
  if (!userId) return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '핸들을 입력해 주세요.' }, { status: 400, headers: noStore });
  }
  const submitted = body && typeof body === 'object' && 'handle' in body ? (body as { handle: unknown }).handle : null;
  const handle = typeof submitted === 'string' ? submitted.trim().replace(/^@/, '') : '';
  if (!handlePattern.test(handle)) {
    return NextResponse.json({ error: '핸들은 영문 소문자, 숫자, 밑줄(_)만 사용해 1~30자로 입력해 주세요.' }, { status: 400, headers: noStore });
  }

  const { data, error } = await supabase.from('profiles').insert({ id: userId, handle }).select('id, handle, created_at').single();
  if (error?.code === '23505') {
    const { data: existing } = await supabase.from('profiles').select('handle').eq('id', userId).maybeSingle();
    return NextResponse.json(
      { error: existing ? '이미 핸들을 등록했습니다.' : '이미 사용 중인 핸들입니다.' },
      { status: 409, headers: noStore },
    );
  }
  if (error || !data) {
    return NextResponse.json({ error: '핸들을 저장하지 못했습니다.' }, { status: 500, headers: noStore });
  }
  return NextResponse.json(
    { profile: { id: data.id, handle: data.handle, createdAt: data.created_at } },
    { status: 201, headers: noStore },
  );
};
