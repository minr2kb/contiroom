import assert from 'node:assert/strict';
import test from 'node:test';
import { authReturnPath } from './auth-return-path.ts';

test('OAuth return paths stay on this site', () => {
  assert.equal(authReturnPath('/songs/123/edit?tab=score'), '/songs/123/edit?tab=score');
  for (const path of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', null]) {
    assert.equal(authReturnPath(path), '/');
  }
});
