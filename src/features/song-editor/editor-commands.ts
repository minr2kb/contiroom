import type { KeyboardEvent } from 'react';

export type SectionEditorCommand =
  | { type: 'rename'; sectionId: string; name: string }
  | { type: 'add-section' }
  | { type: 'duplicate'; sectionId: string }
  | { type: 'remove'; sectionId: string };

export type LineEditorCommand =
  | {
      type: 'open-chord';
      element: HTMLButtonElement;
      sectionId: string;
      lineId: string;
      offset: number;
      chordId?: string;
    }
  | { type: 'remove-chord'; sectionId: string; lineId: string; chordId: string }
  | { type: 'copy-chord'; sectionId: string; lineId: string; chordId: string }
  | { type: 'change-lyric'; sectionId: string; lineIndex: number; value: string; caret: number }
  | { type: 'lyric-key-down'; event: KeyboardEvent<HTMLTextAreaElement>; sectionId: string; lineIndex: number }
  | { type: 'delete-line'; sectionId: string; lineId: string; focusLine?: boolean }
  | { type: 'insert-line-after'; sectionId: string; lineId: string }
  | { type: 'duplicate-line'; sectionId: string; lineId: string; focusLine?: boolean }
  | { type: 'copy-line'; sectionId: string; lineId: string }
  | { type: 'paste-line'; sectionId: string; lineId: string };
