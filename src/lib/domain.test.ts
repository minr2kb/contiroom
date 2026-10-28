import assert from 'node:assert/strict';
import test from 'node:test';
import { contiSchema } from './data-router.ts';
import { flattenConti, moveCursor, movePageCursor, moveSongCursor, visibleLines } from './live.ts';
import { sampleContis, sampleSongs } from './model.ts';
import { keyPitch, makeChord, parseChord, transposeChord } from './music.ts';

test('sharp and flat song keys share their semitone sort position', () => {
  assert.equal(keyPitch('C#'), keyPitch('Db'));
  assert.equal(keyPitch('D#'), keyPitch('Eb'));
  assert.equal(keyPitch('F#'), keyPitch('Gb'));
  assert.equal(keyPitch('G#'), keyPitch('Ab'));
  assert.equal(keyPitch('A#'), keyPitch('Bb'));
  assert.ok(keyPitch('C#') < keyPitch('D'));
  assert.ok(keyPitch('A#') < keyPitch('B'));
});

test('independent arrangements, transpose, and live navigation', () => {
  const original = structuredClone(sampleSongs);
  const other = structuredClone(sampleContis[1]);
  const first = structuredClone(sampleContis[0]);
  first.items[0].key = 'A';
  const lines = flattenConti(first, sampleSongs);
  assert.equal(lines[0].key, 'A');
  assert.equal(lines.find((line) => line.formId === 'f4')?.key, 'A');
  assert.equal(lines.find((line) => line.formId === 'f4')?.line.chords[0].value, 'A/C#');
  assert.equal(transposeChord('Cmaj7/E', 2), 'Dmaj7/F#');
  assert.equal(transposeChord('G/B', 3, true), 'Bb/D');
  assert.deepEqual(sampleSongs, original);
  assert.deepEqual(sampleContis[1], other);
  assert.equal(moveCursor(lines, 0, 1), 1);
  assert.equal(moveCursor(lines, 0, 1, true), 3);
  assert.equal(moveCursor(lines, 3, -1, true), 0);
  assert.equal(movePageCursor(lines, 0, 1, 2), 2);
  assert.equal(movePageCursor(lines, 2, 1, 2), 3);
  assert.equal(movePageCursor(lines, 3, -1, 2), 2);
  assert.equal(visibleLines(lines, 2, 3).length, 1);
  const repeatStart = lines.findIndex((line) => line.formId === 'f4');
  const nextSong = lines.findIndex((line) => line.formId === 'f5');
  assert.equal(moveCursor(lines, repeatStart - 1, 1, true), repeatStart);
  assert.equal(moveCursor(lines, nextSong - 1, 1), nextSong);
  assert.equal(moveCursor(lines, nextSong, -1, true), repeatStart);
  assert.equal(moveSongCursor(lines, 1, 1), nextSong);
  assert.equal(moveSongCursor(lines, nextSong, -1), 0);
  assert.equal(moveSongCursor(lines, 2, -1), 0);
  assert.equal(moveSongCursor(lines, lines.length - 1, 1), lines.length - 1);
  assert.equal(moveCursor(lines, lines.length - 1, 1), lines.length - 1);
});

test('conti schema accepts legacy data without a date and rejects invalid dates', () => {
  const legacy = { id: 'legacy', title: '기존 콘티', items: [] };
  assert.deepEqual(contiSchema.parse(legacy), legacy);
  assert.equal(contiSchema.safeParse({ ...legacy, scheduledDate: '2026-02-30' }).success, false);
  assert.equal(contiSchema.safeParse({ ...legacy, scheduledDate: '2026/10/18' }).success, false);
});

test('chord parts compose and transpose without losing quality or slash bass', () => {
  const parts = { root: 'Bb', quality: 'm7b5', bass: 'Db' };
  assert.deepEqual(parseChord(makeChord(parts)), parts);
  assert.deepEqual(parseChord('Cmaj7/E'), { root: 'C', quality: 'maj7', bass: 'E' });
  assert.equal(transposeChord(makeChord(parts), 2, true), 'Cm7b5/Eb');
  assert.equal(transposeChord('not a chord', 2), 'not a chord');
  assert.equal(parseChord('C/E/G'), null);
  assert.equal(parseChord('C maj7'), null);
  assert.equal(parseChord('Cmaj7 '), null);
  assert.throws(() => makeChord({ root: 'C', quality: 'maj7 ' }));
  assert.throws(() => makeChord({ root: 'H', quality: '' }));
});

test('synthetic song example appears in both playable contis', () => {
  const song = sampleSongs.find((item) => item.id === 'song-1');
  const conti = sampleContis.find((item) => item.id === 'conti-1');
  assert.equal(song?.title, '코드 배치 예시');
  assert.equal(song?.baseKey, 'G');
  assert.equal(song?.sections.length, 4);
  assert.ok(song);
  assert.ok(conti);
  for (const section of song.sections) {
    for (const line of section.lines) {
      const length = Array.from(line.text).length;
      for (const chord of line.chords) {
        assert.ok(chord.offset >= 0 && chord.offset <= length);
        assert.ok(parseChord(chord.value), chord.value);
      }
    }
  }
  assert.equal(flattenConti(conti, sampleSongs).filter((line) => line.itemId === 'item-1').length, 21);
});
