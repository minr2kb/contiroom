import { PrintPage } from './print-page';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ songId?: string; contiId?: string; itemId?: string; key?: string }>;
}) {
  const { songId, contiId, itemId, key } = await searchParams;
  return <PrintPage songId={songId} contiId={contiId} itemId={itemId} displayKey={key} />;
}
