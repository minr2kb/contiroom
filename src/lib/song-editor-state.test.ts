import assert from 'node:assert/strict';
import test from 'node:test';
import type { Song } from './model.ts';
import { initialSongEditorState, songEditorReducer } from './song-editor-state.ts';

const song: Song = {
  id: 'song',
  title: '곡',
  baseKey: 'G',
  sections: [
    {
      id: 'verse',
      name: 'Verse',
      lines: [
        { id: 'first', text: '주님', chords: [{ id: 'chord', offset: 0, value: 'G/B' }] },
        { id: 'second', text: '', chords: [] },
      ],
    },
  ],
};

test('a chord dragged across lines is moved once and keeps its id', () => {
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song });
  const moved = songEditorReducer(loaded, {
    type: 'chord/place',
    sectionId: 'verse',
    lineId: 'second',
    offset: 4,
    chord: { id: 'chord', offset: 0, value: 'G/B' },
    source: { sectionId: 'verse', lineId: 'first' },
  });
  assert.ok(moved.song);
  const lines = moved.song.sections[0].lines;
  assert.deepEqual(lines[0].chords, []);
  assert.deepEqual(lines[1].chords, [{ id: 'chord', offset: 4, value: 'G/B' }]);
  assert.deepEqual(song.sections[0].lines[0].chords, [{ id: 'chord', offset: 0, value: 'G/B' }]);

  const movedAgain = songEditorReducer(moved, {
    type: 'chord/place',
    sectionId: 'verse',
    lineId: 'second',
    offset: 7,
    chord: { id: 'chord', offset: 4, value: 'G/B' },
    source: { sectionId: 'verse', lineId: 'second' },
  });
  assert.ok(movedAgain.song);
  assert.deepEqual(movedAgain.song.sections[0].lines[1].chords, [{ id: 'chord', offset: 7, value: 'G/B' }]);
});

test('recent chords seed from song, cap at ten, and put used chords first', () => {
  let state = songEditorReducer(initialSongEditorState, { type: 'load', song });
  assert.deepEqual(state.recentChords, ['G/B']);
  for (let index = 0; index < 12; index++) {
    state = songEditorReducer(state, { type: 'recent/use', value: `C${index}` });
  }
  assert.equal(state.recentChords.length, 10);
  assert.deepEqual(state.recentChords.slice(0, 2), ['C11', 'C10']);
  state = songEditorReducer(state, { type: 'recent/use', value: 'C8' });
  assert.equal(state.recentChords[0], 'C8');
  assert.equal(state.recentChords.filter((value) => value === 'C8').length, 1);
});

test('lyric edits and line splices leave the loaded song untouched', () => {
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song });
  const edited = songEditorReducer(loaded, {
    type: 'line/rewrite',
    sectionId: 'verse',
    lineId: 'first',
    text: '오 주님',
  });
  const spliced = songEditorReducer(edited, {
    type: 'line/splice',
    sectionId: 'verse',
    index: 1,
    deleteCount: 1,
    lines: [{ id: 'new', text: '', chords: [{ id: 'new-chord', offset: 5, value: 'C' }] }],
  });
  assert.ok(spliced.song);
  assert.equal(spliced.song.sections[0].lines[0].text, '오 주님');
  assert.equal(spliced.song.sections[0].lines[1].id, 'new');
  assert.equal(song.sections[0].lines[0].text, '주님');
});

test('duplicating a lyric line inserts an independent copy after its source', () => {
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song });
  const duplicated = songEditorReducer(loaded, {
    type: 'line/duplicate',
    sectionId: 'verse',
    lineId: 'first',
    newLineId: 'copy',
  });
  assert.ok(duplicated.song);
  const [source, copy, next] = duplicated.song.sections[0].lines;
  assert.equal(next.id, 'second');
  assert.equal(copy.text, source.text);
  assert.equal(copy.id, 'copy');
  assert.notEqual(copy.id, source.id);
  assert.deepEqual(
    copy.chords.map(({ offset, value }) => ({ offset, value })),
    [{ offset: 0, value: 'G/B' }],
  );
  assert.notEqual(copy.chords[0].id, source.chords[0].id);
  assert.deepEqual(
    song.sections[0].lines.map((line) => line.id),
    ['first', 'second'],
  );
  assert.equal(songEditorReducer(loaded, { type: 'line/duplicate', sectionId: 'verse', lineId: 'missing' }), loaded);
});

