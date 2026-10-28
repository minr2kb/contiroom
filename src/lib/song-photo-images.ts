import sharp from 'sharp';

export function scoreBandRanges(height: number): { top: number; height: number }[] {
  const bandHeight = Math.min(height, Math.max(220, Math.ceil((height / 4) * 1.2)));
  if (bandHeight === height) return [{ top: 0, height }];
  return Array.from({ length: 4 }, (_, index) => ({
    top: Math.round(((height - bandHeight) * index) / 3),
    height: bandHeight,
  }));
}

/** Keep a full-page overview and enlarge overlapping horizontal bands for small printed lyrics. */
export async function prepareScoreImages(bytes: Buffer): Promise<string[]> {
  const normalized = await sharp(bytes, { limitInputPixels: 60_000_000 }).rotate().png().toBuffer();
  const { width, height } = await sharp(normalized).metadata();
  if (!width || !height) throw new Error('Invalid image dimensions');
  const images = [`data:image/png;base64,${normalized.toString('base64')}`];
  if (height < width * 0.6) return images;

  for (const band of scoreBandRanges(height)) {
    const crop = await sharp(normalized)
      .extract({ left: 0, top: band.top, width, height: band.height })
      .resize({ width: width < 1600 ? width * 2 : Math.min(width, 6000) })
      .png()
      .toBuffer();
    images.push(`data:image/png;base64,${crop.toString('base64')}`);
  }
  return images;
}
