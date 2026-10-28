'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MUSIC_KEYS } from '@/lib/music';
import {
  deleteDownloadedPad,
  downloadPad,
  getDownloadedPad,
  hasDownloadedPad,
  listDownloadedPads,
  normalizePadKey,
  type PadKey,
  removeOutdatedPadCaches,
} from './pad-storage';
import { LoopAudioPlayer } from '@/lib/loop-audio-player';

export class PadAudio extends LoopAudioPlayer<PadKey> {}

type PadStatus = 'idle' | 'downloading' | 'ready';
type PadState = Record<PadKey, PadStatus>;
export type PadMode = 'auto' | PadKey;
const FADE_ENABLED_KEY = 'contiroom:pad-fade-enabled';
const FADE_SECONDS_KEY = 'contiroom:pad-fade-seconds';

type PadContextValue = {
  status: PadState;
  progress: Partial<Record<PadKey, number>>;
  activeKey: PadKey | null;
  lastKey: PadKey | null;
  playing: boolean;
  mode: PadMode;
  volume: number;
  fadeEnabled: boolean;
  fadeSeconds: number;
  error: string | null;
  download: (key: string) => Promise<void>;
  cancelDownload: (key: string) => void;
  deleteDownload: (key: string) => Promise<void>;
  play: (key: string) => Promise<void>;
  stop: () => void;
  setMode: (mode: PadMode) => void;
  setVolume: (value: number) => void;
  setFadeEnabled: (enabled: boolean) => void;
  setFadeSeconds: (seconds: number) => void;
};

export const PadContext = createContext<PadContextValue | null>(null);
const initialStatus = Object.fromEntries(MUSIC_KEYS.map((key) => [key, 'idle'])) as PadState;

