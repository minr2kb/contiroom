import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { DisplayOptions } from '@/components/live-options-dialog';
import { queries } from '@/lib/data-api';
import { flattenConti, isDisplayOptions, moveCursor, movePageCursor, visibleLines } from '@/lib/live';
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
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1, event.metaKey || event.ctrlKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lines, options.count, overlays.settings.isOpen, overlays.hint.isOpen, overlays.fullscreen.toggle]);

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
    overlays,
  };
};
