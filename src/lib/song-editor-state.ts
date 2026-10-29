import { arrayMove } from '@dnd-kit/helpers';
import { sortBy, uniq } from 'es-toolkit/array';
import { nanoid } from 'nanoid';
import { rewriteLyricLine } from './line-edit.ts';
import type { Chord, LyricLine, Section, Song } from './model.ts';

export type SongEditorState = { song?: Song; recentChords: string[] };

export type SongEditorAction =
  | { type: 'load'; song: Song }
  | { type: 'song/set-title' | 'song/set-key'; value: string }
  | { type: 'song/set-artist'; value: string }
  | { type: 'song/set-visibility'; value: 'private' | 'public' }
  | { type: 'song/set-bpm'; value: number | undefined }
  | { type: 'song/set-translation-enabled'; value: boolean }
  | { type: 'section/add'; section: Section }
  | { type: 'section/duplicate'; sectionId: string; newSectionId: string }
  | { type: 'section/reorder'; sectionId: string; toIndex: number }
  | { type: 'section/rename'; sectionId: string; name: string }
  | { type: 'section/remove'; sectionId: string }
  | { type: 'line/add'; sectionId: string; line: LyricLine }
  | { type: 'line/duplicate'; sectionId: string; lineId: string; newLineId?: string }
  | { type: 'line/remove'; sectionId: string; lineId: string }
  | { type: 'line/reorder'; sectionId: string; lineId: string; toIndex: number }
  | {
      type: 'line/move';
      sourceSectionId: string;
      targetSectionId: string;
      lineId: string;
      toIndex: number;
      emptyLine: LyricLine;
    }
  | { type: 'line/rewrite'; sectionId: string; lineId: string; text: string }
  | { type: 'line/rewrite-translation'; sectionId: string; lineId: string; text: string }
  | { type: 'line/splice'; sectionId: string; index: number; deleteCount: number; lines: LyricLine[] }
  | {
      type: 'chord/place';
      sectionId: string;
      lineId: string;
      offset: number;
      chord: Chord;
      source?: { sectionId: string; lineId: string };
    }
  | { type: 'chord/remove'; sectionId: string; lineId: string; chordId: string }
  | { type: 'recent/use'; value: string };

export const initialSongEditorState: SongEditorState = { recentChords: [] };

const useRecentChord = (recentChords: string[], value: string): string[] => uniq([value, ...recentChords]).slice(0, 10);

export const recentChordsFromSong = (song: Song): string[] =>
  uniq(
    song.sections
      .flatMap((section) => section.lines.flatMap((line) => line.chords.map((chord) => chord.value)))
      .reverse(),
  ).slice(0, 10);

const updateSection = (song: Song, sectionId: string, update: (section: Section) => Section): Song => ({
  ...song,
  sections: song.sections.map((section) => (section.id === sectionId ? update(section) : section)),
});

const updateLine = (song: Song, sectionId: string, lineId: string, update: (line: LyricLine) => LyricLine): Song =>
  updateSection(song, sectionId, (section) => ({
    ...section,
    lines: section.lines.map((line) => (line.id === lineId ? update(line) : line)),
  }));

const moveToIndex = <T>(items: T[], from: number, to: number): T[] => {
  return arrayMove(items, from, to);
};

const placeChord = (song: Song, action: Extract<SongEditorAction, { type: 'chord/place' }>): Song => {
  const target = song.sections
    .find((section) => section.id === action.sectionId)
    ?.lines.find((line) => line.id === action.lineId);
  if (!target) return song;

  let chord = action.chord;
  if (action.source) {
    const source = song.sections
      .find((section) => section.id === action.source?.sectionId)
      ?.lines.find((line) => line.id === action.source?.lineId);
    const original = source?.chords.find((entry) => entry.id === chord.id);
    if (!original) return song;
    chord = original;
  }

  const withoutSource = action.source
    ? updateLine(song, action.source.sectionId, action.source.lineId, (line) => ({
        ...line,
        chords: line.chords.filter((entry) => entry.id !== chord.id),
      }))
    : song;
  return updateLine(withoutSource, action.sectionId, action.lineId, (line) => ({
    ...line,
    chords: sortBy(
      [...line.chords.filter((entry) => entry.id !== chord.id), { ...chord, offset: action.offset }],
      ['offset'],
    ),
  }));
};

