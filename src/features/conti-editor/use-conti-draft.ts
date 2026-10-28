import { nanoid } from 'nanoid';
import { useMemo, useReducer } from 'react';
import { contiEditorReducer, initialContiEditorState } from '@/lib/conti-editor-state';
import type { ReorderOperation } from '@/lib/drag-end-operation';
import type { Conti } from '@/lib/model';
import type { ContiSongChange } from './conti-song-change';

export const useContiDraft = () => {
  const [state, dispatch] = useReducer(contiEditorReducer, initialContiEditorState);

  const actions = useMemo(
    () => ({
      load: (conti: Conti) => dispatch({ type: 'load', conti }),
      setTitle: (value: string) => dispatch({ type: 'title', value }),
      setDate: (value?: string) => dispatch({ type: 'scheduled-date', value }),
      setYoutubePlaylistUrl: (value?: string) => dispatch({ type: 'youtube-playlist-url', value }),
      addSong: (songId: string, sectionIds: string[]) => {
        const itemId = nanoid(12);
        dispatch({
          type: 'item/add',
          item: {
            id: itemId,
            songId,
            form: sectionIds.map((sectionId) => ({ id: nanoid(12), sectionId })),
          },
        });
        return itemId;
      },
      removeSong: (itemId: string) => dispatch({ type: 'item/remove', itemId }),
      reorderSong: (operation: ReorderOperation) =>
        dispatch({ type: 'item/reorder', itemId: operation.sourceId, toIndex: operation.toIndex }),
      changeSong: (itemId: string, change: ContiSongChange) => {
        switch (change.type) {
          case 'key':
            dispatch({ type: 'item/key', itemId, value: change.value });
            break;
          case 'bpm':
            dispatch({ type: 'item/bpm', itemId, value: change.value });
            break;
          case 'form/add':
            dispatch({ type: 'form/add', itemId, step: { id: nanoid(12), sectionId: change.sectionId } });
            break;
          case 'form/select':
            dispatch({ type: 'form/section', itemId, stepId: change.stepId, sectionId: change.sectionId });
            break;
          case 'form/reorder':
            dispatch({
              type: 'form/reorder',
              itemId,
              stepId: change.operation.sourceId,
              toIndex: change.operation.toIndex,
            });
            break;
          case 'form/remove':
            dispatch({ type: 'form/remove', itemId, stepId: change.stepId });
            break;
        }
      },
    }),
    [dispatch],
  );

  return { draft: state.draft, actions };
};
