import type { Song } from './model.ts';
import { keyPitch } from './music.ts';

export type SongListOptions = {
  title?: string;
  baseKey?: string;
  minBpm?: number | string;
  maxBpm?: number | string;
  sort?: 'title' | 'key' | 'bpm' | 'recent';
  savedAtBySongId?: ReadonlyMap<string, string>;
};

export const selectSongs = (songs: readonly Song[], options: SongListOptions = {}): Song[] => {
  const title = options.title?.trim().toLocaleLowerCase('ko') ?? '';
  const bpmBound = (value: number | string | undefined) => {
    if (value === undefined || value === '') return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
  };
  const min = bpmBound(options.minBpm);
  const max = bpmBound(options.maxBpm);
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, 'ko') || a.id.localeCompare(b.id);
  const timestamp = (song: Song) => {
    const value = options.savedAtBySongId ? options.savedAtBySongId.get(song.id) : song.createdAt;
    return value ? Date.parse(value) || 0 : 0;
  };

  return songs
    .filter(
      (song) =>
        (!title || song.title.toLocaleLowerCase('ko').includes(title)) &&
        (!options.baseKey || song.baseKey === options.baseKey) &&
        (min === undefined || (song.bpm !== undefined && song.bpm >= min)) &&
        (max === undefined || (song.bpm !== undefined && song.bpm <= max)),
    )
    .sort((a, b) => {
      let order = 0;
      if (options.sort === 'key') order = keyPitch(a.baseKey) - keyPitch(b.baseKey);
      if (options.sort === 'bpm') order = (a.bpm ?? Infinity) - (b.bpm ?? Infinity);
      if (options.sort === 'recent') order = timestamp(b) - timestamp(a);
      return order || byTitle(a, b);
    });
};
