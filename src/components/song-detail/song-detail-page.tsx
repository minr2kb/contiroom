'use client';

import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { HStack } from '@astryxdesign/core/HStack';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import { Selector } from '@astryxdesign/core/Selector';
import { useToast } from '@astryxdesign/core/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Eye, EyeOff, Globe, LockKeyhole, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DetailList } from '@/components/detail-list';
import { PageHeader } from '@/components/page-header';
import { PageContent, Shell } from '@/components/shell';
import { SongDetailResult } from '@/components/song-detail/song-detail-result';
import { usePads } from '@/features/pads/pad-provider';
import { normalizePadKey } from '@/features/pads/pad-storage';
import { useUtility } from '@/features/pads/utility-provider';
import { useDeleteSong } from '@/features/song-detail/use-delete-song';
import { useSongDetail } from '@/features/song-detail/use-song-detail';
import { queries } from '@/lib/data-api';
import type { ContiItem, Song } from '@/lib/model';
import { MUSIC_KEYS } from '@/lib/music';
import { useSavedSongActions } from '@/lib/saved-songs';
import { useCurrentUserId } from '@/lib/use-current-user-id';

function formatSongDescription({
  song,
  context,
  isLoading,
}: {
  song: Song | undefined;
  context: { valid: boolean; item: ContiItem | undefined };
  isLoading: boolean;
}): string | undefined {
  if (song && context.valid) {
    const bpm = context.item?.bpm ?? song.bpm;
    return `${context.item?.key || song.baseKey}${bpm ? ` · ${bpm} BPM` : ''}`;
  }
  if (song) {
    const bpm = song.bpm ? ` · ${song.bpm} BPM` : '';
    return `원 키 ${song.baseKey}${bpm}`;
  }
  if (isLoading) return '곡 정보를 불러오는 중…';
  return undefined;
}

type Props = { id: string; contiId: string | null; itemId: string | null; returnTo: string | null };

