import { nanoid } from 'nanoid';
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';
import type { Song } from '@/lib/model';
import { parseChord } from '@/lib/music';
import type { useSongDraft } from './use-song-draft';

type ChordTarget = { element: HTMLButtonElement; sectionId: string; lineId: string; offset: number; chordId?: string };
type DraggedChord = { id?: string; value: string; sourceSectionId?: string; sourceLineId?: string };

type ChordEditorOptions = {
  song?: Song;
  chords: ReturnType<typeof useSongDraft>['chords'];
  setMessage: Dispatch<SetStateAction<string>>;
};

const parseDraggedChord = (raw: string): DraggedChord | null => {
  try {
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') return null;
    const chord = payload as Record<string, unknown>;
    if (typeof chord.value !== 'string' || !parseChord(chord.value)) return null;
    if (chord.id !== undefined && typeof chord.id !== 'string') return null;
    if (chord.sourceSectionId !== undefined && typeof chord.sourceSectionId !== 'string') return null;
    if (chord.sourceLineId !== undefined && typeof chord.sourceLineId !== 'string') return null;
    return chord as DraggedChord;
  } catch {
    return null;
  }
};

export const useChordEditor = ({ song, chords, setMessage }: ChordEditorOptions) => {
  const [target, setTarget] = useState<ChordTarget>();

  const resetChordEditor = useCallback(() => {
    setTarget(undefined);
    setMessage('');
  }, [setMessage]);

  const openChord = (
    element: HTMLButtonElement,
    sectionId: string,
    lineId: string,
    offset: number,
    chordId?: string,
  ) => {
    setMessage('');
    setTarget({ element, sectionId, lineId, offset, chordId });
  };

  const closeChord = () => setTarget(undefined);

  const placeChord = (sectionId: string, lineId: string, offset: number, raw: string) => {
    const payload = parseDraggedChord(raw);
    if (!payload) {
      setMessage('코드는 C, F#m7, G/B처럼 입력하세요.');
      return;
    }
    chords.place(
      sectionId,
      lineId,
      offset,
      { id: payload.id || nanoid(12), value: payload.value, offset },
      payload.sourceSectionId && payload.sourceLineId
        ? { sectionId: payload.sourceSectionId, lineId: payload.sourceLineId }
        : undefined,
    );
    setMessage('');
  };

  const chooseChord = (value: string) => {
    if (!target || !parseChord(value)) return;
    chords.place(target.sectionId, target.lineId, target.offset, {
      id: target.chordId || nanoid(12),
      offset: target.offset,
      value,
    });
    chords.useRecent(value);
    closeChord();
  };

  const removeChord = (sectionId: string, lineId: string, chordId: string) => chords.remove(sectionId, lineId, chordId);

  const existingChord = target?.chordId
    ? song?.sections
        .find((section) => section.id === target.sectionId)
        ?.lines.find((line) => line.id === target.lineId)
        ?.chords.find((chord) => chord.id === target.chordId)?.value
    : undefined;

  return {
    target,
    existingChord,
    openChord,
    closeChord,
    placeChord,
    chooseChord,
    removeChord,
    resetChordEditor,
  };
};
