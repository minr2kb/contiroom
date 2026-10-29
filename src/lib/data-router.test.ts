import assert from 'node:assert/strict';
import test from 'node:test';
import { songSchema } from './data-router.ts';

test('song API schema keeps translation settings and line translations', () => {
  const song = {
    id: 'song',
    title: '곡',
    baseKey: 'G',
    translationEnabled: true,
    sections: [{ id: 'verse', name: 'Verse', lines: [{ id: 'line', text: '주님', translation: 'Lord', chords: [] }] }],
  };
  assert.deepEqual(songSchema.parse(song), song);
  assert.equal(
    songSchema.safeParse({
      ...song,
      sections: [{ ...song.sections[0], lines: [{ ...song.sections[0].lines[0], translation: 42 }] }],
    }).success,
    false,
  );
});
