import { useToast } from '@astryxdesign/core/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queries } from '@/lib/data-api';

export const useDeleteSong = (songId: string | undefined) => {
  const router = useRouter();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deletion = useMutation(
    queries.deleteSong({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queries.listSongs.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContis.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContiSongs.queryKey() }),
        ]);
        showToast({ body: '곡을 삭제했습니다.' });
      },
      onError: () => showToast({ body: '곡을 삭제하지 못했습니다. 다시 시도하세요.', type: 'error' }),
    }),
  );

  const deleteSong = async () => {
    if (!songId || deletion.isPending) return;
    try {
      await deletion.mutateAsync({ path: { id: songId } });
      setIsDeleteOpen(false);
      router.replace('/songs');
    } catch {
      // The mutation exposes the error to the page.
    }
  };

  return {
    isDeleteOpen,
    setIsDeleteOpen,
    isDeleting: deletion.isPending,
    deleteSong,
  };
};
