'use client';

import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { ChevronDown, ChevronUp, Music2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CHORD_QUALITIES, CHORD_ROOTS, makeChord, parseChord } from '@/lib/music';

type ChordPickerProps = {
  targetKey?: string;
  existingChord?: string;
  selectedChord?: string;
  recentChords: string[];
  message?: string;
  onPick: (value: string) => void;
  onRemoveChord: () => void;
  onClearTarget: () => void;
  onClearSelection: () => void;
};

const ROOT_OPTIONS = [...CHORD_ROOTS];
const QUALITY_OPTIONS = CHORD_QUALITIES.map((value) => ({ value, label: value || 'Major' }));
const BASS_OPTIONS = [{ value: '', label: '없음' }, ...CHORD_ROOTS.map((value) => ({ value, label: value }))];
export const ChordPicker = ({
  targetKey,
  existingChord,
  selectedChord,
  recentChords,
  message,
  onPick,
  onRemoveChord,
  onClearTarget,
  onClearSelection,
}: ChordPickerProps) => {
  const [root, setRoot] = useState('C');
  const [quality, setQuality] = useState('');
  const [bass, setBass] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = existingChord ? parseChord(existingChord) : null;
    setRoot(parsed?.root ?? 'C');
    setQuality(parsed?.quality === 'maj7' ? 'M7' : (parsed?.quality ?? ''));
    setBass(parsed?.bass ?? '');
    if (targetKey) {
      setIsMobileOpen(true);
      const frame = requestAnimationFrame(() => panelRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    setIsMobileOpen(false);
  }, [targetKey, existingChord]);

  const choose = (value: string) => {
    const parsed = parseChord(value.trim());
    if (!parsed) return;
    const normalized = makeChord({ ...parsed, quality: parsed.quality === 'maj7' ? 'M7' : parsed.quality });
    onPick(normalized);
    setIsMobileOpen(false);
    if (!targetKey) requestAnimationFrame(() => mobileHeaderRef.current?.focus());
  };
  const generated = makeChord({ root, quality, bass });
  const isTargeted = Boolean(targetKey);
  const status = isTargeted
    ? existingChord
      ? `${existingChord} 코드 수정 중 · 옆 X로 삭제`
      : '코드를 선택하면 이 가사 위치에 들어갑니다'
    : selectedChord
      ? `${selectedChord} 선택됨 · 가사 위치를 누르세요`
      : '코드를 고른 뒤 가사 위치를 누르세요';

  return (
    <aside
      aria-label="코드 편집 도구"
      data-mobile-open={isMobileOpen}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800 bg-neutral-950 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.35)] lg:sticky lg:inset-auto lg:top-6 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:rounded-[10px] lg:border lg:shadow-none"
    >
      <div
        id="song-chord-mobile-header"
        ref={mobileHeaderRef}
        tabIndex={-1}
        className="flex items-center gap-3 p-3 lg:hidden"
      >
        <Music2 aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-300" />
        <Text as="p" className="min-w-0 flex-1 truncate text-sm font-medium">
          {status}
        </Text>
        <Button
          label={isMobileOpen ? '코드 도구 접기' : '코드 도구 펼치기'}
          isIconOnly
          icon={isMobileOpen ? <ChevronDown /> : <ChevronUp />}
          size="sm"
          variant="secondary"
          aria-expanded={isMobileOpen}
          aria-controls="song-chord-panel"
          onClick={() => setIsMobileOpen((open) => !open)}
        />
      </div>
      <section
        ref={panelRef}
        id="song-chord-panel"
        tabIndex={-1}
        aria-label="코드 편집 도구"
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            existingChord &&
            (event.key === 'Backspace' || event.key === 'Delete')
          ) {
            event.preventDefault();
            onRemoveChord();
          }
        }}
        className={`${isMobileOpen ? 'block' : 'hidden'} max-h-[min(70dvh,600px)] overflow-y-auto border-t border-neutral-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:block lg:max-h-none lg:border-t-0 lg:p-5`}
      >
        <VStack gap={5}>
          <VStack gap={2}>
            <HStack align="center" justify="between" gap={2}>
              <Text as="h2" className="text-lg font-bold">
                코드 편집
              </Text>
              {isTargeted && (
                <Button
                  label="위치 선택 취소"
                  isIconOnly
                  icon={<X />}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearTarget();
                    setIsMobileOpen(false);
                  }}
                />
              )}
            </HStack>
            <Text as="p" type="supporting" role="status" className="text-sm">
              {status}
            </Text>
            {selectedChord && !isTargeted && (
              <Button
                label="코드 선택 해제"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={onClearSelection}
              />
            )}
          </VStack>

          {recentChords.length > 0 && (
            <VStack gap={2}>
              <Text as="h3" className="text-xs font-semibold uppercase tracking-wide">
                이 곡에서 사용한 코드
              </Text>
              <HStack gap={1.5} wrap="wrap">
                {recentChords.slice(0, 10).map((value) => (
                  <Button key={value} label={value} size="sm" variant="secondary" onClick={() => choose(value)} />
                ))}
              </HStack>
            </VStack>
          )}

          <VStack gap={3}>
            <Text as="h3" className="text-xs font-semibold uppercase tracking-wide">
              코드 만들기
            </Text>
            <Grid columns={{ minWidth: 110, max: 2, repeat: 'fit' }} gap={2}>
              <Selector label="근음" options={ROOT_OPTIONS} value={root} onChange={setRoot} />
              <Selector label="종류" options={QUALITY_OPTIONS} value={quality} onChange={setQuality} />
            </Grid>
            <Selector label="베이스 음" options={BASS_OPTIONS} value={bass} onChange={setBass} />
            <Button
              label={isTargeted ? `${generated} 넣기` : `${generated} 선택`}
              variant="primary"
              onClick={() => choose(generated)}
            />
          </VStack>

          {message && (
            <Text as="p" type="supporting" role="status">
              {message}
            </Text>
          )}
        </VStack>
      </section>
    </aside>
  );
};