export function SongDetailPage({ id, contiId, itemId, returnTo }: Props) {
  const showToast = useToast();
  const router = useRouter();
  const { song, context, preview, view, refetch } = useSongDetail(id, contiId, itemId);
  const pads = usePads();
  const utility = useUtility();
  const displayKey = context.item?.key || (context.valid ? song?.baseKey : preview.key);
  const padKey = normalizePadKey(displayKey ?? '');
  const previousPadKey = useRef<string | null>(null);

  useEffect(() => {
    utility.setContext({ key: displayKey ?? null });
  }, [displayKey, utility.setContext]);
  useEffect(() => () => utility.setContext(null), [utility.setContext]);
  useEffect(() => {
    if (view.kind !== 'ready') return;
    if (previousPadKey.current === padKey) return;
    previousPadKey.current = padKey;
    if (!pads.playing || pads.mode !== 'auto' || pads.activeKey === padKey) return;
    if (padKey && pads.status[padKey] === 'ready') {
      void pads.play(padKey).catch(() => {
        if (previousPadKey.current === padKey) pads.stop();
      });
    } else pads.stop();
  }, [view.kind, padKey, pads.playing, pads.mode, pads.activeKey, pads.status, pads.play, pads.stop]);
  const deletion = useDeleteSong(song?.id);
  const songActions = useSavedSongActions();
  const queryClient = useQueryClient();
  const visibilityMutation = useMutation(
    queries.saveSong({
      onSuccess: async (song) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queries.listSongs.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContiSongs.queryKey() }),
        ]);
        showToast({ body: `공개 범위를 ${song.visibility === 'public' ? '전체 공개' : '비공개'}로 변경했습니다.` });
      },
      onError: () => showToast({ body: '공개 범위를 변경하지 못했습니다.', type: 'error' }),
    }),
  );
  const userId = useCurrentUserId();
  const isOwner = Boolean(userId && song?.ownerId === userId);
  const duplicateSong = async () => {
    if (!song) return;
    try {
      const copy = await songActions.duplicate(song.id);
      await queryClient.invalidateQueries({ queryKey: queries.listSongs.queryKey() });
      showToast({ body: '곡을 복제했습니다.' });
      router.push(`/songs/${copy.id}/edit`);
    } catch {
      showToast({ body: '곡을 복제하지 못했습니다. 다시 시도하세요.', type: 'error' });
    }
  };
  const description = formatSongDescription({
    song,
    context,
    isLoading: view.kind === 'loading',
  });
  const headerDescription = song ? (
    <>
      {description && <>{description} · </>}
      <Badge
        label={song.visibility === 'public' ? '전체 공개' : '비공개'}
        icon={
          song.visibility === 'public' ? (
            <Globe aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
          )
        }
      />
    </>
  ) : (
    description
  );

  return (
    <Shell>
      <PageContent>
        <PageHeader
          back={
            context.valid
              ? { href: `/contis/${encodeURIComponent(context.contiId ?? '')}`, label: '콘티 목록으로' }
              : { href: returnTo ?? '/songs', label: '곡 목록' }
          }
          title={song?.title || '곡'}
          description={headerDescription}
          actions={
            song &&
            (!context.requested || context.valid) && (
              <>
                {!context.requested && (
                  <HStack align="center" gap={1}>
                    <span className="text-sm text-neutral-400">키</span>
                    <Selector
                      label="키 바꿔 보기"
                      isLabelHidden
                      options={[...MUSIC_KEYS]}
                      value={preview.key || song.baseKey}
                      onChange={preview.setKey}
                      variant="ghost"
                      width={75}
                    />
                  </HStack>
                )}

                <MoreMenu
                  label="곡 메뉴"
                  alignment="end"
                  size="lg"
                  variant="secondary"
                  items={[
                    ...(isOwner
                      ? [
                          {
                            label: song.visibility === 'public' ? '비공개로 전환' : '전체 공개로 전환',
                            icon:
                              song.visibility === 'public' ? (
                                <EyeOff aria-hidden="true" className="h-4 w-4" />
                              ) : (
                                <Eye aria-hidden="true" className="h-4 w-4" />
                              ),
                            onClick: () => {
                              if (visibilityMutation.isPending) return;
                              visibilityMutation.mutate({
                                body: { ...song, visibility: song.visibility === 'public' ? 'private' : 'public' },
                              });
                            },
                          },
                        ]
                      : []),
                    {
                      label: '다운로드',
                      icon: <Download aria-hidden="true" className="h-4 w-4" />,
                      href: `/print?songId=${encodeURIComponent(song.id)}${context.valid ? `&contiId=${encodeURIComponent(context.contiId ?? '')}&itemId=${encodeURIComponent(context.item?.id ?? '')}` : `&key=${encodeURIComponent(preview.key || song.baseKey)}`}`,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    },

                    ...(userId && (isOwner || song.visibility === 'public')
                      ? [
                          {
                            label: '복제',
                            icon: <Copy aria-hidden="true" className="h-4 w-4" />,
                            onClick: () => void duplicateSong(),
                          },
                        ]
                      : []),
                    ...(isOwner
                      ? [
                          {
                            label: '수정',
                            href: `/songs/${song.id}/edit`,
                            icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                          },
                          {
                            label: '삭제',
                            icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                            variant: 'destructive' as const,
                            onClick: () => deletion.setIsDeleteOpen(true),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            )
          }
        />

        {song && (
          <DetailList
            items={[
              { label: '제작자', value: song.creatorHandle ? `@${song.creatorHandle}` : '미등록' },
              ...(song.artist ? [{ label: '아티스트', value: song.artist }] : []),
              ...(song.createdAt
                ? [
                    {
                      label: '제작일',
                      value: new Date(song.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
                    },
                  ]
                : []),
              ...(song.originSongId
                ? [
                    {
                      label: '원곡',
                      value:
                        song.originAvailable === false ? (
                          '사용할 수 없음'
                        ) : (
                          <a
                            href={`/songs/${encodeURIComponent(song.originSongId)}`}
                            className="underline underline-offset-2"
                          >
                            원곡 보기
                          </a>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        )}
        <SongDetailResult view={view} onRetry={refetch} />
        <AlertDialog
          isOpen={deletion.isDeleteOpen}
          onOpenChange={deletion.setIsDeleteOpen}
          title="곡을 삭제할까요?"
          description={`‘${song?.title ?? '이 곡'}’을 삭제하면 되돌릴 수 없습니다.`}
          cancelLabel="취소"
          actionLabel="삭제"
          isActionLoading={deletion.isDeleting}
          onAction={deletion.deleteSong}
        />
      </PageContent>
    </Shell>
  );
}
