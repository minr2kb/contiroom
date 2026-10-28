import { useCallback, useEffect, useState } from 'react';

const HINT_STORAGE_KEY = 'conti-live-hint-hidden-until';

export const useLiveOverlays = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hideHintForDay, setHideHintForDay] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setFullscreenError(false);
    };
    updateFullscreen();
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  }, []);

  useEffect(() => {
    setShowHint(Number(localStorage.getItem(HINT_STORAGE_KEY) || 0) < Date.now());
  }, []);

  const dismissHint = () => {
    if (hideHintForDay) localStorage.setItem(HINT_STORAGE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setShowHint(false);
  };

  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(dismissHint, 10000);
    return () => window.clearTimeout(timer);
  }, [showHint, hideHintForDay]);

  return {
    settings: { isOpen: settingsOpen, setOpen: setSettingsOpen },
    fullscreen: { isActive: isFullscreen, error: fullscreenError, toggle: toggleFullscreen },
    hint: { isOpen: showHint, hideForDay: hideHintForDay, setHideForDay: setHideHintForDay, dismiss: dismissHint },
  };
};
