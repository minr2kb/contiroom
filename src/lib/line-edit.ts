import { sortBy } from 'es-toolkit/array';
import { clamp } from 'es-toolkit/math';
import { graphemeCount, graphemes } from './graphemes.ts';
import type { LyricLine } from './model.ts';

export const splitLyricLine = (
  line: LyricLine,
  selectionStart: number,
  selectionEnd: number,
  newLineId: string,
): [LyricLine, LyricLine] => {
  const start = clamp(selectionStart, 0, line.text.length);
  const end = clamp(selectionEnd, start, line.text.length);
  if (!line.text && line.chords.length && start === 0 && end === 0) {
    return [line, { id: newLineId, text: '', chords: [] }];
  }
  const firstText = line.text.slice(0, start);
  const secondText = line.text.slice(end);
  const firstLength = graphemeCount(firstText);
  const removedEnd = graphemeCount(line.text.slice(0, end));
  return [
    { ...line, text: firstText, chords: line.chords.filter((chord) => chord.offset < firstLength) },
    {
      id: newLineId,
      text: secondText,
      chords: line.chords
        .filter((chord) => chord.offset >= removedEnd)
        .map((chord) => ({ ...chord, offset: chord.offset - removedEnd })),
    },
  ];
};

export const rewriteLyricLine = (line: LyricLine, text: string): LyricLine => {
  const before = graphemes(line.text);
  const after = graphemes(text);
  let start = 0;
  let end = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  while (
    end < Math.min(before.length - start, after.length - start) &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  const shift = after.length - before.length;
  return {
    ...line,
    text,
    chords: line.chords.map((chord) => {
      if (chord.offset < start) return { ...chord };
      if (chord.offset >= before.length - end) {
        return { ...chord, offset: Math.max(0, chord.offset + shift) };
      }
      return { ...chord, offset: start };
    }),
  };
};

export const splitMultilineLyric = (line: LyricLine, text: string, newLineIds: string[]): LyricLine[] => {
  const parts = text.replace(/\r\n?/g, '\n').split('\n');
  if (newLineIds.length !== parts.length - 1) throw new Error('Expected one ID for each new line');
  const rewritten = rewriteLyricLine(line, parts.join(''));
  const result: LyricLine[] = parts.map((part, index) => ({
    id: index === 0 ? line.id : newLineIds[index - 1],
    text: part,
    chords: [],
  }));
  for (const chord of rewritten.chords) {
    if (!line.text && line.chords.length && parts[0] === '') {
      result[0].chords.push(chord);
      continue;
    }
    let offset = chord.offset;
    let index = 0;
    while (index < parts.length - 1 && offset >= graphemeCount(parts[index])) {
      offset -= graphemeCount(parts[index]);
      index++;
    }
    result[index].chords.push({ ...chord, offset });
  }
  return result;
};

export const mergeLyricLines = (previous: LyricLine, current: LyricLine): { line: LyricLine; caret: number } => {
  const shift = graphemeCount(previous.text);
  return {
    line: {
      ...previous,
      text: previous.text + current.text,
      chords: sortBy(
        [...previous.chords, ...current.chords.map((chord) => ({ ...chord, offset: chord.offset + shift }))],
        ['offset'],
      ),
    },
    caret: previous.text.length,
  };
};