export const PadProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<PadState>(initialStatus);
  const [progress, setProgress] = useState<Partial<Record<PadKey, number>>>({});
  const [activeKey, setActiveKey] = useState<PadKey | null>(null);
  const [lastKey, setLastKey] = useState<PadKey | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PadMode>('auto');
  const [volume, setVolumeState] = useState(0.25);
  const [fadeEnabled, setFadeEnabledState] = useState(true);
  const [fadeSeconds, setFadeSecondsState] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<PadAudio | null>(null);
  const downloads = useRef(new Map<PadKey, { controller: AbortController; promise: Promise<void> }>());
  const touched = useRef(new Set<PadKey>());
  const playSequence = useRef(0);
  const pendingKey = useRef<PadKey | null>(null);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem(FADE_ENABLED_KEY) !== 'false';
      const storedSeconds = localStorage.getItem(FADE_SECONDS_KEY);
      const seconds = storedSeconds === null ? 2 : Number(storedSeconds);
      const validSeconds = Number.isFinite(seconds) && seconds >= 0.1 && seconds <= 30 ? seconds : 2;
      setFadeEnabledState(enabled);
      setFadeSecondsState(validSeconds);
      audio.current?.setFadeSeconds(enabled ? validSeconds : 0);
    } catch {
      // Keep defaults when local storage is unavailable.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await removeOutdatedPadCaches();
        const keys = await listDownloadedPads();
        if (mounted)
          setStatus(
            (current) =>
              Object.fromEntries(
                MUSIC_KEYS.map((key) => [
                  key,
                  touched.current.has(key) ? current[key] : keys.includes(key) ? 'ready' : 'idle',
                ]),
              ) as PadState,
          );
      } catch {
        if (mounted) setError('브라우저에 패드를 저장할 수 없습니다.');
      }
    })();
    return () => {
      mounted = false;
      for (const { controller } of downloads.current.values()) controller.abort();
      audio.current?.dispose();
    };
  }, []);

  const download = (value: string): Promise<void> => {
    const key = normalizePadKey(value);
    if (!key) return Promise.reject(new Error('지원하지 않는 키입니다.'));
    if (status[key] === 'ready') return Promise.resolve();
    const inFlight = downloads.current.get(key);
    if (inFlight) return inFlight.promise;

    touched.current.add(key);
    const controller = new AbortController();
    setStatus((current) => ({ ...current, [key]: 'downloading' }));
    setProgress((current) => ({ ...current, [key]: 0 }));
    setError(null);
    const promise = (async () => {
      if (await hasDownloadedPad(key)) return;
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      if (controller.signal.aborted) throw new DOMException('다운로드가 취소되었습니다.', 'AbortError');
      await downloadPad(key, controller.signal, (fraction) => {
        setProgress((current) => ({ ...current, [key]: fraction }));
      });
    })()
      .then(() => {
        setStatus((current) => ({ ...current, [key]: 'ready' }));
      })
      .catch((cause: unknown) => {
        setStatus((current) => ({ ...current, [key]: 'idle' }));
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(cause instanceof Error ? cause.message : '패드를 저장하지 못했습니다.');
        }
        throw cause;
      })
      .finally(() => {
        downloads.current.delete(key);
        setProgress((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      });
    downloads.current.set(key, { controller, promise });
    return promise;
  };

  const cancelDownload = (value: string) => {
    const key = normalizePadKey(value);
    if (key) downloads.current.get(key)?.controller.abort();
  };

  const stop = () => {
    ++playSequence.current;
    pendingKey.current = null;
    audio.current?.stop();
    setPlaying(false);
    setActiveKey(null);
  };

  const deleteDownload = async (value: string) => {
    const key = normalizePadKey(value);
    if (!key) throw new Error('지원하지 않는 키입니다.');
    try {
      const inFlight = downloads.current.get(key);
      if (inFlight) {
        inFlight.controller.abort();
        await inFlight.promise.catch(() => undefined);
      }
      if (activeKey === key || pendingKey.current === key) stop();
      await deleteDownloadedPad(key);
      touched.current.add(key);
      setStatus((current) => ({ ...current, [key]: 'idle' }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '패드를 삭제하지 못했습니다.');
      throw cause;
    }
  };

  const play = async (value: string) => {
    const key = normalizePadKey(value);
    if (!key) throw new Error('지원하지 않는 키입니다.');
    if (activeKey === key && playing) return;
    const sequence = ++playSequence.current;
    pendingKey.current = key;
    try {
      // Resume on the click/shortcut before reading the large cached file.
      audio.current ??= new PadAudio(volume, fadeEnabled ? fadeSeconds : 0);
      const [blob] = await Promise.all([getDownloadedPad(key), audio.current.resume()]);
      if (sequence !== playSequence.current) return;
      if (!blob) {
        touched.current.add(key);
        setStatus((current) => ({ ...current, [key]: 'idle' }));
        throw new Error(`${key} 패드를 먼저 다운로드해 주세요.`);
      }
      if (await audio.current.play(key, blob)) {
        if (sequence !== playSequence.current) return;
        setActiveKey(key);
        setLastKey(key);
        setPlaying(true);
        setError(null);
      }
    } catch (cause) {
      if (sequence === playSequence.current)
        setError(cause instanceof Error ? cause.message : '패드를 재생하지 못했습니다.');
      throw cause;
    } finally {
      if (sequence === playSequence.current) pendingKey.current = null;
    }
  };

  const setVolume = (value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setVolumeState(next);
    audio.current?.setVolume(next);
  };

  const setFadeEnabled = (enabled: boolean) => {
    setFadeEnabledState(enabled);
    audio.current?.setFadeSeconds(enabled ? fadeSeconds : 0);
    try {
      localStorage.setItem(FADE_ENABLED_KEY, String(enabled));
    } catch {
      // Keep the setting for this page session.
    }
  };

  const setFadeSeconds = (value: number) => {
    if (!Number.isFinite(value)) return;
    const seconds = Math.min(30, Math.max(0.1, value));
    setFadeSecondsState(seconds);
    audio.current?.setFadeSeconds(fadeEnabled ? seconds : 0);
    try {
      localStorage.setItem(FADE_SECONDS_KEY, String(seconds));
    } catch {
      // Keep the setting for this page session.
    }
  };

  return (
    <PadContext.Provider
      value={{
        status,
        progress,
        activeKey,
        lastKey,
        playing,
        mode,
        volume,
        fadeEnabled,
        fadeSeconds,
        error,
        download,
        cancelDownload,
        deleteDownload,
        play,
        stop,
        setMode,
        setVolume,
        setFadeEnabled,
        setFadeSeconds,
      }}
    >
      {children}
    </PadContext.Provider>
  );
};

export const usePads = (): PadContextValue => {
  const context = useContext(PadContext);
  if (!context) throw new Error('PadProvider가 필요합니다.');
  return context;
};
