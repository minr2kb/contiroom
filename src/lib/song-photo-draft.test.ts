import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasReadablePhotoContent,
  normalizePhotoSectionName,
  photoSongToDraft,
  storedPhotoDraftSchema,
} from './song-photo-draft.ts';

test('note-aligned lyric units determine chord offsets for parallel verses', () => {
  const draft = photoSongToDraft({
    title: '  새 노래  ',
    artist: ' 팀 ',
    baseKey: 'F#',
    bpm: 86,
    sections: [
      {
        name: '1절',
        lines: [
          {
            units: [
              { lyric: '주', wordStart: false, chords: ['F#'] },
              { lyric: '님', wordStart: false, chords: [] },
              { lyric: '은', wordStart: true, chords: ['C#7', 'bad chord'] },
              { lyric: '', wordStart: false, chords: ['D'] },
            ],
          },
        ],
      },
      {
        name: '2절',
        lines: [
          {
            units: [
              { lyric: '나', wordStart: false, chords: ['F#'] },
              { lyric: '의', wordStart: false, chords: [] },
              { lyric: '길', wordStart: true, chords: ['C#7'] },
            ],
          },
        ],
      },
      { name: 'Verse 2', lines: [{ units: [{ lyric: '끝', wordStart: false, chords: [] }] }] },
    ],
  });

  const ids = [
    draft.id,
    ...draft.sections.flatMap((section) => [
      section.id,
      ...section.lines.flatMap((line) => [line.id, ...line.chords.map((chord) => chord.id)]),
    ]),
  ];
  assert.equal(ids.every((id) => /^[A-Za-z0-9_-]{12}$/.test(id)), true);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(draft.title, '새 노래');
  assert.equal(draft.artist, '팀');
  assert.equal(draft.baseKey, 'Gb');
  assert.equal(draft.visibility, 'private');
  assert.deepEqual(
    draft.sections.map((section) => section.name),
    ['Verse 1', 'Verse 2'],
  );
  assert.deepEqual(
    draft.sections.map((section) => section.lines[0].text),
    ['주님 은', '나의 길'],
  );
  assert.deepEqual(
    draft.sections[1].lines.map((line) => line.text),
    ['나의 길', '끝'],
  );
  assert.deepEqual(
    draft.sections[0].lines[0].chords.map((chord) => [chord.offset, chord.value]),
    [
      [0, 'F#'],
      [3, 'C#7'],
      [4, 'D'],
    ],
  );
  assert.deepEqual(
    draft.sections[1].lines[0].chords.map((chord) => chord.offset),
    [0, 3],
  );
});

test('empty extracted sections are not readable content', () => {
  const empty = photoSongToDraft({
    title: '',
    artist: '',
    baseKey: '',
    bpm: null,
    sections: [{ name: '', lines: [{ units: [{ lyric: '  ', wordStart: false, chords: [] }] }] }],
  });
  assert.equal(hasReadablePhotoContent(empty), false);
  assert.equal(empty.baseKey, '키 미설정');
  assert.equal(storedPhotoDraftSchema.safeParse(empty).success, true);
  const withChord = {
    ...empty,
    sections: [
      {
        ...empty.sections[0],
        lines: [{ ...empty.sections[0].lines[0], chords: [{ id: crypto.randomUUID(), offset: 0, value: 'G' }] }],
      },
    ],
  };
  assert.equal(hasReadablePhotoContent(withChord), true);
});

test('section headings normalize without inventing a chorus', () => {
  assert.equal(normalizePhotoSectionName('Verse II', 0, 0), 'Verse 2');
  assert.equal(normalizePhotoSectionName('V3', 0, 0), 'Verse 3');
  assert.equal(normalizePhotoSectionName('Pre-Chorus', 1, 1), 'Prechorus');
  assert.equal(normalizePhotoSectionName('후렴', 2, 1), 'Chorus');
  assert.equal(normalizePhotoSectionName('브릿지', 3, 1), 'Bridge');
  assert.equal(normalizePhotoSectionName('간주', 4, 1), 'Interlude');
  assert.equal(normalizePhotoSectionName('', 5, 1), 'Verse 2');
  assert.equal(normalizePhotoSectionName('', 0, 0, false), 'Intro');
  assert.equal(normalizePhotoSectionName('', 5, 1, false), 'Interlude');
});

test('interleaved parallel verse rows group by verse without merging choruses', () => {
  const line = (lyric: string) => ({ units: [{ lyric, wordStart: false, chords: [] }] });
  const draft = photoSongToDraft({
    title: 'Song',
    artist: '',
    baseKey: 'C',
    bpm: null,
    sections: [
      { name: 'Verse 1', lines: [line('첫째')] },
      { name: 'Verse 2', lines: [line('둘째')] },
      { name: 'Verse 1', lines: [line('이어짐')] },
      { name: 'Chorus', lines: [line('후렴')] },
      { name: 'Verse 2', lines: [line('계속')] },
      { name: 'Chorus', lines: [line('반복')] },
    ],
  });
  assert.deepEqual(
    draft.sections.map((section) => section.name),
    ['Verse 1', 'Verse 2', 'Chorus', 'Chorus'],
  );
  assert.deepEqual(
    draft.sections[0].lines.map((line) => line.text),
    ['첫째', '이어짐'],
  );
  assert.deepEqual(
    draft.sections[1].lines.map((line) => line.text),
    ['둘째', '계속'],
  );
});
