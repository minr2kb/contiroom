import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Pagination } from '@astryxdesign/core/Pagination';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { SongListControls, type SongListFilters } from '@/components/song-list-controls';
import type { Song } from '@/lib/model';
import { selectSongs } from '@/lib/song-list';

type Props = {
  isOpen: boolean;
  songs: Song[];
  onAdd: (song: Song) => void;
  onClose: () => void;
};

export function AddSongDialog({ isOpen, songs, onAdd, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SongListFilters>({
    title: '',
    baseKey: '',
    minBpm: undefined,
    maxBpm: undefined,
    sort: 'title',
  });
  const filteredSongs = selectSongs(songs, filters);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredSongs.length / 10)));
  const pageSongs = filteredSongs.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} purpose="form" width={560}>
      {isOpen && (
        <Layout
          header={
            <>
              <DialogHeader title="곡 추가" onOpenChange={(open) => !open && onClose()} />
              <LayoutHeader>
                <SongListControls
                  filters={filters}
                  title={filters.title}
                  onTitleChange={(title) => {
                    setFilters((current) => ({ ...current, title }));
                    setPage(1);
                  }}
                  onFilterChange={(name, value) => {
                    setFilters((current) => ({ ...current, [name]: value }));
                    setPage(1);
                  }}
                />
              </LayoutHeader>
            </>
          }
          content={
            <LayoutContent>
              {filteredSongs.length > 0 ? (
                <List density="compact" hasDividers aria-label="추가할 곡">
                  {pageSongs.map((entry) => (
                    <ListItem
                      key={entry.id}
                      label={entry.title}
                      description={entry.bpm ? `${entry.bpm} BPM` : undefined}
                      endContent={
                        <HStack as="span" align="center" gap={2}>
                          <Text as="span" type="supporting">
                            {entry.baseKey}
                          </Text>
                          <Plus aria-hidden="true" className="h-4 w-4 text-neutral-400" />
                        </HStack>
                      }
                      onClick={() => onAdd(entry)}
                    />
                  ))}
                </List>
              ) : (
                <EmptyState title={songs.length > 0 ? '검색 조건에 맞는 곡이 없습니다' : '추가할 곡이 없습니다'} />
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <VStack gap={3}>
                {filteredSongs.length > 10 && (
                  <div className="flex justify-center">
                    <Pagination
                      page={currentPage}
                      onChange={setPage}
                      totalItems={filteredSongs.length}
                      pageSize={10}
                      label="추가할 곡 페이지"
                    />
                  </div>
                )}
                <HStack justify="end">
                  <Button label="닫기" variant="secondary" onClick={onClose} />
                </HStack>
              </VStack>
            </LayoutFooter>
          }
        />
      )}
    </Dialog>
  );
}
