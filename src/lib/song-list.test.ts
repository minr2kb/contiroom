import assert from 'node:assert/strict';
import test from 'node:test';
import type { Song } from './model.ts';
import { selectSongs } from './song-list.ts';

const songs: Song[] = [
  { id: '3', title: '사랑의 노래', baseKey: 'G', bpm: 120, createdAt: '2026-01-01T00:00:00Z', sections: [] },
  { id: '2', title: '기쁨', baseKey: 'C#', bpm: 80, createdAt: '2026-03-01T00:00:00Z', sections: [] },
  { id: '1', title: '기쁨', baseKey: 'Db', createdAt: '2026-02-01T00:00:00Z', sections: [] },
  { id: '4', title: '찬양', baseKey: '키 미설정', bpm: 100, sections: [] },
];

test('selectSongs combines title, exact key and inclusive BPM bounds without mutating input', () => {
  const original = [...songs];
  assert.deepEqual(
    selectSongs(songs, { title: ' 기쁨 ', baseKey: 'C#', minBpm: '80', maxBpm: 80 }).map((s) => s.id),
    ['2'],
  );
  assert.deepEqual(
    selectSongs(songs, { minBpm: '', maxBpm: 'bad' }).map((s) => s.id),
    ['1', '2', '3', '4'],
  );
  assert.deepEqual(
    selectSongs(songs, { minBpm: 90, maxBpm: 120 }).map((s) => s.id),
    ['3', '4'],
  );
  assert.deepEqual(songs, original);
});

test('selectSongs sorts key pitch, BPM with missing values last, and creation or save recency', () => {
  assert.deepEqual(
    selectSongs(songs, { sort: 'key' }).map((s) => s.id),
    ['1', '2', '3', '4'],
  );
  assert.deepEqual(
    selectSongs(songs, { sort: 'bpm' }).map((s) => s.id),
    ['2', '4', '3', '1'],
  );
  assert.deepEqual(
    selectSongs(songs, { sort: 'recent' }).map((s) => s.id),
    ['2', '1', '3', '4'],
  );
  const savedAtBySongId = new Map([
    ['3', '2026-04-01T00:00:00Z'],
    ['1', '2026-01-01T00:00:00Z'],
  ]);
  assert.deepEqual(
    selectSongs(songs, { sort: 'recent', savedAtBySongId }).map((s) => s.id),
    ['3', '1', '2', '4'],
  );
});
