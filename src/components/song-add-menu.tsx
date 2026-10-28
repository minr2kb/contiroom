'use client';

import { Button } from '@astryxdesign/core/Button';
import { Dialog } from '@astryxdesign/core/Dialog';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { FileImage, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Song } from '@/lib/model';
import { MAX_SONG_PHOTO_BYTES, PHOTO_DRAFT_STORAGE_KEY, SONG_PHOTO_TYPES } from '@/lib/song-photo-draft';

export function SongAddMenu({ label = '추가' }: { label?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const [phase, setPhase] = useState<'uploading' | 'analyzing' | 'opening' | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [error, setError] = useState('');

  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    if (
      !SONG_PHOTO_TYPES.includes(file.type as (typeof SONG_PHOTO_TYPES)[number]) ||
      file.size > MAX_SONG_PHOTO_BYTES ||
      file.size === 0
    ) {
      setError('10MB 이하의 JPG, PNG 또는 WebP 사진을 선택하세요.');
      return;
    }
    setPhase('uploading');
    setUploadPercent(null);
    let navigated = false;
    try {
      const form = new FormData();
      form.set('photo', file);
      const draft = await new Promise<Song>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        request.current = xhr;
        xhr.open('POST', '/api/songs/photo-draft');
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadPercent(Math.round((event.loaded / event.total) * 100));
        };
        xhr.upload.onload = () => setPhase('analyzing');
        xhr.onload = () => {
          let data: { error?: string } & Partial<Song> = {};
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            // An invalid response is handled below.
          }
          if (xhr.status >= 200 && xhr.status < 300 && data.id && Array.isArray(data.sections)) {
            resolve(data as Song);
          } else {
            reject(new Error(data.error || '사진 분석에 실패했습니다. 다시 시도하세요.'));
          }
        };
        xhr.onerror = () => reject(new Error('연결에 실패했습니다. 다시 시도하세요.'));
        xhr.onabort = () => reject(new Error('cancelled'));
        xhr.send(form);
      });
      request.current = null;
      setPhase('opening');
      sessionStorage.setItem(PHOTO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      router.push('/songs/new/edit');
      navigated = true;
    } catch (cause) {
      if (!(cause instanceof Error && cause.message === 'cancelled')) {
        setError(cause instanceof Error ? cause.message : '사진 분석에 실패했습니다. 다시 시도하세요.');
      }
    } finally {
      request.current = null;
      if (!navigated) setPhase(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="relative">
      <DropdownMenu
        button={{
          label: phase ? '사진 분석 중…' : label,
          variant: 'primary',
          icon: <Plus aria-hidden="true" />,
          isDisabled: phase !== null,
          isLoading: phase !== null,
        }}
        alignment="end"
        items={[
          {
            label: '직접 추가',
            icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
            href: '/songs/new/edit?mode=manual',
            onClick: () => sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY),
          },
          {
            label: '사진으로 추가',
            icon: <FileImage aria-hidden="true" className="h-4 w-4" />,
            onClick: () => input.current?.click(),
          },
        ]}
      />
      <input
        ref={input}
        type="file"
        accept={SONG_PHOTO_TYPES.join(',')}
        aria-label="곡 사진 선택"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {error && (
        <Text
          role="alert"
          className="absolute right-0 z-10 mt-2 w-72 rounded-lg bg-neutral-900 p-3 text-sm text-red-300 shadow-lg"
        >
          {error}
        </Text>
      )}
      <Dialog
        isOpen={phase !== null}
        onOpenChange={() => {}}
        purpose="required"
        width={380}
        aria-labelledby="song-photo-progress-title"
      >
        {phase && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-5 flex justify-center">
              <Spinner label="사진 분석 진행 중" />
            </div>
            <h2 id="song-photo-progress-title" className="text-xl font-semibold text-white">
              {phase === 'uploading'
                ? '사진 업로드 중…'
                : phase === 'analyzing'
                  ? 'AI가 악보를 읽는 중…'
                  : '편집 화면 여는 중…'}
            </h2>
            <p className="mt-2 text-sm text-neutral-300" role="status">
              {phase === 'uploading'
                ? uploadPercent === null
                  ? '사진을 서버로 보내고 있습니다.'
                  : `전송 ${uploadPercent}%`
                : phase === 'analyzing'
                  ? '음표, 가사, 코드의 위치를 확인하고 있습니다.'
                  : '초안을 불러오고 있습니다.'}
            </p>
            {phase !== 'opening' && (
              <div className="mt-6">
                <Button label="취소" variant="secondary" onClick={() => request.current?.abort()} />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
