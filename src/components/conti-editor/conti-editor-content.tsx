import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateInput, type DateInputProps } from '@astryxdesign/core/DateInput';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { List } from '@astryxdesign/core/List';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { useQueries } from '@tanstack/react-query';
import { Plus, RotateCw } from 'lucide-react';
import { AddSongDialog } from '@/components/conti-editor/add-song-dialog';
import { ContiSongSettings } from '@/components/conti-editor/conti-song-settings';
import { SortableContiSong } from '@/components/conti-sortable-items';
import type { useContiDraft } from '@/features/conti-editor/use-conti-draft';
import { queries } from '@/lib/data-api';
import type { Conti, Song } from '@/lib/model';
import { useSavedSongs } from '@/lib/saved-songs';
import { useCurrentUserId } from '@/lib/use-current-user-id';
import { isYouTubePlaylistUrl } from '@/lib/youtube-playlist';

type DraftActions = ReturnType<typeof useContiDraft>['actions'];

type Controls = {
  actions: DraftActions;
  expandedItemId?: string;
  onExpandedItemChange: (itemId?: string) => void;
  isSongDialogOpen: boolean;
  onSongDialogOpenChange: (isOpen: boolean) => void;
  onAddSong: (songId: string, sectionIds: string[]) => void;
};

type Props = {
  draft?: Conti;
  isDraftInitializing: boolean;
  controls: Controls;
};

type SongListProps = {
  draft: Conti;
  songs: Song[];
  controls: Pick<Controls, 'expandedItemId' | 'onExpandedItemChange'> & {
    actions: Pick<DraftActions, 'removeSong' | 'changeSong'>;
  };
};

const ContiSongList = ({ draft, songs, controls }: SongListProps) => {
  if (draft.items.length === 0) return <EmptyState title="콘티에 곡이 없습니다" />;

  return (
    <List density="spacious" hasDividers aria-label="콘티 곡 순서">
      {draft.items.map((entry, index) => {
        const entrySong = songs.find((candidate) => candidate.id === entry.songId);
        const bpm = entry.bpm ?? entrySong?.bpm;
        const isExpanded = controls.expandedItemId === entry.id;
        return (
          <SortableContiSong
            key={entry.id}
            item={entry}
            index={index}
            title={entrySong?.title || '사용할 수 없는 곡'}
            songKey={entry.key || entrySong?.baseKey || '키 미설정'}
            bpm={bpm}
            summary={`${entry.form.length}개 섹션`}
            isExpanded={isExpanded}
            onOpenChange={(isOpen) => controls.onExpandedItemChange(isOpen ? entry.id : undefined)}
            onRemove={() => {
              controls.actions.removeSong(entry.id);
              if (isExpanded) controls.onExpandedItemChange(undefined);
            }}
            expandedContent={
              isExpanded ? (
                <ContiSongSettings
                  item={entry}
                  song={entrySong}
                  onChange={(change) => controls.actions.changeSong(entry.id, change)}
                />
              ) : undefined
            }
          />
        );
      })}
    </List>
  );
};

export const ContiEditorContent = ({ draft, isDraftInitializing, controls }: Props) => {
  const userId = useCurrentUserId();
  const savedQuery = useSavedSongs(Boolean(userId));
  const [songsQuery, contisQuery] = useQueries({
    queries: [queries.listSongs(), queries.listContis()],
  });
  const savedIds = new Set(savedQuery.data?.map((saved) => saved.songId) ?? []);
  const itemSongIds = new Set(draft?.items.map((item) => item.songId) ?? []);
  const songs = (songsQuery.data ?? []).filter(
    (song) =>
      song.ownerId === userId || (song.visibility === 'public' && (savedIds.has(song.id) || itemSongIds.has(song.id))),
  );
  const selectableSongs = songs.filter((song) => song.ownerId === userId || savedIds.has(song.id));
  const isError = songsQuery.isError || contisQuery.isError || savedQuery.isError;

  if (isDraftInitializing) {
    return (
      <VStack paddingBlock={10} align="center">
        <Spinner label="콘티를 불러오는 중…" />
      </VStack>
    );
  }

  if (songsQuery.isPending || contisQuery.isPending || (userId && savedQuery.isPending)) {
    return (
      <VStack paddingBlock={10} align="center">
        <Spinner label="곡과 콘티를 불러오는 중…" />
      </VStack>
    );
  }

  if (!draft) {
    return <EmptyState title="콘티를 찾을 수 없습니다" actions={<Button label="콘티 목록" href="/contis" />} />;
  }

  return (
    <>
      {isError && (
        <>
          <Banner
            status="error"
            title="콘티 편집에 필요한 정보를 불러오지 못했습니다"
            endContent={
              <Button
                label="다시 시도"
                icon={<RotateCw aria-hidden="true" />}
                onClick={() => {
                  void songsQuery.refetch();
                  void contisQuery.refetch();
                  if (userId) void savedQuery.refetch();
                }}
              />
            }
          />
          <Text type="supporting">현재 편집 중인 내용은 유지됩니다.</Text>
        </>
      )}
      <VStack as="section" paddingBlock={4} gap={5} aria-label="콘티 편집">
        <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} gap={5} align="end">
          <TextInput label="콘티 제목" value={draft.title} onChange={(value) => controls.actions.setTitle(value)} />
          <DateInput
            label="날짜"
            isOptional
            hasClear
            width="100%"
            value={draft.scheduledDate as DateInputProps['value']}
            onChange={(value) => controls.actions.setDate(value)}
          />
          <TextInput
            label="유튜브 플레이리스트 주소"
            isOptional
            description="YouTube 플레이리스트 링크를 붙여넣으세요."
            status={
              draft.youtubePlaylistUrl && !isYouTubePlaylistUrl(draft.youtubePlaylistUrl)
                ? { type: 'error', message: '유효한 YouTube 플레이리스트 주소를 입력하세요.' }
                : undefined
            }
            value={draft.youtubePlaylistUrl ?? ''}
            onChange={(value) => controls.actions.setYoutubePlaylistUrl(value.trim() || undefined)}
          />
        </Grid>

        <ContiSongList
          draft={draft}
          songs={songs}
          controls={{
            actions: {
              removeSong: controls.actions.removeSong,
              changeSong: controls.actions.changeSong,
            },
            expandedItemId: controls.expandedItemId,
            onExpandedItemChange: controls.onExpandedItemChange,
          }}
        />
        <Button
          label="곡 추가"
          variant="secondary"
          icon={<Plus aria-hidden="true" />}
          onClick={() => controls.onSongDialogOpenChange(true)}
        />
      </VStack>
      <AddSongDialog
        isOpen={controls.isSongDialogOpen}
        songs={selectableSongs}
        onAdd={(song) =>
          controls.onAddSong(
            song.id,
            song.sections.map((section) => section.id),
          )
        }
        onClose={() => controls.onSongDialogOpenChange(false)}
      />
    </>
  );
};
