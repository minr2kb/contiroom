import assert from 'node:assert/strict';
import test from 'node:test';
import { toSong } from './data-records.ts';

test('a saved song keeps its translation toggle and line translations when read', () => {
  const song = toSong({
    id: 'song',
    title: '곡',
    base_key: 'C',
    bpm: null,
    sections: [
      { id: 'verse', name: 'Verse', lines: [{ id: 'line', text: '가사', translation: 'Lyrics', chords: [] }] },
    ],
    translation_enabled: true,
    visibility: 'private',
    owner_id: '00000000-0000-4000-8000-000000000001',
    creator_user_id: '00000000-0000-4000-8000-000000000001',
    artist: null,
    created_at: '2026-10-29T00:00:00Z',
    origin_song_id: null,
  });
  assert.equal(song.translationEnabled, true);
  assert.equal(song.sections[0].lines[0].translation, 'Lyrics');
});
