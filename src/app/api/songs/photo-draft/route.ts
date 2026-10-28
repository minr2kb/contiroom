import { NextResponse } from 'next/server';
import { extractSongPhoto } from '@/lib/extract-song-photo';
import { hasReadablePhotoContent, MAX_SONG_PHOTO_BYTES, SONG_PHOTO_TYPES } from '@/lib/song-photo-draft';
import { requireUser } from '@/lib/supabase/require-user';

export async function POST(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: '사진 분석 기능이 아직 설정되지 않았습니다.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > MAX_SONG_PHOTO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: '10MB 이하의 사진을 선택하세요.' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const photo = form?.get('photo');
  if (!(photo instanceof File) || !SONG_PHOTO_TYPES.includes(photo.type as (typeof SONG_PHOTO_TYPES)[number])) {
    return NextResponse.json({ error: 'JPG, PNG 또는 WebP 사진을 선택하세요.' }, { status: 400 });
  }
  if (photo.size === 0 || photo.size > MAX_SONG_PHOTO_BYTES) {
    return NextResponse.json({ error: '10MB 이하의 사진을 선택하세요.' }, { status: 413 });
  }

  try {
    const draft = await extractSongPhoto(Buffer.from(await photo.arrayBuffer()), process.env.OPENAI_API_KEY);
    if (!hasReadablePhotoContent(draft)) {
      return NextResponse.json(
        { error: '사진에서 가사나 코드를 읽지 못했습니다. 다른 사진으로 다시 시도하세요.' },
        { status: 422 },
      );
    }
    return NextResponse.json(draft, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Song photo draft failed', error);
    return NextResponse.json({ error: '사진 분석에 실패했습니다. 다시 시도하세요.' }, { status: 502 });
  }
}
