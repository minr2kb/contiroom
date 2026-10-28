import { graphemes } from './graphemes.ts';
import type { ContiItem, LyricLine, Song } from './model.ts';

export const printLineSegments = (line: LyricLine) => {
  const letters = graphemes(line.text);
  const slots = Math.max(letters.length, ...line.chords.map((chord) => chord.offset + 1), 1);
  const starts = [...new Set([0, ...line.chords.map((chord) => chord.offset)])].sort((a, b) => a - b);
  return starts.map((offset, index) => ({
    offset,
    chords: line.chords.filter((chord) => chord.offset === offset),
    text: Array.from({ length: (starts[index + 1] ?? slots) - offset }, (_, step) => {
      const letter = letters[offset + step];
      return letter === ' ' || !letter ? '\u00a0' : letter;
    }).join(''),
  }));
};

export const printForm = (song: Song, item?: ContiItem) => {
  const ids = item ? item.form.map((step) => step.sectionId) : song.sections.map((section) => section.id);
  const groups = ids.reduce<{ id: string; name: string; count: number }[]>((result, id) => {
    const section = song.sections.find((candidate) => candidate.id === id);
    if (!section) return result;
    const last = result[result.length - 1];
    if (last?.id === id) last.count++;
    else result.push({ id, name: section.name, count: 1 });
    return result;
  }, []);
  return groups.map(({ name, count }) => `${name}${count > 1 ? ` ×${count}` : ''}`).join(' → ');
};
