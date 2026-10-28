import { keyPitch, MUSIC_KEYS } from '@/lib/music';

export type PadKey = (typeof MUSIC_KEYS)[number];

const CACHE_PREFIX = 'contiroom-pads-';
// Bump this when the bundled audio files change so an old recording is not reused.
const CACHE_NAME = `${CACHE_PREFIX}v2`;

export const normalizePadKey = (value: string): PadKey | null => {
  const pitch = keyPitch(value);
  return pitch < 12 ? MUSIC_KEYS[pitch] : null;
};

const padUrl = (key: PadKey) => `/pads/pad_${key}.mp3`;

const openCache = () => caches.open(CACHE_NAME);

export const listDownloadedPads = async (): Promise<PadKey[]> => {
  const cache = await openCache();
  const results = await Promise.all(MUSIC_KEYS.map(async (key) => ((await cache.match(padUrl(key))) ? key : null)));
  return results.filter((key): key is PadKey => key !== null);
};

export const getDownloadedPad = async (key: PadKey): Promise<Blob | null> => {
  const response = await (await openCache()).match(padUrl(key));
  return response ? response.blob() : null;
};

export const hasDownloadedPad = async (key: PadKey): Promise<boolean> =>
  Boolean(await (await openCache()).match(padUrl(key)));

export const deleteDownloadedPad = async (key: PadKey): Promise<void> => {
  await (await openCache()).delete(padUrl(key));
};

export const removeOutdatedPadCaches = async (): Promise<void> => {
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)),
  );
};

export const downloadPad = async (
  key: PadKey,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<void> => {
  const response = await fetch(padUrl(key), { cache: 'no-store', signal });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
    throw new Error(`${key} 패드 파일을 받을 수 없습니다.`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  if (total && navigator.storage?.estimate) {
    const { usage = 0, quota = Infinity } = await navigator.storage.estimate();
    if (usage + total > quota) throw new Error('브라우저 저장 공간이 부족합니다.');
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total) onProgress(Math.min((received / total) * 100, 100));
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    chunks.push(bytes);
    received = bytes.byteLength;
  }
  if (signal.aborted) throw new DOMException('다운로드가 취소되었습니다.', 'AbortError');
  if (total && received !== total) throw new Error('패드 파일을 끝까지 받지 못했습니다.');

  const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') ?? 'audio/mpeg' });
  const cache = await openCache();
  await cache.put(padUrl(key), new Response(blob, { headers: { 'content-type': blob.type } }));
  if (signal.aborted) {
    await cache.delete(padUrl(key));
    throw new DOMException('다운로드가 취소되었습니다.', 'AbortError');
  }
  onProgress(100);
};
