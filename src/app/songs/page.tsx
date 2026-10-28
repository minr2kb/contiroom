'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Pagination } from '@astryxdesign/core/Pagination';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bookmark, BookmarkX, Compass, Globe, LockKeyhole, LogIn, Music2, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageContent, Shell } from '@/components/shell';
import { SongAddMenu } from '@/components/song-add-menu';
import { SongListControls, useSongListQuery } from '@/components/song-list-controls';
import { queries } from '@/lib/data-api';
import { useSavedSongActions, useSavedSongs } from '@/lib/saved-songs';
import { selectSongs } from '@/lib/song-list';
import { useCurrentUserId } from '@/lib/use-current-user-id';

type ListQuery = ReturnType<typeof useSongListQuery>;

const SongsList = ({ userId, listQuery }: { userId: string | null; listQuery: ListQuery }) => {
  const router = useRouter();
  const songsQuery = useQuery({ ...queries.listSongs(), throwOnError: true });
  const songs = (songsQuery.data ?? []).filter((song) => song.ownerId === userId);
  const filteredSongs = selectSongs(songs, listQuery.filters);
  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / 10));
  const currentPage = Math.min(listQuery.page, totalPages);
  const pageSongs = filteredSongs.slice((currentPage - 1) * 10, currentPage * 10);
  useEffect(() => {
    if (userId && !songsQuery.isPending && listQuery.page > totalPages) listQuery.setPage(totalPages, true);
  }, [userId, songsQuery.isPending, listQuery.page, listQuery.setPage, totalPages]);
  if (songsQuery.isPending)
    return (
      <VStack paddingBlock={10} align="center" className="w-full">
        <Spinner label="곡 목록을 불러오는 중…" />
      </VStack>
    );
  const openSongFromRow = (event: MouseEvent<Element>, href: string) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('a, button')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(href);
  };

  if (songs.length === 0) {
    return (
      <VStack paddingBlock={10} align="center" className="border-y border-neutral-800">
        <EmptyState
          title="아직 등록된 곡이 없습니다."
          headingLevel={2}
          actions={
            userId ? (
              <SongAddMenu label="새 곡" />
            ) : (
              <Button label="로그인" icon={<LogIn aria-hidden="true" />} href="/login" />
            )
          }
        />
      </VStack>
    );
  }

  return (
    <VStack gap={3}>
      <SongListControls
        filters={listQuery.filters}
        title={listQuery.title}
        onTitleChange={listQuery.setTitle}
        onFilterChange={listQuery.setFilter}
      />
      {filteredSongs.length === 0 ? (
        <EmptyState title="검색 조건에 맞는 곡이 없습니다" />
      ) : (
        <List density="spacious" hasDividers>
          {pageSongs.map((song) => (
            <ListItem
              key={song.id}
              href={listQuery.songHref(song.id)}
              onClick={(event) => openSongFromRow(event, listQuery.songHref(song.id))}
              onAuxClick={(event) => {
                if (event.button === 1) openSongFromRow(event, listQuery.songHref(song.id));
              }}
              label={
                <HStack as="span" gap={2} align="center">
                  <Text as="span" type="large" maxLines={1}>
                    {song.title}
                  </Text>
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
                <Text type="supporting">
                  {song.bpm ? `${song.bpm} BPM` : ''}
                  {song.artist ? ` · ${song.artist}` : ''}
                  {song.originSongId ? ' · 복제한 곡' : ''}
                  {song.createdAt
                    ? ` · 제작 ${new Date(song.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                    : ''}
                </Text>
              }
              endContent={<ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" />}
            />
          ))}
        </List>
      )}
      {filteredSongs.length > 10 && (
        <div className="flex justify-center">
          <Pagination
            page={currentPage}
            onChange={listQuery.setPage}
            totalItems={filteredSongs.length}
            pageSize={10}
            label="제작곡 페이지"
          />
        </div>
      )}
    </VStack>
  );
};

const SavedSongsList = ({ userId, listQuery }: { userId: string | null; listQuery: ListQuery }) => {
  const showToast = useToast();
  const songsQuery = useQuery(queries.listSongs());
  const songs = songsQuery.data ?? [];
  const savedQuery = useSavedSongs(Boolean(userId));
  const { remove } = useSavedSongActions();
  const [pendingId, setPendingId] = useState<string>();
  const savedSongs = savedQuery.data ?? [];
  const savedById = new Map(savedSongs.map((saved) => [saved.songId, saved]));
  const availableSongs = songs.filter((song) => savedById.has(song.id) && song.visibility === 'public');
  const savedAtBySongId = new Map(savedSongs.map((saved) => [saved.songId, saved.savedAt]));
  const filteredSongs = selectSongs(availableSongs, { ...listQuery.filters, savedAtBySongId });
  const availableIds = new Set(availableSongs.map((song) => song.id));
  const hasFilter = Boolean(
    listQuery.filters.title || listQuery.filters.baseKey || listQuery.filters.minBpm || listQuery.filters.maxBpm,
  );
  const unavailable = hasFilter
    ? []
    : savedSongs.filter((saved) => !availableIds.has(saved.songId)).map((saved) => ({ saved, song: undefined }));
  const visibleSongs = [
    ...filteredSongs.flatMap((song) => {
      const saved = savedById.get(song.id);
      return saved ? [{ saved, song }] : [];
    }),
    ...unavailable,
  ];
  if (listQuery.filters.sort === 'recent') {
    visibleSongs.sort((a, b) => b.saved.savedAt.localeCompare(a.saved.savedAt));
  }
  const totalPages = Math.max(1, Math.ceil(visibleSongs.length / 10));
  const currentPage = Math.min(listQuery.page, totalPages);
  const pageSongs = visibleSongs.slice((currentPage - 1) * 10, currentPage * 10);
  useEffect(() => {
    if (userId && !savedQuery.isPending && !songsQuery.isPending && listQuery.page > totalPages)
      listQuery.setPage(totalPages, true);
  }, [userId, savedQuery.isPending, songsQuery.isPending, listQuery.page, listQuery.setPage, totalPages]);

  if (!userId)
    return (
      <EmptyState
        title="로그인하면 공개 곡을 저장할 수 있습니다"
        actions={<Button label="로그인" icon={<LogIn aria-hidden="true" />} href="/login" />}
      />
    );
  if (savedQuery.isPending || songsQuery.isPending)
    return (
      <VStack paddingBlock={10} align="center" className="w-full">
        <Spinner label="저장한 곡을 불러오는 중…" />
      </VStack>
    );
  if (savedQuery.isError || songsQuery.isError)
    return (
      <EmptyState
        title="저장한 곡을 불러오지 못했습니다"
        actions={
          <Button
            label="다시 시도"
            icon={<RotateCw aria-hidden="true" />}
            onClick={() => {
              void savedQuery.refetch();
              void songsQuery.refetch();
            }}
          />
        }
      />
    );
  if (!savedQuery.data?.length)
    return (
      <EmptyState
        title="저장한 곡이 없습니다"
        actions={<Button label="공개 곡 탐색" icon={<Compass aria-hidden="true" />} href="/" />}
      />
    );

  const removeSaved = async (songId: string) => {
    setPendingId(songId);
    try {
      await remove(songId);
      showToast({ body: '저장을 취소했습니다.' });
    } catch {
      showToast({ body: '저장을 취소하지 못했습니다. 다시 시도하세요.', type: 'error' });
    } finally {
      setPendingId(undefined);
    }
  };

  return (
    <VStack gap={3}>
      <SongListControls
        filters={listQuery.filters}
        title={listQuery.title}
        onTitleChange={listQuery.setTitle}
        onFilterChange={listQuery.setFilter}
        recentLabel="최근 저장순"
      />
      {visibleSongs.length === 0 && <EmptyState title="검색 조건에 맞는 곡이 없습니다" />}
      {pageSongs.map(({ saved, song }) => {
        return (
          <div
            key={saved.songId}
            className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-3 py-4"
          >
            <div>
              {song ? (
                <Link href={listQuery.songHref(song.id)} className="text-lg text-white hover:text-[#DF87FF]">
                  {song.title}
                </Link>
              ) : (
                <Text type="large">사용할 수 없는 곡</Text>
              )}
              <p className="mt-1 text-sm text-neutral-400">
                {song
                  ? [
                      song.baseKey,
                      song.bpm ? `${song.bpm} BPM` : null,
                      song.artist,
                      song.creatorHandle ? `@${song.creatorHandle}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : '원곡이 비공개로 바뀌었거나 삭제되었습니다.'}
                {' · 저장 '}
                {new Date(saved.savedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
              </p>
            </div>
            <Button
              label="저장 취소"
              variant="secondary"
              size="sm"
              icon={<BookmarkX aria-hidden="true" />}
              isDisabled={Boolean(pendingId)}
              onClick={() => void removeSaved(saved.songId)}
            />
          </div>
        );
      })}
      {visibleSongs.length > 10 && (
        <div className="flex justify-center">
          <Pagination
            page={currentPage}
            onChange={listQuery.setPage}
            totalItems={visibleSongs.length}
            pageSize={10}
            label="저장곡 페이지"
          />
        </div>
      )}
    </VStack>
  );
};

const SongsPage = () => {
  const userId = useCurrentUserId();
  const listQuery = useSongListQuery();
  const activeTab = listQuery.tab;
  const songsQuery = useQuery(queries.listSongs());
  const savedQuery = useSavedSongs(Boolean(userId));
  const createdCount = (songsQuery.data ?? []).filter((song) => song.ownerId === userId).length;
  const savedCount = savedQuery.data?.length ?? 0;
  return (
    <Shell>
      <PageContent>
        <PageHeader
          title="곡 라이브러리"
          description="내가 제작한 곡과 저장한 공개 곡을 관리하세요."
          actions={userId ? <SongAddMenu /> : undefined}
        />
        <TabList
          value={activeTab}
          onChange={(value) => listQuery.setTab(value as 'mine' | 'saved')}
          role="tablist"
          aria-label="곡 라이브러리"
          hasDivider
        >
          <Tab
            id="created-songs-tab"
            value="mine"
            label="제작곡"
            icon={<Music2 aria-hidden="true" />}
            panelId="created-songs-panel"
            endContent={<span className="text-neutral-400">{createdCount}</span>}
          />
          <Tab
            id="saved-songs-tab"
            value="saved"
            label="저장곡"
            icon={<Bookmark aria-hidden="true" />}
            panelId="saved-songs-panel"
            endContent={<span className="text-neutral-400">{savedCount}</span>}
          />
        </TabList>
        <section
          id="created-songs-panel"
          role="tabpanel"
          aria-labelledby="created-songs-tab"
          hidden={activeTab !== 'mine'}
          className="pt-6"
        >
          {activeTab === 'mine' && (
            <QueryBoundary loadingLabel="곡 목록을 불러오는 중…" errorTitle="곡 목록을 불러오지 못했습니다">
              <SongsList userId={userId} listQuery={listQuery} />
            </QueryBoundary>
          )}
        </section>
        <section
          id="saved-songs-panel"
          role="tabpanel"
          aria-labelledby="saved-songs-tab"
          hidden={activeTab !== 'saved'}
          className="pt-6"
        >
          {activeTab === 'saved' && <SavedSongsList userId={userId} listQuery={listQuery} />}
        </section>
      </PageContent>
    </Shell>
  );
};

export default function SongsPageWithSuspense() {
  return (
    <Suspense fallback={<Spinner label="곡 목록을 불러오는 중…" />}>
      <SongsPage />
    </Suspense>
  );
}
