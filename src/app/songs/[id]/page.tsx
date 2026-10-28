import { SongDetailPage } from '@/components/song-detail/song-detail-page';

type SearchParams = { contiId?: string | string[]; itemId?: string | string[]; from?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const from = first(query.from);
  const returnTo =
    from && (from === '/' || from.startsWith('/?') || from === '/songs' || from.startsWith('/songs?')) ? from : null;
  return <SongDetailPage id={id} contiId={first(query.contiId)} itemId={first(query.itemId)} returnTo={returnTo} />;
}
