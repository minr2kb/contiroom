import { nanoid } from 'nanoid';
import { type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { mergeLyricLines, splitLyricLine, splitMultilineLyric } from '@/lib/line-edit';
import type { Song } from '@/lib/model';
import type { useSongDraft } from './use-song-draft';

type Caret = { lineId: string; offset: number };

export const useLyricEditor = (song: Song | undefined, lines: ReturnType<typeof useSongDraft>['lines']) => {
  const lyricInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const nextCaret = useRef<Caret | null>(null);

  useLayoutEffect(() => {
    if (!nextCaret.current) return;
    const { lineId, offset } = nextCaret.current;
    const input = lyricInputs.current.get(lineId);
    if (!input) return;
    input.focus();
    input.setSelectionRange(offset, offset);
    nextCaret.current = null;
  });

  const registerInput = (lineId: string, element: HTMLTextAreaElement | null) => {
    if (element) lyricInputs.current.set(lineId, element);
    else lyricInputs.current.delete(lineId);
  };

  const handleLyricChange = (sectionId: string, lineIndex: number, value: string, caret: number) => {
    const line = song?.sections.find((section) => section.id === sectionId)?.lines[lineIndex];
    if (!line) return;
    if (!/[\r\n]/.test(value)) {
      lines.rewrite(sectionId, line.id, value);
      return;
    }
    const normalized = value.replace(/\r\n?/g, '\n');
    const beforeCaret = normalized.slice(0, caret).split('\n');
    const splitLines = splitMultilineLyric(
      line,
      normalized,
      Array.from({ length: normalized.split('\n').length - 1 }, () => nanoid(12)),
    );
    nextCaret.current = {
      lineId: splitLines[beforeCaret.length - 1].id,
      offset: beforeCaret[beforeCaret.length - 1].length,
    };
    lines.splice(sectionId, lineIndex, 1, splitLines);
  };

  const handleLyricKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, sectionId: string, lineIndex: number) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || !song) return;
    const section = song.sections.find((entry) => entry.id === sectionId);
    const line = section?.lines[lineIndex];
    if (!section || !line) return;
    const { selectionStart: start, selectionEnd: end } = event.currentTarget;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      nextCaret.current = { lineId: lines.duplicate(sectionId, line.id), offset: start };
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const rightId = nanoid(12);
      const [left, right] = splitLyricLine(line, start, end, rightId);
      nextCaret.current = { lineId: rightId, offset: 0 };
      lines.splice(sectionId, lineIndex, 1, [left, right]);
    } else if (event.key === 'Backspace' && start === 0 && end === 0 && lineIndex > 0) {
      event.preventDefault();
      const previous = section.lines[lineIndex - 1];
      const merged = mergeLyricLines(previous, line);
      nextCaret.current = { lineId: previous.id, offset: merged.caret };
      lines.splice(sectionId, lineIndex - 1, 2, [merged.line]);
    } else if (
      event.key === 'Delete' &&
      !line.text &&
      !line.translation &&
      !line.chords.length &&
      section.lines.length > 1
    ) {
      event.preventDefault();
      const next = section.lines[lineIndex + 1];
      const previous = section.lines[lineIndex - 1];
      nextCaret.current = next ? { lineId: next.id, offset: 0 } : { lineId: previous.id, offset: previous.text.length };
      lines.remove(sectionId, line.id);
    } else if (
      event.key === 'Delete' &&
      start === line.text.length &&
      end === start &&
      lineIndex < section.lines.length - 1
    ) {
      event.preventDefault();
      const merged = mergeLyricLines(line, section.lines[lineIndex + 1]);
      nextCaret.current = { lineId: line.id, offset: merged.caret };
      lines.splice(sectionId, lineIndex, 2, [merged.line]);
    }
  };

  return { registerInput, handleLyricChange, handleLyricKeyDown };
};
