import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleContis, sampleSongs } from './model.ts';
import { printForm, printLineSegments } from './print-score.ts';

test('print groups lyrics between chord anchors without losing spaces or trailing chords', () => {
  const segments = printLineSegments({
    id: 'line',
    text: '주 님',
    chords: [
      { id: 'a', offset: 0, value: 'G' },
      { id: 'b', offset: 2, value: 'D' },
      { id: 'c', offset: 2, value: 'F#' },
      { id: 'd', offset: 5, value: 'C' },
    ],
  });
  assert.deepEqual(
    segments.map(({ offset, text, chords }) => [offset, text, chords.map((chord) => chord.value)]),
    [
      [0, '주\u00a0', ['G']],
      [2, '님\u00a0\u00a0', ['D', 'F#']],
      [5, '\u00a0', ['C']],
    ],
  );
});

test('print summarizes repeated form steps while the score keeps original sections', () => {
  const song = sampleSongs[0];
  const item = sampleContis[0].items[0];
  assert.equal(printForm(song, item), 'Verse 1 → Verse 2 → Turnaround → Chorus ×2');
  assert.equal(printForm(song), song.sections.map((section) => section.name).join(' → '));
  assert.equal(song.sections.length, new Set(song.sections.map((section) => section.id)).size);
});
