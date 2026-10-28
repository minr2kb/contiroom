'use client';

import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { ArrowLeft, Maximize, Minimize, Settings2, SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LiveIntroDialog } from '@/components/live-intro-dialog';
import { LiveOptionsDialog } from '@/components/live-options-dialog';
import { LiveFormNavigation, LiveStageBody, LiveStageStatus } from '@/components/live-stage-sections';
import { useLiveStage } from '@/features/live/use-live-stage';
import { usePads } from '@/features/pads/pad-provider';
import { normalizePadKey } from '@/features/pads/pad-storage';
import { useUtility } from '@/features/pads/utility-provider';

type Stage = ReturnType<typeof useLiveStage>;

const LiveStageHeader = ({
  title,
  fullscreen,
  openSettings,
  openUtility,
}: {
  title: string;
  fullscreen: Stage['overlays']['fullscreen'];
  openSettings: () => void;
  openUtility: () => void;
}) => (
  <HStack
    as="header"
    wrap="wrap"
    align="center"
    justify="between"
    gap={5}
    className="fixed inset-x-0 top-0 z-30 bg-neutral-950/90 px-[clamp(20px,4vw,72px)] py-5 opacity-0 backdrop-blur-sm transition-opacity hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
  >
    <HStack wrap="wrap" align="center" gap={4}>
      <Link
        href="/contis"
        color="secondary"
        isStandalone
        className="rounded-sm text-neutral-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowLeft aria-hidden="true" className="mr-1 inline-block h-4 w-4 align-[-2px]" /> 콘티 목록
      </Link>
      <Heading level={1} className="text-2xl tracking-tight">
        {title}
      </Heading>
    </HStack>
    <HStack align="center" gap={2}>
      <Button
        label="유틸리티"
        isIconOnly
        icon={<SlidersHorizontal aria-hidden="true" className="h-4 w-4" />}
        variant="secondary"
        size="sm"
        onClick={openUtility}
      />
      {fullscreen.error && <Text role="alert">전체화면을 열 수 없습니다.</Text>}
      <Button
        label={fullscreen.isActive ? '전체화면 종료 (F)' : '전체화면 (F)'}
        icon={
          fullscreen.isActive ? (
            <Minimize aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Maximize aria-hidden="true" className="h-4 w-4" />
          )
        }
        variant="secondary"
        size="sm"
        aria-pressed={fullscreen.isActive}
        aria-keyshortcuts="F"
        onClick={() => void fullscreen.toggle()}
      />
      <Button
        label="화면 설정"
        icon={<Settings2 aria-hidden="true" className="h-4 w-4" />}
        variant="secondary"
        size="sm"
        onClick={openSettings}
      />
    </HStack>
  </HStack>
);

const LivePage = () => {
  const { id: contiId } = useParams<{ id: string }>();
  const stage = useLiveStage(contiId);
  const { display, navigation, overlays } = stage;
  const pads = usePads();
  const utility = useUtility();
  const currentKey = display.view === 'ready' ? normalizePadKey(display.current?.key ?? '') : null;
  const currentItemId = display.view === 'ready' ? (display.current?.itemId ?? null) : null;
  const lastItem = useRef<string | null>(null);

  useEffect(() => {
    utility.setContext({
      key: display.view === 'ready' ? (display.current?.key ?? null) : null,
      itemId: currentItemId ?? undefined,
      neededKeys: [...new Set(display.active.lines.map((line) => line.key))],
    });
  }, [display.view, display.current?.key, currentItemId, display.active.lines, utility.setContext]);
  useEffect(() => () => utility.setContext(null), [utility.setContext]);

  useEffect(() => {
    if (display.view !== 'ready') return;
    const item = currentItemId ? `${currentItemId}:${currentKey ?? ''}` : null;
    if (lastItem.current === item) return;
    lastItem.current = item;
    if (!pads.playing || pads.mode !== 'auto') return;
    if (currentKey && pads.status[currentKey] === 'ready') {
      void pads.play(currentKey).catch(() => {
        if (lastItem.current === item) pads.stop();
      });
    } else {
      pads.stop();
    }
  }, [display.view, currentItemId, currentKey, pads.playing, pads.mode, pads.status, pads.play, pads.stop]);

  return (
    <VStack as="main" minHeight="100dvh" className="bg-black text-white">
      <LiveStageHeader
        title={display.active.title}
        fullscreen={overlays.fullscreen}
        openSettings={() => overlays.settings.setOpen(true)}
        openUtility={() => utility.setOpen(true)}
      />
      <LiveStageBody
        view={display.view}
        lyrics={{
          visible: display.visible,
          nextLine: display.nextLine,
          showChords: display.active.options.showChords,
          showNextLyrics: display.active.options.showNextLyrics,
        }}
        onRetry={display.retry}
        canMove={!overlays.settings.isOpen && !overlays.hint.isOpen}
        move={navigation.move}
      />
      {display.view === 'ready' && (
        <VStack
          as="footer"
          gap={3}
          className="fixed right-0 bottom-0 left-0 z-20 px-[clamp(20px,4vw,72px)] py-5 text-base text-neutral-400"
        >
          <LiveFormNavigation
            showForm={display.active.options.showForm}
            formSteps={display.formSteps}
            currentFormId={display.current?.formId}
            jumpTo={navigation.jumpTo}
          />
          <LiveStageStatus
            songSteps={display.songSteps}
            currentItemId={display.current?.itemId}
            jumpTo={navigation.jumpTo}
            page={display.active.cursor + 1}
            pageCount={display.active.lines.length}
          />
        </VStack>
      )}
      <LiveOptionsDialog
        isOpen={overlays.settings.isOpen}
        onOpenChange={overlays.settings.setOpen}
        options={display.active.options}
        onChange={stage.changeOptions}
      />
      <LiveIntroDialog
        isOpen={overlays.hint.isOpen}
        onOpenChange={(open) => {
          if (!open) overlays.hint.dismiss();
        }}
        hideForDay={overlays.hint.hideForDay}
        onHideForDayChange={overlays.hint.setHideForDay}
      />
    </VStack>
  );
};

export default LivePage;
