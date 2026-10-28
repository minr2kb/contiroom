import { CHORD_ROOTS } from './music.ts';

export type SongListFilters = {
  title: string;
  baseKey: string;
  minBpm: number | undefined;
  maxBpm: number | undefined;
  sort: 'title' | 'key' | 'bpm' | 'recent';
};

const readBpm = (value: string | null) => {
  const number = Number(value);
  return value && Number.isInteger(number) && number >= 1 && number <= 300 ? number : undefined;
};

export function readSongListQuery(searchParams: URLSearchParams) {
  const sort = searchParams.get('sort');
  const rawPage = searchParams.get('page');
  const filters: SongListFilters = {
    title: searchParams.get('q') ?? '',
    baseKey: CHORD_ROOTS.find((key) => key === searchParams.get('key')) ?? '',
    minBpm: readBpm(searchParams.get('minBpm')),
    maxBpm: readBpm(searchParams.get('maxBpm')),
    sort: sort === 'key' || sort === 'bpm' || sort === 'recent' ? sort : 'title',
  };
  return {
    filters,
    page: rawPage && /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Number(rawPage) : 1,
    tab: searchParams.get('tab') === 'saved' ? ('saved' as const) : ('mine' as const),
  };
}
