'use client';

import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Button } from '@astryxdesign/core/Button';
import { Drawer } from '@astryxdesign/core/Drawer';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Slider } from '@astryxdesign/core/Slider';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Download, Play, SlidersHorizontal, Square, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePads } from '@/features/pads/pad-provider';
import { normalizePadKey, type PadKey } from '@/features/pads/pad-storage';
import { useUtility } from '@/features/pads/utility-provider';
import { MUSIC_KEYS } from '@/lib/music';

const MINI_STORAGE_KEY = 'contiroom:pad-mini-visible';
const DownloadProgress = ({ padKey, value, onCancel }: { padKey: PadKey; value: number; onCancel: () => void }) => {
  const percent = Math.round(value);
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <span className="group relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
      <span
        role="progressbar"
        aria-label={`${padKey} 패드 다운로드`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="absolute inset-0 flex items-center justify-center"
      >
        <svg viewBox="0 0 36 36" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-neutral-700"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${percent} 100`}
            pathLength="100"
            className="text-purple-400"
          />
        </svg>
        <span
          aria-hidden="true"
          className={`text-[9px] leading-none font-semibold tabular-nums ${confirmCancel ? 'opacity-0' : '[@media(hover:hover)]:group-hover:opacity-0 group-focus-within:opacity-0'}`}
        >
          {percent}%
        </span>
      </span>
      <button
        type="button"
        aria-label={`${padKey} 패드 다운로드 취소 (터치에서는 두 번 탭)`}
        onBlur={() => setConfirmCancel(false)}
        onClick={() => {
          if (window.matchMedia('(hover: none)').matches && !confirmCancel) {
            setConfirmCancel(true);
            return;
          }
          onCancel();
        }}
        className="absolute inset-0 flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-purple-400"
      >
        <X
          aria-hidden="true"
          className={`h-4 w-4 ${confirmCancel ? '' : 'opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100'}`}
        />
      </button>
    </span>
  );
};

