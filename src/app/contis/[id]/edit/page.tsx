'use client';

import { Button } from '@astryxdesign/core/Button';
import { useToast } from '@astryxdesign/core/Toast';
import { DragDropProvider } from '@dnd-kit/react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ContiEditorContent } from '@/components/conti-editor/conti-editor-content';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageContent, Shell } from '@/components/shell';
import { useContiDraft } from '@/features/conti-editor/use-conti-draft';
import { queries } from '@/lib/data-api';
import { getEditorDragEndOperation, getReorderOperation } from '@/lib/drag-end-operation';
import { useCurrentUserId } from '@/lib/use-current-user-id';
import { isYouTubePlaylistUrl } from '@/lib/youtube-playlist';

const ContiEditorPage = () => {
  const { id: contiId } = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToast();
  const userId = useCurrentUserId();
  const [songsQuery, contisQuery] = useQueries({
    queries: [queries.listSongs(), queries.listContis()],
  });
  const contis = contisQuery.data ?? [];
  const queryClient = useQueryClient();
  const loadedRoute = useRef<string | undefined>(undefined);
  const { draft: loadedDraft, actions } = useContiDraft();
  const draft = loadedRoute.current === contiId ? loadedDraft : undefined;
  const [expandedItemId, setExpandedItemId] = useState<string>();
  const [isSongDialogOpen, setSongDialogOpen] = useState(false);
  const saveConti = useMutation(
    queries.saveConti({
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: queries.listContis.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContiSongs.queryKey() }),
        ]),
    }),
  );
  const isNewConti = contiId === 'new';
  const isDraftInitializing =
    loadedRoute.current !== contiId &&
    (isNewConti || contis.some((entry) => entry.id === contiId && entry.ownerId === userId));

  useEffect(() => {
    if (loadedRoute.current === contiId) return;
    if (isNewConti) {
      loadedRoute.current = contiId;
      actions.load({ id: nanoid(12), title: '', items: [] });
      setExpandedItemId(undefined);
      setSongDialogOpen(false);
      return;
    }
    const found = contis.find((entry) => entry.id === contiId && entry.ownerId === userId);
    if (found) {
      loadedRoute.current = contiId;
      actions.load(found);
      setExpandedItemId(undefined);
      setSongDialogOpen(false);
    }
  }, [contiId, contis, actions, userId]);

  const addSong = (songId: string, sectionIds: string[]) => {
    setExpandedItemId(actions.addSong(songId, sectionIds));
    setSongDialogOpen(false);
  };

  const save = async () => {
    if (saveConti.isPending || !userId) return;
    if (!draft?.title.trim()) {
      showToast({ body: '콘티 제목을 입력하세요.', type: 'error' });
      return;
    }
    if (draft.youtubePlaylistUrl && !isYouTubePlaylistUrl(draft.youtubePlaylistUrl)) {
      showToast({ body: '유효한 YouTube 플레이리스트 주소를 입력하세요.', type: 'error' });
      return;
    }
    try {
      await saveConti.mutateAsync({ body: draft });
      showToast({ body: '콘티를 저장했습니다.' });
      if (isNewConti) router.replace(`/contis/${draft.id}`);
    } catch (error) {
      const body = (error as { body?: unknown } | null)?.body;
      const serverMessage =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : undefined;
      showToast({
        body: serverMessage ? `저장에 실패했습니다: ${serverMessage}` : '저장에 실패했습니다. 다시 시도하세요.',
        type: 'error',
      });
    }
  };

  return (
    <Shell>
      <PageContent>
        <DragDropProvider
          onDragEnd={(event) => {
            const operation = getEditorDragEndOperation(event);
            if (!operation) return;
            const reorder = getReorderOperation(operation);
            if (!reorder) return;
            if (operation.source.kind === 'conti-song') actions.reorderSong(reorder);
            else if (operation.source.kind === 'form-step' && reorder.scopeId)
              actions.changeSong(reorder.scopeId, { type: 'form/reorder', operation: reorder });
          }}
        >
          <PageHeader
            back={{
              href: isNewConti ? '/contis' : `/contis/${contiId}`,
              label: isNewConti ? '콘티 목록' : '콘티 보기',
            }}
            title={isNewConti ? '새 콘티' : '콘티 수정'}
            actions={
              <Button
                label="저장"
                variant="primary"
                icon={<Save aria-hidden="true" />}
                isLoading={saveConti.isPending}
                isDisabled={
                  !draft ||
                  !userId ||
                  songsQuery.isPending ||
                  songsQuery.isError ||
                  contisQuery.isPending ||
                  contisQuery.isError
                }
                onClick={save}
              />
            }
          />
          <QueryBoundary loadingLabel="콘티를 불러오는 중…" errorTitle="콘티 편집에 필요한 정보를 불러오지 못했습니다">
            <ContiEditorContent
              draft={draft}
              isDraftInitializing={isDraftInitializing}
              controls={{
                actions,
                expandedItemId,
                onExpandedItemChange: setExpandedItemId,
                isSongDialogOpen,
                onSongDialogOpenChange: setSongDialogOpen,
                onAddSong: addSong,
              }}
            />
          </QueryBoundary>
        </DragDropProvider>
      </PageContent>
    </Shell>
  );
};

export default ContiEditorPage;
