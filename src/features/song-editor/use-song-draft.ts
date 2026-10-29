import { nanoid } from 'nanoid';
import { useMemo, useReducer } from 'react';
import type { ReorderOperation } from '@/lib/drag-end-operation';
import type { Chord, LyricLine, Section, Song } from '@/lib/model';
import { initialSongEditorState, songEditorReducer } from '@/lib/song-editor-state';

const newLine = (): LyricLine => ({ id: nanoid(12), text: '', chords: [] });

export const createSong = (): Song => ({
  id: nanoid(12),
  title: '',
  visibility: 'private',
  baseKey: 'C',
  sections: [{ id: nanoid(12), name: 'Verse 1', lines: [newLine()] }],
});

export const useSongDraft = () => {
  const [state, dispatch] = useReducer(songEditorReducer, initialSongEditorState);

  const actions = useMemo(() => {
    const song = {
      load: (value: Song) => dispatch({ type: 'load', song: value }),
      setTitle: (value: string) => dispatch({ type: 'song/set-title', value }),
      setArtist: (value: string) => dispatch({ type: 'song/set-artist', value }),
      setVisibility: (value: 'private' | 'public') => dispatch({ type: 'song/set-visibility', value }),
      setKey: (value: string) => dispatch({ type: 'song/set-key', value }),
      setBpm: (value: number | undefined) => dispatch({ type: 'song/set-bpm', value }),
      setTranslationEnabled: (value: boolean) => dispatch({ type: 'song/set-translation-enabled', value }),
    };
    const sections = {
      add: () => {
        const section: Section = { id: nanoid(12), name: '새 섹션', lines: [newLine()] };
        dispatch({ type: 'section/add', section });
        return section.id;
      },
      duplicate: (sectionId: string) => {
        const newSectionId = nanoid(12);
        dispatch({ type: 'section/duplicate', sectionId, newSectionId });
        return newSectionId;
      },
      rename: (sectionId: string, name: string) => dispatch({ type: 'section/rename', sectionId, name }),
      remove: (sectionId: string) => dispatch({ type: 'section/remove', sectionId }),
      reorder: (operation: ReorderOperation) =>
        dispatch({ type: 'section/reorder', sectionId: operation.sourceId, toIndex: operation.toIndex }),
    };
    const lines = {
      add: (sectionId: string) => {
        const line = newLine();
        dispatch({ type: 'line/add', sectionId, line });
        return line.id;
      },
      duplicate: (sectionId: string, lineId: string) => {
        const newLineId = nanoid(12);
        dispatch({ type: 'line/duplicate', sectionId, lineId, newLineId });
        return newLineId;
      },
      remove: (sectionId: string, lineId: string) => dispatch({ type: 'line/remove', sectionId, lineId }),
      reorder: (operation: ReorderOperation) => {
        if (!operation.scopeId) return;
        if (operation.targetScopeId && operation.scopeId !== operation.targetScopeId) {
          dispatch({
            type: 'line/move',
            sourceSectionId: operation.scopeId,
            targetSectionId: operation.targetScopeId,
            lineId: operation.sourceId,
            toIndex: operation.toIndex,
            emptyLine: newLine(),
          });
          return;
        }
        dispatch({
          type: 'line/reorder',
          sectionId: operation.scopeId,
          lineId: operation.sourceId,
          toIndex: operation.toIndex,
        });
      },
      rewrite: (sectionId: string, lineId: string, text: string) =>
        dispatch({ type: 'line/rewrite', sectionId, lineId, text }),
      rewriteTranslation: (sectionId: string, lineId: string, text: string) =>
        dispatch({ type: 'line/rewrite-translation', sectionId, lineId, text }),
      splice: (sectionId: string, index: number, deleteCount: number, inserted: LyricLine[]) =>
        dispatch({ type: 'line/splice', sectionId, index, deleteCount, lines: inserted }),
    };
    const chords = {
      place: (
        sectionId: string,
        lineId: string,
        offset: number,
        chord: Chord,
        source?: { sectionId: string; lineId: string },
      ) => dispatch({ type: 'chord/place', sectionId, lineId, offset, chord, source }),
      remove: (sectionId: string, lineId: string, chordId: string) =>
        dispatch({ type: 'chord/remove', sectionId, lineId, chordId }),
      useRecent: (value: string) => dispatch({ type: 'recent/use', value }),
    };

    return { song, sections, lines, chords };
  }, [dispatch]);

  return { draft: state.song, recentChords: state.recentChords, ...actions };
};
