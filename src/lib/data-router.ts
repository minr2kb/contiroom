import { defineRouter, endpoint } from '@routar/core';
import { z } from 'zod';
import { isYouTubePlaylistUrl } from './youtube-playlist.ts';

const chord = z.object({ id: z.string(), offset: z.number().int().nonnegative(), value: z.string().min(1) });
const line = z.object({ id: z.string(), text: z.string(), translation: z.string().optional(), chords: z.array(chord) });
const section = z.object({ id: z.string(), name: z.string().min(1), lines: z.array(line) });
const visibility = z.enum(['private', 'public']);

export const songSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  baseKey: z.string().min(1),
  translationEnabled: z.boolean().optional(),
  bpm: z.number().positive().optional(),
  sections: z.array(section),
  visibility: visibility.optional(),
  ownerId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  creatorHandle: z.string().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  originSongId: z.string().optional(),
  originAvailable: z.boolean().optional(),
  artist: z.string().optional(),
});

const step = z.object({ id: z.string(), sectionId: z.string() });
const item = z.object({
  id: z.string(),
  songId: z.string(),
  key: z.string().optional(),
  bpm: z.number().positive().optional(),
  form: z.array(step),
});
export const contiSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  scheduledDate: z.iso.date().optional(),
  youtubePlaylistUrl: z
    .string()
    .url()
    .refine(isYouTubePlaylistUrl, '유튜브 플레이리스트 주소를 입력하세요.')
    .optional(),
  items: z.array(item),
  visibility: visibility.optional(),
  ownerId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  creatorHandle: z.string().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
});

export const savedSongSchema = z.object({
  songId: z.string(),
  savedAt: z.iso.datetime({ offset: true }),
});

export const router = defineRouter('', {
  listSongs: endpoint({ method: 'GET', path: '/songs', response: z.array(songSchema) }),
  saveSong: endpoint({
    method: 'PUT',
    path: '/songs',
    request: { body: songSchema },
    response: songSchema,
  }),
  deleteSong: endpoint({
    method: 'DELETE',
    path: '/songs/:id',
    request: { path: z.object({ id: z.string() }) },
    response: z.object({ id: z.string() }),
  }),
  listContis: endpoint({ method: 'GET', path: '/contis', response: z.array(contiSchema) }),
  listContiSongs: endpoint({
    method: 'GET',
    path: '/contis/:id/songs',
    request: { path: z.object({ id: z.string() }) },
    response: z.array(songSchema),
  }),
  saveConti: endpoint({
    method: 'PUT',
    path: '/contis',
    request: { body: contiSchema },
    response: contiSchema,
  }),
  deleteConti: endpoint({
    method: 'DELETE',
    path: '/contis/:id',
    request: { path: z.object({ id: z.string() }) },
    response: z.object({ id: z.string() }),
  }),
  listSavedSongs: endpoint({ method: 'GET', path: '/saved-songs', response: z.array(savedSongSchema) }),
  saveSavedSong: endpoint({
    method: 'POST',
    path: '/saved-songs',
    request: { body: z.object({ songId: z.string() }) },
    response: savedSongSchema,
  }),
  removeSavedSong: endpoint({
    method: 'DELETE',
    path: '/saved-songs/:songId',
    request: { path: z.object({ songId: z.string() }) },
    response: z.object({ songId: z.string() }),
  }),
  duplicateSong: endpoint({
    method: 'POST',
    path: '/songs/:id/duplicate',
    request: { path: z.object({ id: z.string() }) },
    response: songSchema,
  }),
});
