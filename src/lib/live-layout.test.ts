import assert from 'node:assert/strict';
import test from 'node:test';
import { isDisplayOptions, wrapLiveLine } from './live.ts';

assert.equal(isDisplayOptions({ count: 3, showChords: true, showForm: false, showNextLyrics: true }), true);
assert.equal(isDisplayOptions({ count: 4, showChords: true, showForm: false, showNextLyrics: true }), false);

test('live lyrics wrap graphemes at the available width without losing spaces', () => {
  const rows = wrapLiveLine([40, 40, 20, 40, 40], [], 100);
  assert.deepEqual(
    rows.map(({ start, end }) => [start, end]),
    [
      [0, 3],
      [3, 5],
    ],
  );
});

test('a long chord moves with its anchor to the next row', () => {
  const rows = wrapLiveLine([40, 40, 40, 40], [{ id: 'chord', value: 'Cmaj7/E', offset: 2, width: 80 }], 100);
  assert.deepEqual(
    rows.map(({ start, end }) => [start, end]),
    [
      [0, 2],
      [2, 4],
    ],
  );
  assert.equal(rows[1].chords[0].x, 0);
});

test('chords sharing an anchor use separate lanes, including on an empty lyric', () => {
  const rows = wrapLiveLine(
    [40],
    [
      { id: 'first', value: 'C', offset: 0, width: 30 },
      { id: 'second', value: 'G/B', offset: 0, width: 60 },
    ],
    40,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lanes, 2);
  assert.deepEqual(
    rows[0].chords.map(({ lane }) => lane),
    [0, 1],
  );
});

test('narrow widths keep every grapheme and place nearby chords on separate lanes', () => {
  const rows = wrapLiveLine(
    [35, 35, 35],
    [
      { id: 'first', value: 'Cmaj7', offset: 0, width: 55 },
      { id: 'second', value: 'G/B', offset: 1, width: 35 },
    ],
    70,
  );
  assert.deepEqual(
    rows.map(({ start, end }) => [start, end]),
    [
      [0, 2],
      [2, 3],
    ],
  );
  assert.deepEqual(
    rows[0].chords.map(({ x, lane }) => [x, lane]),
    [
      [0, 0],
      [35, 1],
    ],
  );
});
