import { arrayMove } from '@dnd-kit/helpers';
import type { Conti, ContiItem, FormStep } from './model.ts';

export type ContiEditorState = {
  draft?: Conti;
};

export type ContiEditorAction =
  | { type: 'load'; conti: Conti }
  | { type: 'title'; value: string }
  | { type: 'scheduled-date'; value?: string }
  | { type: 'youtube-playlist-url'; value?: string }
  | { type: 'item/add'; item: ContiItem }
  | { type: 'item/remove'; itemId: string }
  | { type: 'item/move'; itemId: string; direction: -1 | 1 }
  | { type: 'item/reorder'; itemId: string; toIndex: number }
  | { type: 'item/key'; itemId: string; value: string }
  | { type: 'item/bpm'; itemId: string; value?: number }
  | { type: 'form/add'; itemId: string; step: FormStep }
  | { type: 'form/remove'; itemId: string; stepId: string }
  | { type: 'form/move'; itemId: string; stepId: string; direction: -1 | 1 }
  | { type: 'form/reorder'; itemId: string; stepId: string; toIndex: number }
  | { type: 'form/section'; itemId: string; stepId: string; sectionId: string };

export const initialContiEditorState: ContiEditorState = {};

export const contiEditorReducer = (state: ContiEditorState, action: ContiEditorAction): ContiEditorState => {
  if (action.type === 'load') {
    return { draft: structuredClone(action.conti) };
  }
  if (!state.draft) return state;
  const draft = structuredClone(state.draft);
  const item = 'itemId' in action ? draft.items.find((candidate) => candidate.id === action.itemId) : undefined;
  switch (action.type) {
    case 'title':
      draft.title = action.value;
      break;
    case 'scheduled-date':
      if (action.value) draft.scheduledDate = action.value;
      else delete draft.scheduledDate;
      break;
    case 'youtube-playlist-url':
      if (action.value) draft.youtubePlaylistUrl = action.value;
      else delete draft.youtubePlaylistUrl;
      break;
    case 'item/add':
      draft.items.push(action.item);
      break;
    case 'item/remove':
      draft.items = draft.items.filter((candidate) => candidate.id !== action.itemId);
      break;
    case 'item/move': {
      const index = draft.items.findIndex((candidate) => candidate.id === action.itemId);
      const next = index + action.direction;
      if (index >= 0 && next >= 0 && next < draft.items.length)
        [draft.items[index], draft.items[next]] = [draft.items[next], draft.items[index]];
      break;
    }
    case 'item/reorder': {
      const from = draft.items.findIndex((candidate) => candidate.id === action.itemId);
      const to = Math.max(0, Math.min(action.toIndex, draft.items.length - 1));
      if (from >= 0 && to !== from) {
        draft.items = arrayMove(draft.items, from, to);
      }
      break;
    }
    case 'item/key':
      if (item) item.key = action.value;
      break;
    case 'item/bpm':
      if (item) item.bpm = action.value;
      break;
    case 'form/add':
      item?.form.push(action.step);
      break;
    case 'form/remove':
      if (item) item.form = item.form.filter((step) => step.id !== action.stepId);
      break;
    case 'form/move': {
      const index = item?.form.findIndex((step) => step.id === action.stepId) ?? -1;
      const next = index + action.direction;
      if (item && index >= 0 && next >= 0 && next < item.form.length)
        [item.form[index], item.form[next]] = [item.form[next], item.form[index]];
      break;
    }
    case 'form/reorder': {
      if (!item) break;
      const from = item.form.findIndex((step) => step.id === action.stepId);
      const to = Math.max(0, Math.min(action.toIndex, item.form.length - 1));
      if (from >= 0 && to !== from) {
        item.form = arrayMove(item.form, from, to);
      }
      break;
    }
    case 'form/section': {
      const step = item?.form.find((candidate) => candidate.id === action.stepId);
      if (step) step.sectionId = action.sectionId;
      break;
    }
  }
  return { draft };
};
