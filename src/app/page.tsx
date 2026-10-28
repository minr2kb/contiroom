'use client';

import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Pagination } from '@astryxdesign/core/Pagination';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, Suspense, useEffect, useState } from 'react';
import { useAuthDialog } from '@/components/auth-dialog';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageContent, Shell } from '@/components/shell';
import { SongListControls, useSongListQuery } from '@/components/song-list-controls';
import { queries } from '@/lib/data-api';
import { useSavedSongActions, useSavedSongs } from '@/lib/saved-songs';
import { selectSongs } from '@/lib/song-list';
import { useCurrentUserId } from '@/lib/use-current-user-id';

const ExploreList = () => {
  const { filters, title, setTitle, page, setFilter, setPage, songHref } = useSongListQuery();
  const router = useRouter();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const openLogin = useAuthDialog();
  const songsQuery = useQuery({ ...queries.listSongs(), throwOnError: true });
  const savedQuery = useSavedSongs(Boolean(userId));
  const actions = useSavedSongActions();
  const [pending, setPending] = useState<string | null>(null);
  const songs = (songsQuery.data ?? []).filter((song) => song.visibility === 'public');
  const filteredSongs = selectSongs(songs, filters);
  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageSongs = filteredSongs.slice((currentPage - 1) * 10, currentPage * 10);
  const savedIds = new Set(savedQuery.data?.map((entry) => entry.songId) ?? []);

  useEffect(() => {
    if (!songsQuery.isPending && page > totalPages) setPage(totalPages, true);
  }, [songsQuery.isPending, page, totalPages, setPage]);

  if (songsQuery.isPending) return <Spinner label="공개 곡을 불러오는 중…" />;
  if (songs.length === 0) return <EmptyState title="아직 공개된 곡이 없습니다" />;

  const save = async (songId: string, isSaved: boolean) => {
    if (!userId) return openLogin();
    setPending(songId);
    try {
      if (isSaved) await actions.remove(songId);
      else await actions.save(songId);
      showToast({ body: isSaved ? '저장을 취소했습니다.' : '곡을 저장했습니다.' });
    } catch {
      showToast({ body: '저장 상태를 변경하지 못했습니다. 다시 시도하세요.', type: 'error' });
    } finally {
      setPending(null);
    }
  };

  const duplicate = async (songId: string) => {
    if (!userId) return openLogin();
    setPending(songId);
    try {
      const copy = await actions.duplicate(songId);
      await queryClient.invalidateQueries({ queryKey: queries.listSongs.queryKey() });
      showToast({ body: '곡을 복제했습니다.' });
      router.push(`/songs/${copy.id}/edit`);
    } catch {
      showToast({ body: '곡을 복제하지 못했습니다. 다시 시도하세요.', type: 'error' });
      setPending(null);
    }
  };

  const songActions = (song: (typeof songs)[number]) => (
    <HStack gap={2} align="center">
      <Button
        label={savedIds.has(song.id) ? '저장 취소' : '저장'}
        variant="ghost"
        size="sm"
        icon={savedIds.has(song.id) ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        isIconOnly
        tooltip={savedIds.has(song.id) ? '저장 취소' : '저장'}
        isDisabled={
          Boolean(pending) ||
          song.ownerId === userId ||
          (Boolean(userId) && (savedQuery.isPending || savedQuery.isError))
        }
        onClick={() => void save(song.id, savedIds.has(song.id))}
      />
      <Button
        label="복제"
        variant="ghost"
        size="sm"
        icon={<Copy aria-hidden="true" />}
        isIconOnly
        tooltip="복제"
        isDisabled={Boolean(pending)}
        onClick={() => void duplicate(song.id)}
      />
    </HStack>
  );

  const openSongFromRow = (event: MouseEvent<Element>, href: string) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('a, button')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(href);
  };

  return (
    <VStack gap={3}>
      <SongListControls filters={filters} title={title} onTitleChange={setTitle} onFilterChange={setFilter} />
      {userId && savedQuery.isError && (
        <Text role="alert" className="text-red-300">
          저장 상태를 불러오지 못했습니다.
        </Text>
      )}
      {filteredSongs.length === 0 ? (
        <EmptyState title="검색 조건에 맞는 곡이 없습니다" />
      ) : (
        <List density="spacious" hasDividers aria-label="공개 곡 목록">
          {pageSongs.map((song) => (
            <ListItem
              key={song.id}
              href={songHref(song.id)}
              onClick={(event) => openSongFromRow(event, songHref(song.id))}
              onAuxClick={(event) => {
                if (event.button === 1) openSongFromRow(event, songHref(song.id));
              }}
              className="max-sm:flex-wrap max-sm:[&>span:last-child]:basis-full"
              label={
                <HStack as="span" gap={2} align="center" className="min-w-0">
                  <Text as="span" type="large" maxLines={1} className="min-w-0">
                    {song.title}
                  </Text>
                  <Text
                    as="span"
                    type="code"
                    color="secondary"
                    className="shrink-0"
                    style={song.baseKey !== '키 미설정' ? { color: '#DF87FF' } : undefined}
                  >
                    {song.baseKey}
                  </Text>
                </HStack>
              }
              description={
                <span className="block leading-relaxed">
                  {[
                    song.bpm ? `${song.bpm} BPM` : null,
                    song.artist,
                    song.creatorHandle ? `@${song.creatorHandle}` : null,
                    song.createdAt
                      ? `제작일 ${new Date(song.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              }
              endContent={songActions(song)}
            />
          ))}
        </List>
      )}
      {filteredSongs.length > 10 && (
        <div className="flex justify-center">
          <Pagination
            page={currentPage}
            onChange={setPage}
            totalItems={filteredSongs.length}
            pageSize={10}
            label="공개 곡 페이지"
          />
        </div>
      )}
    </VStack>
  );
};

const Home = () => (
  <Shell>
    <PageContent>
      <PageHeader title="탐색" description="전체 공개된 곡을 살펴보고 저장하거나 내 곡으로 복제하세요." />
      <QueryBoundary loadingLabel="공개 곡을 불러오는 중…" errorTitle="공개 곡을 불러오지 못했습니다">
        <Suspense fallback={<Spinner label="공개 곡을 불러오는 중…" />}>
          <ExploreList />
        </Suspense>
      </QueryBoundary>
    </PageContent>
  </Shell>
);

export default Home;
