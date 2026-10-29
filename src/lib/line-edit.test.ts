import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeLyricLines, splitLyricLine, splitMultilineLyric } from './line-edit.ts';
import type { LyricLine } from './model.ts';

test('Enter splits Korean lyrics and moves chords with the following syllables', () => {
  const original: LyricLine = {
    id: 'a',
    text: '주님을 예배해',
    chords: [
      { id: 'c1', offset: 0, value: 'G' },
      { id: 'c2', offset: 4, value: 'C' },
    ],
  };
  const [first, second] = splitLyricLine(original, 4, 4, 'b');
  assert.equal(first.text, '주님을 ');
  assert.equal(second.text, '예배해');
  assert.deepEqual(
    first.chords.map((chord) => chord.offset),
    [0],
  );
  assert.deepEqual(
    second.chords.map((chord) => chord.offset),
    [0],
  );
  assert.deepEqual(mergeLyricLines(first, second), { line: original, caret: 4 });
});

test('Enter replaces a selection and preserves later chord anchors', () => {
  const original: LyricLine = {
    id: 'a',
    text: '첫소절 다음절 끝',
    chords: [
      { id: 'c1', offset: 0, value: 'G' },
      { id: 'c2', offset: 4, value: 'C' },
      { id: 'c3', offset: 8, value: 'Bm7' },
    ],
  };
  const [first, second] = splitLyricLine(original, 4, 8, 'b');
  assert.equal(first.text, '첫소절 ');
  assert.equal(second.text, '끝');
  assert.deepEqual(
    first.chords.map((chord) => chord.value),
    ['G'],
  );
  assert.deepEqual(
    second.chords.map((chord) => [chord.value, chord.offset]),
    [['Bm7', 0]],
  );
});

test('merging an instrumental line keeps its chord spacing', () => {
  const previous: LyricLine = { id: 'a', text: '예배', chords: [] };
  const instrumental: LyricLine = { id: 'b', text: '', chords: [{ id: 'c', offset: 5, value: 'Dsus4' }] };
  assert.deepEqual(mergeLyricLines(previous, instrumental), {
    line: { id: 'a', text: '예배', chords: [{ id: 'c', offset: 7, value: 'Dsus4' }] },
    caret: 2,
  });
});

test('Enter after an instrumental line leaves its chords in place', () => {
  const instrumental: LyricLine = { id: 'a', text: '', chords: [{ id: 'c', offset: 5, value: 'Dsus4' }] };
  assert.deepEqual(splitLyricLine(instrumental, 0, 0, 'b'), [instrumental, { id: 'b', text: '', chords: [] }]);
});

test('multiline paste creates separate lines and keeps suffix chord position', () => {
  const original: LyricLine = {
    id: 'a',
    text: '주님 예배',
    chords: [
      { id: 'c1', offset: 0, value: 'G' },
      { id: 'c2', offset: 3, value: 'C' },
    ],
  };
  const lines = splitMultilineLyric(original, '주님\n반주\n 예배', ['b', 'c']);
  assert.deepEqual(
    lines.map((line) => line.text),
    ['주님', '반주', ' 예배'],
  );
  assert.deepEqual(
    lines.map((line) => line.chords.map((chord) => [chord.value, chord.offset])),
    [[['G', 0]], [], [['C', 1]]],
  );
});

test('splitting lyrics keeps an unsplittable translation with the original line', () => {
  const original: LyricLine = { id: 'a', text: '주님 예배', translation: 'Worship the Lord', chords: [] };
  const [first, second] = splitLyricLine(original, 3, 3, 'b');
  assert.equal(first.translation, 'Worship the Lord');
  assert.equal(second.translation, undefined);
  assert.deepEqual(
    splitMultilineLyric(original, '주님\n 예배', ['b']).map((line) => line.translation),
    ['Worship the Lord', undefined],
  );
  assert.deepEqual(
    splitLyricLine(original, 0, 0, 'b').map((line) => line.translation),
    [undefined, 'Worship the Lord'],
  );
  assert.deepEqual(
    splitMultilineLyric(original, '\n주님 예배', ['b']).map((line) => line.translation),
    [undefined, 'Worship the Lord'],
  );
});

test('merging lyrics preserves translations from both lines', () => {
  const previous: LyricLine = { id: 'a', text: '주님', translation: 'Lord', chords: [] };
  const current: LyricLine = { id: 'b', text: ' 예배', translation: 'we worship', chords: [] };
  assert.equal(mergeLyricLines(previous, current).line.translation, 'Lord we worship');
  assert.equal(mergeLyricLines({ ...previous, translation: undefined }, current).line.translation, 'we worship');
});
