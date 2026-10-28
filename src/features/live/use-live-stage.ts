import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DisplayOptions } from '@/components/live-options-dialog';
import { queries } from '@/lib/data-api';
import { flattenConti, isDisplayOptions, moveCursor, movePageCursor, moveSongCursor, visibleLines } from '@/lib/live';
import { getPauseImage, setPauseImage } from '@/lib/live-pause-image';
import { useLiveOverlays } from './use-live-overlays';

const DEFAULT_OPTIONS: DisplayOptions = { count: 2, showChords: false, showForm: true, showNextLyrics: false };
const OPTIONS_STORAGE_KEY = 'contiroom:live-display-options';

export const useLiveStage = (contiId: string) => {
  const [songsQuery, contisQuery] = useQueries({
    queries: [queries.listContiSongs({ path: { id: contiId } }), queries.listContis()],
  });
  const conti = contisQuery.data?.find((entry) => entry.id === contiId);
  const lines = useMemo(() => (conti ? flattenConti(conti, songsQuery.data ?? []) : []), [conti, songsQuery.data]);
  const [cursor, setCursor] = useState(0);
  const [options, setOptions] = useState<DisplayOptions>(DEFAULT_OPTIONS);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [pauseImageUrl, setPauseImageUrl] = useState<string | null>(null);
  const [pauseImageError, setPauseImageError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseFading, setPauseFading] = useState(false);
  const imageVersion = useRef(0);
  const imageWrites = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (isPaused || !pauseFading) return;
    const timer = window.setTimeout(() => setPauseFading(false), 500);
    return () => window.clearTimeout(timer);
  }, [isPaused, pauseFading]);
  const overlays = useLiveOverlays();
  const isPending = songsQuery.isPending || contisQuery.isPending;
  const isError = songsQuery.isError || contisQuery.isError;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isDisplayOptions(parsed)) setOptions(parsed);
      }
    } catch {
      // Ignore unavailable storage and malformed JSON.
    }
    setOptionsLoaded(true);
  }, []);

  useEffect(() => {
    if (!optionsLoaded) return;
    try {
      localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [options, optionsLoaded]);
  useEffect(() => {
    let active = true;
    void getPauseImage()
      .then((image) => {
        if (active && imageVersion.current === 0 && image) setPauseImageUrl(URL.createObjectURL(image));
      })
      .catch(() => {
        if (active && imageVersion.current === 0) setPauseImageError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (pauseImageUrl) URL.revokeObjectURL(pauseImageUrl);
    },
    [pauseImageUrl],
  );
  const changePauseImage = async (file: File | null) => {
    if (file && !file.type.startsWith('image/')) {
      setPauseImageError(true);
      return;
    }
    const version = ++imageVersion.current;
    imageWrites.current = imageWrites.current.catch(() => {}).then(() => setPauseImage(file));
    try {
      await imageWrites.current;
      setPauseImageUrl(file ? URL.createObjectURL(file) : null);
      if (version === imageVersion.current) setPauseImageError(false);
    } catch {
      if (version === imageVersion.current) setPauseImageError(true);
    }
  };
  const view = isError ? 'error' : isPending ? 'loading' : !conti ? 'missing-conti' : !lines.length ? 'empty' : 'ready';
  const currentCursor = Math.min(cursor, Math.max(lines.length - 1, 0));
  const current = lines[currentCursor];
  const visible = visibleLines(lines, currentCursor, options.count);
  const nextLine = lines[currentCursor + visible.length];
  const formSteps = lines.flatMap((line, index) =>
    line.itemId === current?.itemId && (index === 0 || line.formId !== lines[index - 1].formId)
      ? [{ ...line, index }]
      : [],
  );
  const songSteps = lines.flatMap((line, index) =>
    index === 0 || line.itemId !== lines[index - 1].itemId ? [{ ...line, index }] : [],
  );
  const move = (direction: -1 | 1, byForm = false) =>
    setCursor((index) =>
      byForm ? moveCursor(lines, index, direction, true) : movePageCursor(lines, index, direction, options.count),
    );
  const jumpTo = (index: number) => setCursor(index);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest('button, a, [role="button"]') ||
          target.closest('[role="combobox"]') ||
          target.closest('dialog'))
      )
        return;
      if (event.key.toLowerCase() === 'f') {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
        event.preventDefault();
        void overlays.fullscreen.toggle();
        return;
      }
      if (overlays.settings.isOpen || overlays.hint.isOpen) return;
      if (event.key === ' ' || event.code === 'Space') {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        setPauseFading(isPaused);
        setIsPaused(!isPaused);
        return;
      }
      if (isPaused || pauseFading) return;
      const bySong = event.metaKey || event.ctrlKey;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) && !(bySong && ['ArrowUp', 'ArrowDown'].includes(event.key)))
        return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      if (bySong) setCursor((index) => moveSongCursor(lines, index, direction));
      else move(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    lines,
    options.count,
    isPaused,
    pauseFading,
    overlays.settings.isOpen,
    overlays.hint.isOpen,
    overlays.fullscreen.toggle,
  ]);

  return {
    display: {
      view,
      active: { title: conti?.title || '콘티', lines, cursor: currentCursor, options },
      current,
      visible,
      nextLine,
      formSteps,
      songSteps,
      retry: () => {
        void songsQuery.refetch();
        void contisQuery.refetch();
      },
    },
    navigation: { move, jumpTo },
    changeOptions: (patch: Partial<DisplayOptions>) => setOptions((current) => ({ ...current, ...patch })),
    pause: {
      imageUrl: pauseImageUrl,
      error: pauseImageError,
      isActive: isPaused,
      isBlocking: isPaused || pauseFading,
      dismiss: () => {
        setIsPaused(false);
        setPauseFading(true);
      },
      changeImage: changePauseImage,
    },
    overlays,
  };
};
