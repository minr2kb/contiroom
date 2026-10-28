'use client';

import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Popover } from '@astryxdesign/core/Popover';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { Search, SlidersHorizontal } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CHORD_ROOTS } from '@/lib/music';
import { readSongListQuery, type SongListFilters } from '@/lib/song-list-query';

export type { SongListFilters } from '@/lib/song-list-query';

export function useSongListQuery() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, page, tab } = readSongListQuery(new URLSearchParams(searchParams.toString()));
  const [title, setTitle] = useState(filters.title);

  useEffect(() => setTitle(filters.title), [filters.title]);
  useEffect(() => {
    const restore = () => setTitle(readSongListQuery(new URLSearchParams(window.location.search)).filters.title);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const update = (values: Record<string, string | undefined>, push = false) => {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(values)) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
    const href = `${pathname}${url.search}${url.hash}`;
    if (push) window.history.pushState(null, '', href);
    else window.history.replaceState(null, '', href);
  };

  const setFilter = <K extends keyof SongListFilters>(name: K, value: SongListFilters[K]) => {
    const param = { title: 'q', baseKey: 'key', minBpm: 'minBpm', maxBpm: 'maxBpm', sort: 'sort' }[name];
    const normalized = name === 'sort' && value === 'title' ? undefined : value;
    update({
      ...(name !== 'title' && title !== filters.title ? { q: title || undefined } : {}),
      [param]: normalized === undefined || normalized === '' ? undefined : String(normalized),
      page: undefined,
    });
  };

  useEffect(() => {
    if (title === filters.title) return;
    const location = `${window.location.pathname}${window.location.search}`;
    const timer = window.setTimeout(() => {
      if (`${window.location.pathname}${window.location.search}` === location) setFilter('title', title);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [title, filters.title, searchParams, setFilter]);

  return {
    filters,
    title,
    setTitle,
    page,
    tab,
    songHref: (id: string) => {
      const source = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`;
      return `/songs/${encodeURIComponent(id)}?from=${encodeURIComponent(source)}`;
    },
    setFilter,
    setPage: (nextPage: number, replace = false) =>
      update({ page: nextPage > 1 ? String(nextPage) : undefined }, !replace),
    setTab: (nextTab: 'mine' | 'saved') => update({ tab: nextTab === 'saved' ? 'saved' : undefined, page: undefined }),
  };
}

type Props = {
  filters: SongListFilters;
  title: string;
  onTitleChange: (value: string) => void;
  onFilterChange: <K extends keyof SongListFilters>(name: K, value: SongListFilters[K]) => void;
  recentLabel?: string;
};

export function SongListControls({ filters, title, onTitleChange, onFilterChange, recentLabel = '최신순' }: Props) {
  const activeFilters =
    Number(Boolean(filters.baseKey)) + Number(filters.minBpm !== undefined) + Number(filters.maxBpm !== undefined);

  return (
    <HStack wrap="wrap" align="end" gap={2} className="w-full px-3">
      <div className="min-w-40 flex-1">
        <TextInput
          label="곡 제목 검색"
          isLabelHidden
          startIcon={<Search aria-hidden="true" className="h-4 w-4" />}
          placeholder="곡 제목 검색"
          value={title}
          onChange={onTitleChange}
          hasClear
          width="100%"
        />
      </div>
      <Popover
        label="곡 필터"
        width={280}
        content={
          <VStack gap={3}>
            <Selector
              label="키"
              options={[{ value: '', label: '전체 키' }, ...CHORD_ROOTS]}
              value={filters.baseKey}
              onChange={(value) => onFilterChange('baseKey', value)}
            />
            <HStack gap={2}>
              <NumberInput
                label="최소 BPM"
                value={filters.minBpm}
                onChange={(value) => onFilterChange('minBpm', value ?? undefined)}
                min={1}
                max={300}
                isIntegerOnly
                hasClear
              />
              <NumberInput
                label="최대 BPM"
                value={filters.maxBpm}
                onChange={(value) => onFilterChange('maxBpm', value ?? undefined)}
                min={1}
                max={300}
                isIntegerOnly
                hasClear
              />
            </HStack>
          </VStack>
        }
      >
        <Button
          label="곡 필터"
          variant="secondary"
          icon={<SlidersHorizontal aria-hidden="true" />}
          isIconOnly
          tooltip={activeFilters > 0 ? `곡 필터 ${activeFilters}개 적용` : '곡 필터'}
        />
      </Popover>
      <Selector
        label="정렬"
        isLabelHidden
        options={[
          { value: 'title', label: '가나다순' },
          { value: 'key', label: '키순' },
          { value: 'bpm', label: 'BPM순' },
          { value: 'recent', label: recentLabel },
        ]}
        value={filters.sort}
        onChange={(value) => onFilterChange('sort', value as SongListFilters['sort'])}
      />
    </HStack>
  );
}
