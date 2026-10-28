import { clamp } from 'es-toolkit/math';
import type { DisplayOptions } from '@/components/live-options-dialog';
import type { Conti, LyricLine, Song } from './model.ts';
import { itemSemitones, transposeChord } from './music.ts';

export const isDisplayOptions = (value: unknown): value is DisplayOptions =>
  typeof value === 'object' &&
  value !== null &&
  'count' in value &&
  (value.count === 1 || value.count === 2 || value.count === 3) &&
  'showChords' in value &&
  typeof value.showChords === 'boolean' &&
  'showForm' in value &&
  typeof value.showForm === 'boolean' &&
  'showNextLyrics' in value &&
  typeof value.showNextLyrics === 'boolean';

export type LiveLine = {
  itemId: string;
  songTitle: string;
  sectionName: string;
  formId: string;
  key: string;
  bpm?: number;
  line: LyricLine;
};

export const flattenConti = (conti: Conti, songs: Song[]): LiveLine[] => {
  return conti.items.flatMap((item) => {
    const song = songs.find((candidate) => candidate.id === item.songId);
    if (!song) return [];
    return item.form.flatMap((step) => {
      const section = song.sections.find((candidate) => candidate.id === step.sectionId);
      if (!section) return [];
      const shift = itemSemitones(song, item);
      return section.lines.map((line) => ({
        itemId: item.id,
        songTitle: song.title,
        sectionName: section.name,
        formId: step.id,
        key: item.key ?? song.baseKey,
        bpm: item.bpm ?? song.bpm,
        line: {
          ...line,
          chords: line.chords.map((chord) => ({
            ...chord,
            value: transposeChord(chord.value, shift, (item.key ?? song.baseKey).includes('b')),
          })),
        },
      }));
    });
  });
};

export const moveCursor = (lines: LiveLine[], cursor: number, direction: -1 | 1, byForm = false): number => {
  if (!lines.length) return 0;
  const current = clamp(cursor, 0, lines.length - 1);
  if (!byForm) return clamp(current + direction, 0, lines.length - 1);
  if (direction === 1) {
    const next = lines.findIndex((line, index) => index > current && line.formId !== lines[current].formId);
    return next < 0 ? current : next;
  }
  const first = lines.findIndex((line) => line.formId === lines[current].formId);
  if (first < current) return first;
  if (first === 0) return 0;
  return lines.findIndex((line) => line.formId === lines[first - 1].formId);
};

export const moveSongCursor = (lines: LiveLine[], cursor: number, direction: -1 | 1): number => {
  if (!lines.length) return 0;
  const current = clamp(cursor, 0, lines.length - 1);
  const first = lines.findIndex((line) => line.itemId === lines[current].itemId);
  if (direction === 1) {
    const next = lines.findIndex((line, index) => index > current && line.itemId !== lines[current].itemId);
    return next < 0 ? current : next;
  }
  if (first === 0) return 0;
  return lines.findIndex((line) => line.itemId === lines[first - 1].itemId);
};

export const movePageCursor = (lines: LiveLine[], cursor: number, direction: -1 | 1, count: 1 | 2 | 3): number => {
  if (!lines.length) return 0;
  const current = clamp(cursor, 0, lines.length - 1);
  const formId = lines[current].formId;
  let start = current;
  while (start > 0 && lines[start - 1].formId === formId) start -= 1;
  let end = current + 1;
  while (end < lines.length && lines[end].formId === formId) end += 1;

  if (direction === 1) {
    if (current + count < end) return current + count;
    return end < lines.length ? end : current;
  }
  if (current > start) return Math.max(start, current - count);
  if (start === 0) return 0;

  const previousFormId = lines[start - 1].formId;
  let previousStart = start - 1;
  while (previousStart > 0 && lines[previousStart - 1].formId === previousFormId) previousStart -= 1;
  const previousLength = start - previousStart;
  return previousStart + Math.floor((previousLength - 1) / count) * count;
};

export const visibleLines = (lines: LiveLine[], cursor: number, count: 1 | 2 | 3): LiveLine[] => {
  const current = lines[cursor];
  if (!current) return [];
  return lines.slice(cursor, cursor + count).filter((line) => line.formId === current.formId);
};

export type LiveChordWidth = { id: string; value: string; offset: number; width: number };
export type WrappedLiveRow = {
  start: number;
  end: number;
  lanes: number;
  chords: (LiveChordWidth & { x: number; lane: number })[];
};

export const wrapLiveLine = (glyphWidths: number[], chords: LiveChordWidth[], maxWidth: number): WrappedLiveRow[] => {
  if (!glyphWidths.length) return [];
  const available = Math.max(1, maxWidth);
  const byOffset = new Map<number, LiveChordWidth[]>();
  for (const chord of chords) {
    const offset = clamp(chord.offset, 0, glyphWidths.length - 1);
    byOffset.set(offset, [...(byOffset.get(offset) ?? []), chord]);
  }
  const rows: WrappedLiveRow[] = [];
  for (let start = 0; start < glyphWidths.length; ) {
    let end = start;
    let width = 0;
    while (end < glyphWidths.length) {
      const chordWidth = Math.max(0, ...(byOffset.get(end) ?? []).map((chord) => chord.width));
      if (end > start && (width + glyphWidths[end] > available || width + chordWidth > available)) break;
      width += glyphWidths[end];
      end += 1;
    }
    const placed: WrappedLiveRow['chords'] = [];
    const laneEnds: number[] = [];
    let x = 0;
    for (let offset = start; offset < end; offset += 1) {
      for (const chord of byOffset.get(offset) ?? []) {
        let lane = laneEnds.findIndex((laneEnd) => laneEnd <= x);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = x + chord.width + 8;
        placed.push({ ...chord, x, lane });
      }
      x += glyphWidths[offset];
    }
    rows.push({ start, end, lanes: laneEnds.length, chords: placed });
    start = end;
  }
  return rows;
};