const PadControls = ({
  close,
  selectedKey,
  selectKey,
}: {
  close: () => void;
  selectedKey: PadKey | null;
  selectKey: (key: PadKey) => void;
}) => {
  const { context } = useUtility();
  const pads = usePads();
  const currentKey = normalizePadKey(context?.key ?? '');
  const padKey = selectedKey ?? (pads.mode === 'auto' ? currentKey : pads.mode);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const neededKeys = new Set((context?.neededKeys ?? []).map(normalizePadKey).filter((key) => key !== null));
  const downloadedCount = MUSIC_KEYS.filter((key) => pads.status[key] === 'ready').length;
  const neededCount = [...neededKeys].filter((key) => pads.status[key] === 'ready').length;
  const downloadNeeded = async () => {
    setBulkDownloading(true);
    try {
      for (const key of neededKeys) {
        if (pads.status[key] !== 'ready') await pads.download(key);
      }
    } catch {
      // The pad provider displays the failed key's error.
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">유틸리티</h2>
          <Text color="secondary">워십 패드</Text>
        </div>
        <Button label="닫기" icon={<X aria-hidden="true" />} isIconOnly variant="ghost" onClick={close} />
      </div>

      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
        <Text color="secondary">현재 키</Text>

        <HStack align="center" gap={2} justify="between">
          <p className="text-2xl font-semibold">{padKey ?? '키 선택'}</p>

          <div>
            {padKey && pads.status[padKey] !== 'ready' && pads.status[padKey] !== 'downloading' && !pads.playing && (
              <Button
                label="다운로드"
                tooltip="다운로드"
                icon={<Download aria-hidden="true" />}
                isIconOnly
                variant="ghost"
                onClick={() => void pads.download(padKey).catch(() => undefined)}
              />
            )}
            {padKey && pads.status[padKey] === 'downloading' && (
              <DownloadProgress
                padKey={padKey}
                value={pads.progress[padKey] ?? 0}
                onCancel={() => pads.cancelDownload(padKey)}
              />
            )}
            {padKey && pads.status[padKey] === 'ready' && (!pads.playing || pads.activeKey !== padKey) && (
              <Button
                label={'재생'}
                isIconOnly
                icon={<Play aria-hidden="true" />}
                variant="ghost"
                onClick={() => {
                  if (selectedKey) pads.setMode(selectedKey);
                  void pads.play(padKey).catch(() => undefined);
                }}
              />
            )}
            {pads.playing && (
              <Button
                label="재생 종료"
                icon={<Square aria-hidden="true" />}
                isIconOnly
                variant="ghost"
                onClick={pads.stop}
              />
            )}
          </div>
        </HStack>

        <div className="mt-4">
          <Slider
            label="음량"
            value={pads.volume * 100}
            onChange={(value: number) => pads.setVolume(value / 100)}
            formatValue={(value) => `${value}%`}
            valueDisplay="text"
            width="100%"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_112px] items-end gap-3">
        <Switch
          label="페이드"
          value={pads.fadeEnabled}
          onChange={pads.setFadeEnabled}
          labelPosition="start"
          labelSpacing="spread"
          width="100%"
          size="sm"
        />
        <NumberInput
          label="시간"
          value={pads.fadeSeconds}
          onChange={pads.setFadeSeconds}
          min={0.1}
          max={30}
          step={0.1}
          units="초"
          isDisabled={!pads.fadeEnabled}
          size="sm"
        />
      </div>

      {context?.neededKeys && (
        <div className="flex items-center justify-between gap-2">
          <Text color="secondary">
            이 콘티에서 필요한 패드 {neededCount}/{neededKeys.size}개 다운로드됨
          </Text>
          {neededCount < neededKeys.size && (
            <Button
              label="콘티 키 일괄 다운로드"
              tooltip="콘티 키 일괄 다운로드"
              icon={<Download aria-hidden="true" />}
              isIconOnly
              size="sm"
              variant="ghost"
              isDisabled={bulkDownloading}
              onClick={() => void downloadNeeded()}
            />
          )}
        </div>
      )}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">키별 패드</h3>
          <Text color="secondary">{downloadedCount}/12개 · 키당 약 36MB</Text>
        </div>
        <List density="compact" hasDividers aria-label="키별 패드" className="rounded-xl border border-neutral-800">
          {MUSIC_KEYS.map((key) => {
            const status = pads.status[key];
            return (
              <ListItem
                key={key}
                label={
                  <span className="font-semibold">
                    {key}
                    {neededKeys.has(key) && <span className="ml-2 text-xs font-normal text-purple-300">콘티 사용</span>}
                  </span>
                }
                description={status === 'ready' ? '다운로드됨' : status === 'downloading' ? '다운로드 중' : '약 36MB'}
                onClick={() => selectKey(key)}
                isSelected={padKey === key}
                endContent={
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {status === 'ready' ? (
                      <Button
                        label={`${key} 패드 삭제`}
                        tooltip="패드 삭제"
                        icon={<Trash2 aria-hidden="true" />}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onClick={() => void pads.deleteDownload(key).catch(() => undefined)}
                      />
                    ) : status === 'downloading' ? (
                      <DownloadProgress
                        padKey={key}
                        value={pads.progress[key] ?? 0}
                        onCancel={() => pads.cancelDownload(key)}
                      />
                    ) : (
                      <Button
                        label={`${key} 다운로드`}
                        tooltip="다운로드"
                        icon={<Download aria-hidden="true" />}
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        onClick={() => void pads.download(key).catch(() => undefined)}
                      />
                    )}
                  </span>
                }
              />
            );
          })}
        </List>
      </div>
      {pads.error && (
        <p role="alert" className="text-sm text-red-300">
          {pads.error}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        다운로드한 파일은 이 브라우저에 저장됩니다. 브라우저 저장 공간을 지우면 다시 받아야 합니다.
      </p>
    </div>
  );
};

export const PadUtilityPanel = () => {
  const { isOpen, setOpen, context } = useUtility();
  const pads = usePads();
  const [desktop, setDesktop] = useState(false);
  const [selectedKey, setSelectedKey] = useState<PadKey | null>(null);
  const [miniVisible, setMiniVisible] = useState(false);
  const [miniExpanded, setMiniExpanded] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const touchOpening = useRef(false);
  const wasPlaying = useRef(false);
  const fadeUntil = useRef(0);
  const currentKey = normalizePadKey(context?.key ?? '');
  const miniKey =
    pads.activeKey ?? (fadingOut ? pads.lastKey : pads.mode === 'auto' ? (currentKey ?? pads.lastKey) : pads.mode);

  useEffect(() => setSelectedKey(null), [currentKey, pads.mode]);

  useEffect(() => {
    try {
      setMiniVisible(localStorage.getItem(MINI_STORAGE_KEY) === 'true');
    } catch {
      // Private browsing can disable local storage.
    }
  }, []);

  useEffect(() => {
    if (!pads.playing) return;
    setMiniVisible(true);
    try {
      localStorage.setItem(MINI_STORAGE_KEY, 'true');
    } catch {
      // The player remains visible for this page session.
    }
  }, [pads.playing]);

  useEffect(() => {
    if (pads.playing || !pads.fadeEnabled) fadeUntil.current = 0;
    else if (wasPlaying.current) fadeUntil.current = Date.now() + pads.fadeSeconds * 1000;
    wasPlaying.current = pads.playing;
    const remaining = fadeUntil.current - Date.now();
    setFadingOut(remaining > 0);
    if (remaining > 0) {
      const timer = window.setTimeout(() => {
        fadeUntil.current = 0;
        setFadingOut(false);
      }, remaining);
      return () => window.clearTimeout(timer);
    }
  }, [pads.playing, pads.fadeEnabled, pads.fadeSeconds]);

  const playMode = (value: string) => {
    const mode = value === 'auto' ? 'auto' : normalizePadKey(value);
    if (!mode || (mode === 'auto' && !currentKey)) return;
    pads.setMode(mode);
    const key = mode === 'auto' ? currentKey : mode;
    if (key && pads.status[key] === 'ready') {
      void pads.play(key).catch(() => setOpen(true));
    } else {
      pads.stop();
      if (key) setOpen(true);
    }
  };

  const toggleMiniPlayback = useCallback(() => {
    if (pads.playing) {
      pads.stop();
      return;
    }
    const key = isOpen && selectedKey ? selectedKey : pads.mode === 'auto' ? (currentKey ?? pads.lastKey) : pads.mode;
    if (key && pads.status[key] === 'ready') {
      if (isOpen && selectedKey) pads.setMode(selectedKey);
      void pads.play(key).catch(() => setOpen(true));
    } else setOpen(true);
  }, [
    pads.playing,
    pads.stop,
    pads.mode,
    pads.lastKey,
    pads.status,
    pads.play,
    pads.setMode,
    currentKey,
    isOpen,
    selectedKey,
    setOpen,
  ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'p' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)
      )
        return;
      event.preventDefault();
      toggleMiniPlayback();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, toggleMiniPlayback]);

  const closeMini = () => {
    pads.stop();
    setMiniVisible(false);
    setMiniExpanded(false);
    try {
      localStorage.removeItem(MINI_STORAGE_KEY);
    } catch {
      // The player still closes for this page session.
    }
  };

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const content = <PadControls close={() => setOpen(false)} selectedKey={selectedKey} selectKey={setSelectedKey} />;
  return (
    <>
      {desktop ? (
        <Drawer isOpen={isOpen} onOpenChange={setOpen} label="유틸리티" width={420}>
          {content}
        </Drawer>
      ) : (
        <BottomSheet isOpen={isOpen} onOpenChange={setOpen} label="유틸리티" height="tall">
          {content}
        </BottomSheet>
      )}
      {miniVisible && !isOpen && (
        <div
          role="toolbar"
          aria-label="패드 플레이어"
          className="fixed right-10 bottom-10 z-40 opacity-30 hover:opacity-100 transition-opacity duration-200"
          onMouseEnter={() => {
            if (window.matchMedia('(hover: hover)').matches) setMiniExpanded(true);
          }}
          onMouseLeave={() => {
            if (window.matchMedia('(hover: hover)').matches) setMiniExpanded(false);
          }}
          onFocus={() => setMiniExpanded(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMiniExpanded(false);
          }}
        >
          <span className="relative flex size-12 items-center justify-center">
            {(pads.playing || fadingOut) && (
              <span
                className={`pointer-events-none absolute -inset-1 rounded-full blur-lg ${pads.playing ? 'bg-violet-400/25' : 'bg-violet-400/10'}`}
              />
            )}
            {pads.playing && (
              <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border border-violet-300/30" />
            )}
            <button
              type="button"
              aria-label={`${miniKey ?? '패드'} ${pads.playing ? '재생 종료' : fadingOut ? '페이드아웃 중, 다시 재생' : '재생'}`}
              aria-pressed={pads.playing}
              onPointerDown={(event) => {
                touchOpening.current = event.pointerType === 'touch' && !miniExpanded;
              }}
              onClick={() => {
                if (touchOpening.current) {
                  touchOpening.current = false;
                  setMiniExpanded(true);
                  return;
                }
                toggleMiniPlayback();
              }}
              className={`relative z-10 flex size-12 items-center justify-center rounded-full border text-sm font-semibold shadow-lg backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-violet-300 ${pads.playing ? 'border-violet-300/50 bg-violet-950/50 text-violet-100 hover:bg-violet-900' : fadingOut ? 'border-violet-300/35 bg-violet-950/60 text-violet-200/80 hover:bg-violet-900/70' : 'border-white/30 bg-neutral-900/70 text-neutral-200 hover:bg-neutral-800'}`}
            >
              {miniKey ?? '♪'}
            </button>
          </span>
          <div
            inert={!miniExpanded}
            aria-hidden={!miniExpanded}
            className={`absolute right-0 bottom-full w-44 origin-bottom-right pb-2 transition-[opacity,transform] duration-200 ease-out ${miniExpanded ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'}`}
          >
            <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto rounded-2xl border border-white/15 bg-neutral-900/95 p-2 text-white shadow-xl backdrop-blur-md">
              <button
                type="button"
                title={currentKey ? `자동 (${currentKey} key)` : '연주할 키가 없습니다'}
                disabled={!currentKey}
                aria-pressed={pads.mode === 'auto'}
                onClick={() => playMode('auto')}
                className={`mb-1 h-9 w-full rounded-lg px-2 text-left text-sm transition-colors disabled:opacity-35 ${pads.mode === 'auto' ? 'bg-purple-400/25 text-purple-100' : 'text-neutral-300 hover:bg-white/10'}`}
              >
                자동{currentKey ? ` (${currentKey} key)` : ''}
              </button>
              <div className="grid grid-cols-2 gap-1">
                {MUSIC_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={`${key} key`}
                    aria-pressed={pads.mode === key}
                    onClick={() => playMode(key)}
                    className={`h-8 rounded-lg text-sm transition-colors ${pads.mode === key ? 'bg-purple-400/25 text-purple-100' : 'text-neutral-300 hover:bg-white/10'}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t border-white/10 pt-1">
                <Button
                  label="유틸리티 열기"
                  icon={<SlidersHorizontal aria-hidden="true" />}
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMiniExpanded(false);
                    setOpen(true);
                  }}
                />
                <Button
                  label="미니 플레이어 닫기"
                  icon={<X aria-hidden="true" />}
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onClick={closeMini}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
