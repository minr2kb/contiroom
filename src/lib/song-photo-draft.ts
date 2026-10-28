import { nanoid } from 'nanoid';
import { z } from 'zod';
import { songSchema } from './data-router.ts';
import { graphemeCount } from './graphemes.ts';
import type { Song } from './model.ts';
import { makeChord, MUSIC_KEYS, parseChord } from './music.ts';

export const PHOTO_DRAFT_STORAGE_KEY = 'contiroom:photo-song-draft';
export const MAX_SONG_PHOTO_BYTES = 10 * 1024 * 1024;
export const SONG_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const storedPhotoDraftSchema = songSchema.extend({ title: z.string() });

export const photoSongSchema = z.object({
  title: z.string(),
  artist: z.string(),
  baseKey: z.string(),
  bpm: z.number().nullable(),
  sections: z.array(
    z.object({
      name: z.string(),
      lines: z.array(
        z.object({
          units: z.array(
            z.object({
              lyric: z.string(),
              wordStart: z.boolean(),
              chords: z.array(z.string()),
            }),
          ),
        }),
      ),
    }),
  ),
});

const keyAliases: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

const sectionNumber = (value: string): number | undefined => {
  const digit = /([1-9]\d*)/.exec(value)?.[1];
  if (digit) return Number(digit);
  const roman = /\b(III|II|I)\b/i.exec(value)?.[1].toUpperCase();
  return roman ? { I: 1, II: 2, III: 3 }[roman as 'I' | 'II' | 'III'] : undefined;
};

export function normalizePhotoSectionName(raw: string, index: number, verseCount: number, hasLyrics = true): string {
  const name = raw
    .trim()
    .replace(/^[([]\s*/, '')
    .replace(/\s*[)\]]$/, '');
  const simple = name.toLowerCase().replace(/[\s_-]/g, '');
  if (/^(?:verse|v\d+|\d+절|절)/.test(simple) || /\d+\s*절/.test(name)) {
    return `Verse ${sectionNumber(name) ?? verseCount + 1}`;
  }
  if (/^(?:prechorus|pre-?refrain|프리코러스|프리후렴)/.test(simple)) return 'Prechorus';
  if (/^(?:chorus|refrain|코러스|후렴)/.test(simple)) return 'Chorus';
  if (/^(?:bridge|브릿지|브리지)/.test(simple)) return 'Bridge';
  if (/^(?:tag|태그)/.test(simple)) return 'Tag';
  if (/^(?:intro|전주)/.test(simple)) return 'Intro';
  if (/^(?:interlude|간주)/.test(simple)) return 'Interlude';
  if (/^(?:outro|후주)/.test(simple)) return 'Outro';
  return name || (hasLyrics ? `Verse ${verseCount + 1}` : index === 0 ? 'Intro' : 'Interlude');
}

function unitsToLine(units: z.infer<typeof photoSongSchema>['sections'][number]['lines'][number]['units']) {
  let text = '';
  const chords: Song['sections'][number]['lines'][number]['chords'] = [];
  for (const unit of units) {
    const lyric = unit.lyric.trimStart();
    const fragment = /[가-힣]/u.test(lyric) ? lyric.replace(/[-‐‑‒–—―_]/gu, '') : lyric;
    const space = text && fragment && (unit.wordStart || /^\s/u.test(unit.lyric)) ? ' ' : '';
    const offset = graphemeCount(text + space);
    for (const raw of unit.chords) {
      const value = raw.trim();
      const parsed = parseChord(value);
      if (parsed)
        chords.push({
          id: nanoid(12),
          offset,
          value: parsed.quality === 'maj7' ? makeChord({ ...parsed, quality: 'M7' }) : value,
        });
    }
    text += space + fragment;
  }
  return { id: nanoid(12), text, chords };
}

export function photoSongToDraft(input: z.infer<typeof photoSongSchema>): Song {
  const key = keyAliases[input.baseKey.trim()] ?? input.baseKey.trim();
  let verseCount = 0;
  return {
    id: nanoid(12),
    title: input.title.trim(),
    artist: input.artist.trim(),
    baseKey: MUSIC_KEYS.find((value) => value === key) ?? '키 미설정',
    bpm: input.bpm && input.bpm > 0 && input.bpm <= 300 ? Math.round(input.bpm) : undefined,
    visibility: 'private',
    sections: input.sections
      .slice(0, 40)
      .map((section, index) => {
        const hasLyrics = section.lines.some((line) =>
          line.units.some((unit) => unit.lyric.replace(/[-‐‑‒–—―_]/gu, '').trim().length > 0),
        );
        const name = normalizePhotoSectionName(section.name, index, verseCount, hasLyrics);
        if (name.startsWith('Verse ')) verseCount = Math.max(verseCount, Number(name.slice(6)) || verseCount + 1);
        return {
          id: nanoid(12),
          name,
          lines: section.lines.slice(0, 100).map((line) => unitsToLine(line.units)),
        };
      })
      .filter((section) => section.lines.length > 0)
      .reduce<Song['sections']>((sections, section) => {
        const verse = /^Verse [1-9]\d*$/.test(section.name)
          ? sections.find((entry) => entry.name === section.name)
          : undefined;
        if (verse) verse.lines.push(...section.lines);
        else sections.push(section);
        return sections;
      }, []),
  };
}

export function hasReadablePhotoContent(song: Song): boolean {
  return song.sections.some((section) =>
    section.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0),
  );
}
