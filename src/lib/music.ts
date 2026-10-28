import type { ContiItem, Song } from './model.ts';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PITCH: Record<string, number> = Object.fromEntries(
  [...SHARPS, ...FLATS].map((note, index) => [note, index % 12]),
);

/** 코드 근음과 베이스 선택지. 자주 쓰는 이명동음의 샵·플랫 표기를 포함한다. */
export const CHORD_ROOTS = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
] as const;
/** 곡과 콘티의 조성 선택지. */
export const MUSIC_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
/** 코드 선택기에 표시할 종류. 빈 문자열은 장3화음(Major)이다. */
export const CHORD_QUALITIES = ['', 'm', '7', 'M7', 'm7', 'sus4', '2', 'add9', '6', 'm6', 'm7b5', 'dim', 'aug'] as const;

/** 조성의 반음 위치(C=0)를 반환한다. 알 수 없는 키는 정렬용 끝값 12를 반환한다. */
export const keyPitch = (key: string): number => PITCH[key] ?? 12;

/** root는 근음, quality는 근음 뒤 접미사, bass는 슬래시 뒤 베이스 음이다. */
export type ChordParts = { root: string; quality: string; bass?: string };

/** 코드 문자열을 분해한다. 근음·베이스 음이나 슬래시 구조가 잘못되면 null을 반환한다. 종류 접미사는 별도로 제한하지 않는다. */
export const parseChord = (value: string): ChordParts | null => {
  const match = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/.exec(value);
  if (!match || PITCH[match[1]] === undefined || (match[3] && PITCH[match[3]] === undefined)) return null;
  return { root: match[1], quality: match[2], ...(match[3] ? { bass: match[3] } : {}) };
};

/** 코드 구성 요소를 문자열로 합친다. 음이 유효하지 않거나 quality에 슬래시·공백이 있으면 예외를 던진다. */
export const makeChord = ({ root, quality, bass }: ChordParts): string => {
  if (PITCH[root] === undefined || (bass && PITCH[bass] === undefined) || /[/\s]/.test(quality)) {
    throw new Error('Invalid chord parts');
  }
  return `${root}${quality}${bass ? `/${bass}` : ''}`;
};

/**
 * 코드를 semitones만큼 이동한다. 양수는 위로, 음수는 아래로 이동한다.
 * preferFlats는 결과 음을 플랫으로 표기할지 결정하며, 생략하면 원본의 'b' 포함 여부를 따른다.
 * 코드를 해석할 수 없으면 원본 문자열을 그대로 반환한다.
 */
export const transposeChord = (value: string, semitones: number, preferFlats = value.includes('b')): string => {
  const chord = parseChord(value);
  if (!chord) return value;
  const notes = preferFlats ? FLATS : SHARPS;
  const move = (note: string) => notes[(((PITCH[note] + semitones) % 12) + 12) % 12];
  return makeChord({ root: move(chord.root), quality: chord.quality, bass: chord.bass ? move(chord.bass) : undefined });
};

/** 곡의 baseKey에서 콘티 항목의 key까지 이동할 반음 수를 반환한다. 항목 키가 없으면 0이다. */
export const itemSemitones = (song: Song, item: ContiItem): number => {
  const base = PITCH[song.baseKey];
  const target = PITCH[item.key ?? song.baseKey];
  return base === undefined || target === undefined ? 0 : target - base;
};