export const songEditorReducer = (state: SongEditorState, action: SongEditorAction): SongEditorState => {
  if (action.type === 'load') {
    const song = structuredClone(action.song);
    return { song, recentChords: recentChordsFromSong(song) };
  }
  if (action.type === 'recent/use') return { ...state, recentChords: useRecentChord(state.recentChords, action.value) };
  if (!state.song) return state;

  const song = state.song;
  switch (action.type) {
    case 'song/set-title':
      return { ...state, song: { ...song, title: action.value } };
    case 'song/set-artist':
      return { ...state, song: { ...song, artist: action.value || undefined } };
    case 'song/set-visibility':
      return { ...state, song: { ...song, visibility: action.value } };
    case 'song/set-key':
      return { ...state, song: { ...song, baseKey: action.value } };
    case 'song/set-bpm':
      return { ...state, song: { ...song, bpm: action.value } };
    case 'song/set-translation-enabled':
      return { ...state, song: { ...song, translationEnabled: action.value } };
    case 'section/add':
      return { ...state, song: { ...song, sections: [...song.sections, action.section] } };
    case 'section/duplicate': {
      const sourceIndex = song.sections.findIndex((section) => section.id === action.sectionId);
      if (sourceIndex < 0) return state;
      const source = song.sections[sourceIndex];
      const copy: Section = {
        ...source,
        id: action.newSectionId,
        name: `${source.name} 복사`,
        lines: source.lines.map((line) => ({
          ...line,
          id: nanoid(12),
          chords: line.chords.map((chord) => ({ ...chord, id: nanoid(12) })),
        })),
      };
      const sections = [...song.sections];
      sections.splice(sourceIndex + 1, 0, copy);
      return { ...state, song: { ...song, sections } };
    }
    case 'section/reorder': {
      const from = song.sections.findIndex((section) => section.id === action.sectionId);
      const to = Math.max(0, Math.min(action.toIndex, song.sections.length - 1));
      if (from < 0 || from === to) return state;
      return { ...state, song: { ...song, sections: moveToIndex(song.sections, from, to) } };
    }
    case 'section/rename':
      return {
        ...state,
        song: updateSection(song, action.sectionId, (section) => ({ ...section, name: action.name })),
      };
    case 'section/remove':
      return {
        ...state,
        song: { ...song, sections: song.sections.filter((section) => section.id !== action.sectionId) },
      };
    case 'line/add':
      return {
        ...state,
        song: updateSection(song, action.sectionId, (section) => ({
          ...section,
          lines: [...section.lines, action.line],
        })),
      };
    case 'line/duplicate': {
      const section = song.sections.find((entry) => entry.id === action.sectionId);
      const sourceIndex = section?.lines.findIndex((line) => line.id === action.lineId) ?? -1;
      if (!section || sourceIndex < 0) return state;
      const source = section.lines[sourceIndex];
      const copy: LyricLine = {
        ...source,
        id: action.newLineId ?? nanoid(12),
        chords: source.chords.map((chord) => ({ ...chord, id: nanoid(12) })),
      };
      const lines = [...section.lines];
      lines.splice(sourceIndex + 1, 0, copy);
      return { ...state, song: updateSection(song, action.sectionId, (entry) => ({ ...entry, lines })) };
    }
    case 'line/remove':
      return {
        ...state,
        song: updateSection(song, action.sectionId, (section) => ({
          ...section,
          lines:
            section.lines.length === 1 && section.lines[0].id === action.lineId
              ? [{ id: action.lineId, text: '', chords: [] }]
              : section.lines.filter((line) => line.id !== action.lineId),
        })),
      };
    case 'line/reorder':
      return {
        ...state,
        song: updateSection(song, action.sectionId, (section) => {
          const from = section.lines.findIndex((line) => line.id === action.lineId);
          const to = Math.max(0, Math.min(action.toIndex, section.lines.length - 1));
          return from < 0 || from === to ? section : { ...section, lines: moveToIndex(section.lines, from, to) };
        }),
      };
    case 'line/move': {
      const source = song.sections.find((section) => section.id === action.sourceSectionId);
      const target = song.sections.find((section) => section.id === action.targetSectionId);
      const from = source?.lines.findIndex((line) => line.id === action.lineId) ?? -1;
      if (!source || !target || from < 0) return state;
      if (source.id === target.id) {
        const to = Math.max(0, Math.min(action.toIndex, source.lines.length - 1));
        return from === to
          ? state
          : {
              ...state,
              song: updateSection(song, source.id, (section) => ({
                ...section,
                lines: moveToIndex(section.lines, from, to),
              })),
            };
      }
      const movedLine = source.lines[from];
      return {
        ...state,
        song: {
          ...song,
          sections: song.sections.map((section) => {
            if (section.id === source.id) {
              const lines = source.lines.filter((line) => line.id !== action.lineId);
              return { ...section, lines: lines.length ? lines : [action.emptyLine] };
            }
            if (section.id === target.id) {
              const lines = [...section.lines];
              lines.splice(Math.max(0, Math.min(action.toIndex, lines.length)), 0, movedLine);
              return { ...section, lines };
            }
            return section;
          }),
        },
      };
    }
    case 'line/rewrite':
      return {
        ...state,
        song: updateLine(song, action.sectionId, action.lineId, (line) => rewriteLyricLine(line, action.text)),
      };
    case 'line/rewrite-translation':
      return {
        ...state,
        song: updateLine(song, action.sectionId, action.lineId, (line) => ({
          ...line,
          translation: action.text || undefined,
        })),
      };
    case 'line/splice':
      return {
        ...state,
        song: updateSection(song, action.sectionId, (section) => ({
          ...section,
          lines: [
            ...section.lines.slice(0, action.index),
            ...action.lines,
            ...section.lines.slice(action.index + action.deleteCount),
          ],
        })),
      };
    case 'chord/place':
      return { ...state, song: placeChord(song, action) };
    case 'chord/remove':
      return {
        ...state,
        song: updateLine(song, action.sectionId, action.lineId, (line) => ({
          ...line,
          chords: line.chords.filter((chord) => chord.id !== action.chordId),
        })),
      };
  }
};
