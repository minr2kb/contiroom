import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack } from '@astryxdesign/core/VStack';
import { RotateCw } from 'lucide-react';
import { SongScore } from '@/components/song-score';
import type { SongDetailView } from '@/features/song-detail/use-song-detail';

export const SongDetailResult = ({ view, onRetry }: { view: SongDetailView; onRetry: () => void }) => {
  if (view.kind === 'loading')
    return (
      <VStack paddingBlock={10} align="center">
        <Spinner label="곡을 불러오는 중…" />
      </VStack>
    );
  if (view.kind === 'error')
    return (
      <Banner
        status="error"
        title="곡을 불러오지 못했습니다"
        endContent={<Button label="다시 시도" icon={<RotateCw aria-hidden="true" />} onClick={onRetry} />}
      />
    );
  if (view.kind === 'invalid-context')
    return (
      <EmptyState
        title="콘티 편성 정보가 올바르지 않습니다"
        description="콘티에서 곡을 다시 열어주세요."
        actions={<Button label="원곡 보기" href={`/songs/${encodeURIComponent(view.songId)}`} />}
      />
    );
  if (view.kind === 'missing-conti-item')
    return (
      <EmptyState
        title="콘티에서 곡 편성을 찾을 수 없습니다"
        actions={<Button label="콘티 보기" href={`/contis/${encodeURIComponent(view.contiId)}`} />}
      />
    );
  if (view.kind === 'missing-song')
    return <EmptyState title="곡을 찾을 수 없습니다" actions={<Button label="곡 목록" href="/songs" />} />;
  if (view.kind === 'empty-form') return <EmptyState title="이 콘티 항목에는 송폼이 없습니다" />;

  return (
    <>
      <HStack wrap="wrap" align="center" gap={2} className="mb-2">
        {(view.formSections.length
          ? view.formSections
          : view.displayedSections.map((section) => ({
              sectionId: section.id,
              name: section.name,
              count: 1,
            }))
        ).map((section, index) => (
          <a
            key={`${section.sectionId}-${index}`}
            href={`#song-section-${section.sectionId}`}
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={`${section.name} 섹션으로 이동`}
          >
            <Badge label={`${section.name}${section.count > 1 ? ` x${section.count}` : ''}`} />
          </a>
        ))}
      </HStack>
      <SongScore
        song={view.song}
        transposeBy={view.transposeBy}
        preferFlats={view.preferFlats}
      />
    </>
  );
};
