export type Chord = { id: string; offset: number; value: string };
export type LyricLine = { id: string; text: string; chords: Chord[] };
export type Section = { id: string; name: string; lines: LyricLine[] };
export type Song = {
  id: string;
  ownerId?: string;
  creatorId?: string;
  creatorHandle?: string;
  createdAt?: string;
  originSongId?: string;
  originAvailable?: boolean;
  artist?: string;
  visibility?: 'private' | 'public';
  title: string;
  baseKey: string;
  bpm?: number;
  sections: Section[];
};

export type FormStep = { id: string; sectionId: string };
export type ContiItem = {
  id: string;
  songId: string;
  key?: string;
  bpm?: number;
  form: FormStep[];
};
export type Conti = {
  id: string;
  ownerId?: string;
  creatorId?: string;
  creatorHandle?: string;
  createdAt?: string;
  visibility?: 'private' | 'public';
  title: string;
  scheduledDate?: string;
  youtubePlaylistUrl?: string;
  items: ContiItem[];
};

const exampleLine = (id: string, text: string, changes: [string, string][]): LyricLine => {
  let searchFrom = 0;
  return {
    id,
    text,
    chords: changes.map(([anchor, value], index) => {
      const offset = text.indexOf(anchor, searchFrom);
      if (offset < 0) throw new Error(`Missing chord anchor: ${anchor}`);
      searchFrom = offset + anchor.length;
      return { id: `${id}-chord-${index + 1}`, offset, value };
    }),
  };
};

export const sampleSongs: Song[] = [
  {
    id: 'song-1',
    title: '코드 배치 예시',
    baseKey: 'G',
    sections: [
      {
        id: 's3-verse-1',
        name: 'Verse 1',
        lines: [
          exampleLine('s3-l1', '첫 번째 예시 문장에 코드를 배치합니다', [
            ['첫', 'G'],
            ['번째', 'C'],
            ['예시', 'Bm7'],
            ['문장', 'Em7'],
            ['코드', 'Am7'],
            ['배치', 'C/D'],
            ['합니다', 'G'],
          ]),
          exampleLine('s3-l2', '두 번째 줄에는 여러 코드를 표시합니다', [
            ['두', 'F/G'],
            ['번째', 'C'],
            ['줄에는', 'D/C'],
            ['여러', 'Bm7'],
            ['표시', 'Em7'],
          ]),
          exampleLine('s3-l3', '세 번째 줄도 연습용 문장입니다', [
            ['세', 'Am7'],
            ['연습', 'C/D'],
            ['문장', 'D'],
          ]),
        ],
      },
      {
        id: 's3-verse-2',
        name: 'Verse 2',
        lines: [
          exampleLine('s3-l4', '다음 절에서는 코드 위치를 다시 확인합니다', [
            ['다음', 'G'],
            ['절에서는', 'Am7'],
            ['코드', 'Bm7'],
            ['위치', 'Em7'],
            ['다시', 'Am7'],
            ['확인', 'D/C'],
            ['합니다', 'Bm7'],
          ]),
          exampleLine('s3-l5', '각 단어 위에 코드가 놓이는 예시', [
            ['각', 'Em7'],
            ['단어', 'C'],
            ['코드', 'D/C'],
            ['놓이는', 'Bm7'],
            ['예시', 'Em7'],
          ]),
          exampleLine('s3-l6', '마지막 줄에서 전조를 시험합니다', [
            ['마지막', 'G/A'],
            ['시험', 'A/C#'],
          ]),
        ],
      },
      {
        id: 's3-turnaround',
        name: 'Turnaround',
        lines: [
          exampleLine('s3-turn-line', '♪ ♪', [
            ['♪', 'Dsus4'],
            ['♪', 'D'],
          ]),
        ],
      },
      {
        id: 's3-chorus',
        name: 'Chorus',
        lines: [
          exampleLine('s3-l7', '후렴 첫 번째 예시 줄', [
            ['후렴', 'G/B'],
            ['예시', 'CM7'],
          ]),
          exampleLine('s3-l8', '후렴 두 번째 예시 줄', [
            ['후렴', 'D/C'],
            ['예시', 'Bm7'],
            ['줄', 'Em7'],
          ]),
          exampleLine('s3-l9', '코드와 글자 간격', [
            ['코드', 'Em7'],
            ['글자', 'Am7'],
          ]),
          exampleLine('s3-l10', '슬래시 코드 예시', [
            ['슬래시', 'C/D'],
            ['예시', 'Cm/G'],
          ]),
          exampleLine('s3-l11', '후렴 다섯 번째 줄', [
            ['후렴', 'G'],
            ['번째', 'CM7'],
          ]),
          exampleLine('s3-l12', '후렴 여섯 번째 줄', [
            ['후렴', 'D/C'],
            ['번째', 'Bm7'],
            ['줄', 'Em7'],
          ]),
          exampleLine('s3-l13', '마지막 예시 줄 끝에도 코드', [
            ['마지막', 'Am7'],
            ['예시', 'C/D'],
            ['끝에도', 'C/G'],
            ['', 'G'],
          ]),
        ],
      },
    ],
  },
  {
    id: 'song-2',
    title: 'Chord Practice Example',
    baseKey: 'D',
    bpm: 82,
    sections: [
      {
        id: 's2-verse',
        name: 'Verse',
        lines: [
          {
            id: 'l6',
            text: 'First example line for chord display',
            chords: [
              { id: 'c11', offset: 0, value: 'D' },
              { id: 'c12', offset: 14, value: 'G' },
            ],
          },
          {
            id: 'l7',
            text: 'Second example line for practice',
            chords: [
              { id: 'c13', offset: 0, value: 'D/F#' },
              { id: 'c14', offset: 15, value: 'A7' },
            ],
          },
        ],
      },
      {
        id: 's2-chorus',
        name: 'Chorus',
        lines: [
          {
            id: 'l8',
            text: 'Third example line for chorus display',
            chords: [
              { id: 'c15', offset: 0, value: 'Bm' },
              { id: 'c16', offset: 14, value: 'G' },
            ],
          },
          {
            id: 'l9',
            text: 'Fourth example line for practice',
            chords: [
              { id: 'c17', offset: 0, value: 'D/A' },
              { id: 'c18', offset: 15, value: 'A7' },
            ],
          },
        ],
      },
    ],
  },
];

export const sampleContis: Conti[] = [
  {
    id: 'conti-1',
    title: '주일 오전 예배',
    scheduledDate: '2026-10-11',
    items: [
      {
        id: 'item-1',
        songId: 'song-1',
        key: 'G',
        form: [
          { id: 'f1', sectionId: 's3-verse-1' },
          { id: 'f2', sectionId: 's3-verse-2' },
          { id: 'f2-turn', sectionId: 's3-turnaround' },
          { id: 'f3', sectionId: 's3-chorus' },
          { id: 'f4', sectionId: 's3-chorus' },
        ],
      },
      {
        id: 'item-2',
        songId: 'song-2',
        form: [
          { id: 'f5', sectionId: 's2-verse' },
          { id: 'f6', sectionId: 's2-chorus' },
        ],
      },
    ],
  },
  {
    id: 'conti-2',
    title: '수요 예배',
    scheduledDate: '2026-10-14',
    items: [
      {
        id: 'item-3',
        songId: 'song-1',
        key: 'A',
        form: [
          { id: 'f7', sectionId: 's3-verse-2' },
          { id: 'f7-turn', sectionId: 's3-turnaround' },
          { id: 'f8', sectionId: 's3-chorus' },
        ],
      },
    ],
  },
];
