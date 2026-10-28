import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { prepareScoreImages, scoreBandRanges } from './song-photo-images.ts';

test('overlapping score crops cover the full height of tall pages', () => {
  for (const height of [870, 1400, 2600]) {
    const ranges = scoreBandRanges(height);
    assert.equal(ranges.length, 4);
    assert.equal(ranges[0].top, 0);
    const last = ranges.at(-1);
    assert.ok(last);
    assert.equal(last.top + last.height, height);
    for (let index = 1; index < ranges.length; index++) {
      assert.ok(ranges[index].top < ranges[index - 1].top + ranges[index - 1].height);
    }
  }
});

test('large portrait score still gets full-resolution crops', async () => {
  const input = await sharp({
    create: { width: 1600, height: 3000, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  const images = await prepareScoreImages(input);
  assert.equal(images.length, 5);
  const firstCrop = Buffer.from(images[1].split(',')[1], 'base64');
  assert.equal((await sharp(firstCrop).metadata()).width, 1600);
});
