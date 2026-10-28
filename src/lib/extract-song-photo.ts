import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { CHORD_QUALITIES, CHORD_ROOTS } from './music.ts';
import { photoSongSchema, photoSongToDraft } from './song-photo-draft.ts';
import { prepareScoreImages } from './song-photo-images.ts';

export async function extractSongPhoto(bytes: Buffer, apiKey: string) {
  const client = new OpenAI({ apiKey });
  const images = await prepareScoreImages(bytes);
  const result = await client.responses.parse({
    model: 'gpt-5.4',
    store: false,
    instructions:
      'You are a careful transcriber of printed and handwritten chorded music scores. Read spatial relationships between chord symbols, notes, and lyrics. Copy only what the score supports. Return the requested structured data.',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `악보 사진을 실제 음표와 가사 배치를 따라 전사하세요. 첫 사진은 전체 악보이고, 뒤 사진들은 같은 악보를 위에서 아래 순서로 겹치게 확대한 구간입니다. 겹친 구간을 중복 전사하지 마세요.

1. 먼저 오선의 각 단(system), 마디, 음표 위 코드 기호, 음표 아래 가사 음절을 대응시킵니다. 악보를 왼쪽에서 오른쪽, 위에서 아래로 읽습니다. 코드 기호는 같은 수평 위치의 음표/음표 묶음에 붙입니다. 코드와 무관한 제목·주석을 코드로 옮기지 않습니다.
코드 기호는 이 앱의 코드셋 안에서만 판독하세요. 근음과 슬래시 베이스: ${CHORD_ROOTS.join(', ')}. 근음 뒤에 붙는 코드 종류: ${CHORD_QUALITIES.map((quality) => quality || '접미사 없음(Major)').join(', ')}. Major는 CMajor가 아니라 C처럼 근음만 적습니다. 형식은 근음+종류이며, 슬래시 코드일 때만 /베이스를 붙입니다(예: C2, GM7, Gm6, F#m7/B). 악보에 maj7로 적힌 장7화음은 M7으로 표기하고, 대문자 M7과 소문자 m7을 구별하세요. 6과 m6, 2와 add9처럼 비슷한 기호도 구별하세요. 목록 밖의 종류를 비슷한 지원 코드로 추측해 바꾸지 말고 chords에 넣지 마세요.
2. 각 가사 줄을 음표에 대응하는 순서 있는 units로 반환합니다. 한 unit의 lyric은 해당 음표 아래 인쇄된 가사 조각이며 앞에 공백을 넣지 않습니다. wordStart는 새 단어의 첫 가사 음절일 때 true입니다. 실제 단어 간격과 한글 문맥을 보고 판단하세요. 가사 없는 음표의 lyric은 빈 문자열, wordStart는 false입니다. 멜리스마나 음가 연장 표시(-, _, 긴 선)는 가사가 아니므로 lyric에 넣지 마세요. 문장부호는 보존하세요. 코드가 그 음표 위에서 시작하면 같은 unit의 chords에 기호를 넣습니다. 코드가 없는 음표는 빈 배열입니다. 추정한 문자 offset을 반환하지 마세요.
3. 한 오선에 1절·2절 등 여러 가사 행이 평행하게 인쇄되면 각각 Verse 1, Verse 2로 분리하고 같은 음표 위 코드를 각 절의 해당 가사 unit에 연결하세요. 반복 기호, 1·2번 엔딩을 보고 중복 인쇄된 마디를 두 번 전사하지 마세요. 해당 절의 가사가 이어지는 위치만 연결하세요.
4. 인쇄된 Verse/Prechorus/Chorus/Bridge/Tag/Intro/Interlude/Outro 구분이나 명확한 절 번호를 섹션 name에 반영하세요. 악보에 구분이 없으면 멜로디 변화만으로 Chorus 같은 이름을 만들지 마세요. 이어지는 같은 절의 가사 줄은 한 섹션 안에 모으세요. 섹션·가사 줄의 실제 읽기 순서를 유지합니다.
5. 보이는 제목·아티스트·키·BPM만 기록합니다. 불확실한 제목·아티스트·키는 빈 문자열, BPM은 null입니다. 악보에 없는 가사·코드·섹션을 만들지 마세요. 이 결과는 사람이 확인할 편집 초안입니다.`,
          },
          ...images.map((image_url) => ({ type: 'input_image' as const, image_url, detail: 'original' as const })),
        ],
      },
    ],
    text: { format: zodTextFormat(photoSongSchema, 'song_photo_draft') },
  });
  if (!result.output_parsed) throw new Error('Empty photo draft');
  return photoSongToDraft(result.output_parsed);
}
