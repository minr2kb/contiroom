import type { ReorderOperation } from '@/lib/drag-end-operation';

export type ContiSongChange =
  | { type: 'key'; value: string }
  | { type: 'bpm'; value?: number }
  | { type: 'form/add'; sectionId: string }
  | { type: 'form/select'; stepId: string; sectionId: string }
  | { type: 'form/reorder'; operation: ReorderOperation }
  | { type: 'form/remove'; stepId: string };
