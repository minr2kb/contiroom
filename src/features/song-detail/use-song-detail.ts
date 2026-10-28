import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { queries } from '@/lib/data-api';
import type { ContiItem, Section, Song } from '@/lib/model';
import { keyPitch } from '@/lib/music';

export type SongDetailView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'missing-song' }
  | { kind: 'empty-form' }
  | { kind: 'invalid-context'; songId: string }
  | { kind: 'missing-conti-item'; contiId: string }
  | {
      kind: 'ready';
      song: Song;
      sectionOrder?: string[];
      formSections: { sectionId: string; name: string; count: number }[];
      displayedSections: Section[];
      transposeBy: number;
      preferFlats: boolean;
    };

type SongDetailViewInput = {
  query: { isPending: boolean; isError: boolean };
  song: Song | undefined;
  context: {
    songId: string;
    contiId: string | null;
    requested: boolean;
    valid: boolean;
    item: ContiItem | undefined;
  };
  sectionOrder: string[] | undefined;
  displayKey: string | undefined;
};

function resolveSongDetailView({
  query,
  song,
  context,
  sectionOrder,
  displayKey,
}: SongDetailViewInput): SongDetailView {
  if (query.isPending) return { kind: 'loading' };
  if (query.isError) return { kind: 'error' };
  if (context.requested && !context.valid) return { kind: 'invalid-context', songId: context.songId };
  if (context.valid && !context.item) return { kind: 'missing-conti-item', contiId: context.contiId ?? '' };
  if (!song) return { kind: 'missing-song' };
  if (sectionOrder && sectionOrder.length === 0) return { kind: 'empty-form' };
  return {
    kind: 'ready',
    song,
    sectionOrder,
    formSections: sectionOrder
      ? sectionOrder.reduce<{ sectionId: string; name: string; count: number }[]>((groups, sectionId) => {
          const section = song.sections.find((candidate) => candidate.id === sectionId);
          if (!section) return groups;
          const previous = groups[groups.length - 1];
          if (previous?.sectionId === sectionId) previous.count += 1;
          else groups.push({ sectionId, name: section.name, count: 1 });
          return groups;
        }, [])
      : [],
    displayedSections: song.sections,
    transposeBy: displayKey ? keyPitch(displayKey) - keyPitch(song.baseKey) : 0,
    preferFlats: (displayKey || song.baseKey).includes('b'),
  };
}

export const useSongDetail = (id: string, contiId: string | null, itemId: string | null) => {
  const router = useRouter();
  const hasAnyContiContext = Boolean(contiId || itemId);
  const hasContiContext = Boolean(contiId && itemId);
  const [songsQuery, contisQuery] = useQueries({
    queries: [
      hasContiContext ? queries.listContiSongs({ path: { id: contiId ?? '' } }) : queries.listSongs(),
      { ...queries.listContis(), enabled: hasContiContext },
    ],
  });
  const songs = songsQuery.data ?? [];
  const contis = contisQuery.data ?? [];
  const isPending = songsQuery.isPending || (hasContiContext && contisQuery.isPending);
  const isError = songsQuery.isError || (hasContiContext && contisQuery.isError);
  const conti = hasContiContext ? contis.find((entry) => entry.id === contiId) : undefined;
  const contiItem: ContiItem | undefined = conti?.items.find((entry) => entry.id === itemId && entry.songId === id);
  const song = !hasContiContext || contiItem ? songs.find((entry) => entry.id === id) : undefined;
  const [preview, setPreview] = useState<{ songId: string; key: string } | null>(null);
  const previewKey = preview && preview.songId === song?.id ? preview.key : song?.baseKey;
  const displayKey = contiItem ? contiItem.key || song?.baseKey : previewKey;
  const sectionOrder = contiItem?.form.flatMap((step) =>
    song?.sections.some((section) => section.id === step.sectionId) ? [step.sectionId] : [],
  );

  useEffect(() => {
    if (id === 'new') router.replace('/songs/new/edit');
  }, [id, router]);

  const view = resolveSongDetailView({
    query: { isPending, isError },
    song,
    context: {
      songId: id,
      contiId,
      requested: hasAnyContiContext,
      valid: hasContiContext,
      item: contiItem,
    },
    sectionOrder,
    displayKey,
  });

  return {
    song,
    context: { contiId, item: contiItem, requested: hasAnyContiContext, valid: hasContiContext },
    preview: { key: previewKey, setKey: (key: string) => setPreview({ songId: id, key }) },
    view,
    refetch: () => {
      void songsQuery.refetch();
      if (hasContiContext) void contisQuery.refetch();
    },
  };
};