test('removing the only line leaves an editable empty line without its chords', () => {
  const single = { ...song, sections: [{ ...song.sections[0], lines: [song.sections[0].lines[0]] }] };
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song: single });
  const removed = songEditorReducer(loaded, { type: 'line/remove', sectionId: 'verse', lineId: 'first' });
  assert.deepEqual(removed.song?.sections[0].lines, [{ id: 'first', text: '', chords: [] }]);
  assert.equal(single.sections[0].lines[0].text, '주님');
});

test('reordering sections and lines keeps their content and chords attached', () => {
  const twoSections = {
    ...song,
    sections: [
      ...song.sections,
      { id: 'chorus', name: 'Chorus', lines: [{ id: 'chorus-line', text: '후렴', chords: [] }] },
    ],
  } satisfies Song;
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song: twoSections });
  const reorderedLine = songEditorReducer(loaded, {
    type: 'line/reorder',
    sectionId: 'verse',
    lineId: 'first',
    toIndex: 1,
  });
  assert.deepEqual(
    reorderedLine.song?.sections[0].lines.map((line) => line.id),
    ['second', 'first'],
  );
  const movedLine = songEditorReducer(reorderedLine, {
    type: 'line/move',
    sourceSectionId: 'verse',
    targetSectionId: 'chorus',
    lineId: 'first',
    toIndex: 0,
    emptyLine: { id: 'empty', text: '', chords: [] },
  });
  const reorderedSection = songEditorReducer(movedLine, { type: 'section/reorder', sectionId: 'chorus', toIndex: 0 });
  assert.deepEqual(
    reorderedSection.song?.sections.map((section) => section.id),
    ['chorus', 'verse'],
  );
  assert.deepEqual(
    reorderedSection.song?.sections[0].lines.map((line) => line.id),
    ['first', 'chorus-line'],
  );
  assert.deepEqual(reorderedSection.song?.sections[0].lines[0].chords, [{ id: 'chord', offset: 0, value: 'G/B' }]);
  assert.deepEqual(
    reorderedSection.song?.sections[1].lines.map((line) => line.id),
    ['second'],
  );
  assert.deepEqual(
    twoSections.sections[0].lines.map((line) => line.id),
    ['first', 'second'],
  );
});

test('moving the last line to another section leaves an editable empty line', () => {
  const single = {
    ...song,
    sections: [
      { ...song.sections[0], lines: [song.sections[0].lines[0]] },
      { id: 'chorus', name: 'Chorus', lines: [{ id: 'chorus-line', text: '', chords: [] }] },
    ],
  } satisfies Song;
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song: single });
  const moved = songEditorReducer(loaded, {
    type: 'line/move',
    sourceSectionId: 'verse',
    targetSectionId: 'chorus',
    lineId: 'first',
    toIndex: 1,
    emptyLine: { id: 'empty', text: '', chords: [] },
  });
  assert.deepEqual(moved.song?.sections[0].lines, [{ id: 'empty', text: '', chords: [] }]);
  assert.deepEqual(
    moved.song?.sections[1].lines.map((line) => line.id),
    ['chorus-line', 'first'],
  );
  assert.deepEqual(moved.song?.sections[1].lines[1].chords, [{ id: 'chord', offset: 0, value: 'G/B' }]);
});

test('translation toggle preserves drafts and translation follows copied and moved lyrics', () => {
  const original: Song = {
    ...song,
    sections: [
      { ...song.sections[0], lines: [{ ...song.sections[0].lines[0], translation: 'Lord' }] },
      { id: 'chorus', name: 'Chorus', lines: [{ id: 'other', text: '', chords: [] }] },
    ],
  };
  const loaded = songEditorReducer(initialSongEditorState, { type: 'load', song: original });
  const enabled = songEditorReducer(loaded, { type: 'song/set-translation-enabled', value: true });
  const rewritten = songEditorReducer(enabled, {
    type: 'line/rewrite-translation',
    sectionId: 'verse',
    lineId: 'first',
    text: 'Our Lord',
  });
  const duplicated = songEditorReducer(rewritten, {
    type: 'line/duplicate',
    sectionId: 'verse',
    lineId: 'first',
    newLineId: 'copy',
  });
  const moved = songEditorReducer(duplicated, {
    type: 'line/move',
    sourceSectionId: 'verse',
    targetSectionId: 'chorus',
    lineId: 'copy',
    toIndex: 1,
    emptyLine: { id: 'empty', text: '', chords: [] },
  });
  const disabled = songEditorReducer(moved, { type: 'song/set-translation-enabled', value: false });
  assert.equal(disabled.song?.translationEnabled, false);
  assert.equal(disabled.song?.sections[0].lines[0].translation, 'Our Lord');
  assert.equal(disabled.song?.sections[1].lines[1].translation, 'Our Lord');
  assert.equal(original.sections[0].lines[0].translation, 'Lord');
});
