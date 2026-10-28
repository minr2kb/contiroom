'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queries } from './data-api';

export type SavedSong = { songId: string; savedAt: string };

export const useSavedSongs = (enabled: boolean) =>
  useQuery({ ...queries.listSavedSongs(), enabled });

export const useSavedSongActions = () => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queries.listSavedSongs.queryKey() });

  return {
    save: async (songId: string) => {
      await api.saveSavedSong({ body: { songId } });
      await refresh();
    },
    remove: async (songId: string) => {
      await api.removeSavedSong({ path: { songId } });
      await refresh();
    },
    duplicate: (songId: string) => api.duplicateSong({ path: { id: songId } }),
  };
};
