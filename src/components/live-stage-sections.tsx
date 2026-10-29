import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { RotateCw } from 'lucide-react';
import { Lyrics } from '@/components/live/lyrics';
import type { useLiveStage } from '@/features/live/use-live-stage';

type Stage = ReturnType<typeof useLiveStage>;
type Display = Stage['display'];

type LyricsView = {
  visible: Display['visible'];
  nextLine: Display['nextLine'];
  showChords: boolean;
  showNextLyrics: boolean;
  showTranslations: boolean;
};

type BodyProps = {
  view: Display['view'];
  lyrics: LyricsView;
  onRetry: Display['retry'];
  canMove: boolean;
  move: Stage['navigation']['move'];
};

const LiveStageView = ({ view, lyrics, onRetry }: Pick<BodyProps, 'view' | 'lyrics' | 'onRetry'>) => {
  switch (view) {
    case 'loading':
      return <Spinner shade="onMedia" label="라이브 화면을 불러오는 중…" />;
    case 'error':
      return (
        <Banner
          status="error"
          title="라이브 콘티를 불러오지 못했습니다"
          endContent={<Button label="다시 시도" icon={<RotateCw aria-hidden="true" />} onClick={onRetry} />}
        />
      );
    case 'missing-conti':
      return <EmptyState title="콘티를 찾을 수 없습니다" actions={<Button label="콘티 목록" href="/contis" />} />;
    case 'empty':
      return <Text color="secondary">표시할 가사가 없습니다. 콘티에 곡과 송폼을 추가하세요.</Text>;
    case 'ready':
      return (
        <>
          <VStack gap={8}>
            {lyrics.visible.map((entry, index) => (
              <Lyrics
                key={`${entry.formId}-${entry.line.id}-${index}`}
                line={entry.line}
                showChords={lyrics.showChords}
                showTranslations={lyrics.showTranslations}
              />
            ))}
          </VStack>
          {lyrics.showNextLyrics && lyrics.nextLine && (
            <VStack className="mt-12 border-t border-neutral-800 pt-5 text-neutral-500">
              <Text color="inherit">다음 가사 · {lyrics.nextLine.sectionName}</Text>
              <Text color="inherit" className="mt-2 text-[clamp(20px,2.4vw,64px)]">
                {lyrics.nextLine.line.text}
              </Text>
              {lyrics.showTranslations && lyrics.nextLine.line.translation?.trim() && (
                <Text color="inherit" className="text-[clamp(16px,1.8vw,44px)]">
                  {lyrics.nextLine.line.translation}
                </Text>
              )}
            </VStack>
          )}
        </>
      );
  }
};

export const LiveStageBody = ({ view, lyrics, onRetry, canMove, move }: BodyProps) => {
  return (
    <VStack justify="center" className="relative m-auto w-full flex-1 py-12">
      <VStack className="mx-auto w-full max-w-[clamp(1300px,85vw,2600px)] px-[clamp(20px,5vw,80px)]">
        <LiveStageView view={view} lyrics={lyrics} onRetry={onRetry} />
      </VStack>
      {view === 'ready' && canMove && (
        <>
          <button
            type="button"
            aria-label="이전 가사 화면"
            className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer bg-transparent focus-visible:outline-none"
            onClick={() => move(-1)}
          />
          <button
            type="button"
            aria-label="다음 가사 화면"
            className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer bg-transparent focus-visible:outline-none"
            onClick={() => move(1)}
          />
        </>
      )}
    </VStack>
  );
};

type FormNavigationProps = {
  showForm: boolean;
  formSteps: Display['formSteps'];
  currentFormId?: string;
  jumpTo: Stage['navigation']['jumpTo'];
};

export const LiveFormNavigation = ({ showForm, formSteps, currentFormId, jumpTo }: FormNavigationProps) => {
  if (!showForm || formSteps.length === 0) return null;
  return (
    <nav
      aria-label="송폼 빠른 이동"
      className="w-fit overflow-x-auto pb-1 opacity-60 transition-opacity hover:opacity-90 focus-within:opacity-90"
    >
      <div className="flex w-fit items-center gap-2">
        {formSteps.map((step) => (
          <Badge
            key={step.formId}
            label={step.sectionName}
            variant={currentFormId === step.formId ? 'purple' : 'neutral'}
            aria-current={currentFormId === step.formId ? 'step' : undefined}
            role="button"
            tabIndex={0}
            onClick={() => jumpTo(step.index)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              jumpTo(step.index);
            }}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          />
        ))}
      </div>
    </nav>
  );
};

type StatusProps = {
  songSteps: Display['songSteps'];
  currentItemId?: string;
  jumpTo: Stage['navigation']['jumpTo'];
  page: number;
  pageCount: number;
};

export const LiveStageStatus = ({ songSteps, currentItemId, jumpTo, page, pageCount }: StatusProps) => (
  <HStack wrap="wrap" justify="between" gap={4} width="100%">
    <Selector
      label="곡 이동"
      isLabelHidden
      variant="ghost"
      size="sm"
      placement="above"
      options={songSteps.map((step, index) => ({ label: `${index + 1}. ${step.songTitle}`, value: step.itemId }))}
      value={currentItemId}
      onChange={(itemId) => {
        const step = songSteps.find((entry) => entry.itemId === itemId);
        if (step) jumpTo(step.index);
      }}
    />
    <Text>{`${page} / ${pageCount}`}</Text>
  </HStack>
);
