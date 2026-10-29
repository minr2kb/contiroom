import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { range } from 'es-toolkit/math';
import { graphemes } from '@/lib/graphemes';
import type { LyricLine, Song } from '@/lib/model';
import { transposeChord } from '@/lib/music';

const ScoreLine = ({
  line,
  transposeBy,
  preferFlats,
  showTranslation,
}: {
  line: LyricLine;
  transposeBy: number;
  preferFlats?: boolean;
  showTranslation: boolean;
}) => {
  const characters = graphemes(line.text);
  const lastChord = Math.max(-1, ...line.chords.map((chord) => chord.offset));
  const slotCount = Math.max(characters.length, lastChord + 1, line.text ? 1 : 8);
  const displayChord = (value: string) =>
    transposeBy === 0 ? value : transposeChord(value, transposeBy, preferFlats ?? value.includes('b'));

  return (
    <div className="overflow-x-auto py-2">
      <HStack
        className="font-mono w-max min-w-full whitespace-pre text-xl leading-normal text-white min-[480px]:text-2xl"
        role="img"
        aria-label={`${line.chords.map((chord) => displayChord(chord.value)).join(', ')} ${line.text}`}
      >
        {range(slotCount).map((offset) => (
          <span
            key={offset}
            className={`relative inline-block shrink-0 pt-8 ${offset >= characters.length ? 'min-w-[4ch]' : ''}`}
          >
            {line.chords
              .filter((chord) => chord.offset === offset)
              .map((chord) => (
                <span
                  key={chord.id}
                  className="absolute top-0 left-0 whitespace-nowrap text-base font-semibold text-white"
                >
                  {displayChord(chord.value)}
                </span>
              ))}
            {characters[offset] === ' ' || !characters[offset] ? '\u00a0' : characters[offset]}
          </span>
        ))}
      </HStack>
      {showTranslation && line.translation?.trim() && (
        <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-neutral-300 [overflow-wrap:anywhere] min-[480px]:text-lg">
          {line.translation}
        </p>
      )}
    </div>
  );
};

type SongScoreProps = {
  song: Song;
  /** 섹션 ID 순서. 반복 ID도 그대로 렌더링한다. 생략하면 곡 원본 순서를 쓴다. */
  sectionOrder?: string[];
  /** 원곡 키에서 표시할 키까지의 반음 차이. */
  transposeBy?: number;
  /** 이조된 코드를 샵 또는 플랫으로 표시할지 결정한다. */
  preferFlats?: boolean;
};

export const SongScore = ({ song, sectionOrder, transposeBy = 0, preferFlats }: SongScoreProps) => {
  const sections = sectionOrder
    ? sectionOrder.flatMap((sectionId) => {
        const section = song.sections.find((candidate) => candidate.id === sectionId);
        return section ? [section] : [];
      })
    : song.sections;

  return (
    <article className="text-white">
      {sections.map((section, index) => (
        <section
          key={`${section.id}-${index}`}
          id={`song-section-${section.id}`}
          className="grid scroll-mt-24 py-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8"
        >
          <Heading level={2} className="mb-6 text-lg text-neutral-300 md:mb-0">
            {section.name}
          </Heading>
          <VStack gap={2} className="min-w-0">
            {section.lines.map((line) => (
              <ScoreLine
                key={line.id}
                line={line}
                transposeBy={transposeBy}
                preferFlats={preferFlats}
                showTranslation={Boolean(song.translationEnabled)}
              />
            ))}
          </VStack>
        </section>
      ))}
    </article>
  );
};
