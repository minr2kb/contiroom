import assert from 'node:assert/strict';
import test from 'node:test';
import { readSongListQuery } from './song-list-query.ts';

test('song list URL reads valid filters and safely defaults malformed values', () => {
  const valid = readSongListQuery(
    new URLSearchParams('q=찬양&key=Db&minBpm=80&maxBpm=140&sort=recent&page=3&tab=saved'),
  );
  assert.deepEqual(valid, {
    filters: { title: '찬양', baseKey: 'Db', minBpm: 80, maxBpm: 140, sort: 'recent' },
    page: 3,
    tab: 'saved',
  });
  assert.equal(readSongListQuery(new URLSearchParams('key=C%23')).filters.baseKey, 'C#');

  const invalid = readSongListQuery(
    new URLSearchParams('key=unknown&minBpm=-1&maxBpm=301&sort=other&page=0&tab=other'),
  );
  assert.deepEqual(invalid, {
    filters: { title: '', baseKey: '', minBpm: undefined, maxBpm: undefined, sort: 'title' },
    page: 1,
    tab: 'mine',
  });
});
