import { contiSchema, songSchema } from './data-router.ts';

export const songColumns =
  'id,title,base_key,bpm,sections,translation_enabled,visibility,owner_id,creator_user_id,artist,created_at,origin_song_id';
export const contiColumns =
  'id,title,scheduled_date,youtube_playlist_url,items,visibility,owner_id,creator_user_id,created_at';

export const toSong = (
  row: {
    id: string;
    title: string;
    base_key: string;
    bpm: number | null;
    sections: unknown;
    translation_enabled: boolean;
    visibility: string;
    owner_id: string;
    creator_user_id: string;
    artist: string | null;
    created_at: string;
    origin_song_id: string | null;
  },
  creatorHandle?: string,
  originAvailable?: boolean,
) =>
  songSchema.parse({
    id: row.id,
    title: row.title,
    baseKey: row.base_key,
    ...(row.bpm === null ? {} : { bpm: row.bpm }),
    sections: row.sections,
    translationEnabled: row.translation_enabled,
    visibility: row.visibility,
    ownerId: row.owner_id,
    creatorId: row.creator_user_id,
    ...(creatorHandle ? { creatorHandle } : {}),
    createdAt: row.created_at,
    ...(row.artist ? { artist: row.artist } : {}),
    ...(row.origin_song_id ? { originSongId: row.origin_song_id } : {}),
    ...(originAvailable === undefined ? {} : { originAvailable }),
  });

export const toConti = (
  row: {
    id: string;
    title: string;
    scheduled_date: string | null;
    youtube_playlist_url: string | null;
    items: unknown;
    visibility: string;
    owner_id: string;
    creator_user_id: string;
    created_at: string;
  },
  creatorHandle?: string,
) =>
  contiSchema.parse({
    id: row.id,
    title: row.title,
    ...(row.scheduled_date === null ? {} : { scheduledDate: row.scheduled_date }),
    ...(row.youtube_playlist_url === null ? {} : { youtubePlaylistUrl: row.youtube_playlist_url }),
    items: row.items,
    visibility: row.visibility,
    ownerId: row.owner_id,
    creatorId: row.creator_user_id,
    ...(creatorHandle ? { creatorHandle } : {}),
    createdAt: row.created_at,
  });
