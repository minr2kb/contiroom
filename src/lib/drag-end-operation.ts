export type EditorDragData =
  | { kind: 'conti-song'; itemId: string }
  | { kind: 'form-step'; itemId: string; stepId: string }
  | { kind: 'song-section'; sectionId: string }
  | { kind: 'lyric-line'; sectionId: string; lineId: string }
  | { kind: 'lyric-slot'; sectionId: string; lineId: string; offset: number }
  | { kind: 'chord'; id: string; value: string; sourceSectionId: string; sourceLineId: string };

export type EditorDragEndOperation = {
  /** Data attached to the entity that was picked up. */
  source: EditorDragData;
  /** Data attached to the entity under the drop point when the drag ended. */
  target: EditorDragData;
  /** Sortable position after the drag projection was applied. */
  toIndex?: number;
  sourceGroup?: string;
  sourceInitialGroup?: string;
};

export type ReorderOperation = {
  sourceId: string;
  toIndex: number;
  scopeId?: string;
  targetScopeId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseData = (value: unknown): EditorDragData | undefined => {
  if (!isRecord(value) || typeof value.kind !== 'string') return;
  switch (value.kind) {
    case 'conti-song':
      return typeof value.itemId === 'string' ? { kind: value.kind, itemId: value.itemId } : undefined;
    case 'form-step':
      return typeof value.itemId === 'string' && typeof value.stepId === 'string'
        ? { kind: value.kind, itemId: value.itemId, stepId: value.stepId }
        : undefined;
    case 'song-section':
      return typeof value.sectionId === 'string' ? { kind: value.kind, sectionId: value.sectionId } : undefined;
    case 'lyric-line':
      return typeof value.sectionId === 'string' && typeof value.lineId === 'string'
        ? { kind: value.kind, sectionId: value.sectionId, lineId: value.lineId }
        : undefined;
    case 'lyric-slot':
      return typeof value.sectionId === 'string' && typeof value.lineId === 'string' && typeof value.offset === 'number'
        ? { kind: value.kind, sectionId: value.sectionId, lineId: value.lineId, offset: value.offset }
        : undefined;
    case 'chord':
      return typeof value.id === 'string' && typeof value.value === 'string'
        ? {
            kind: value.kind,
            id: value.id,
            value: value.value,
            sourceSectionId: typeof value.sourceSectionId === 'string' ? value.sourceSectionId : '',
            sourceLineId: typeof value.sourceLineId === 'string' ? value.sourceLineId : '',
          }
        : undefined;
    default:
      return;
  }
};

const sortableIndex = (entity: Record<string, unknown>) =>
  Number.isInteger(entity.index) ? (entity.index as number) : undefined;

export const getEditorDragEndOperation = (event: unknown): EditorDragEndOperation | undefined => {
  if (!isRecord(event) || event.canceled || !isRecord(event.operation)) return;
  const { source, target } = event.operation;
  if (!isRecord(source) || !isRecord(target)) return;
  const sourceData = parseData(source.data);
  const targetData = parseData(target.data);
  if (!sourceData || !targetData) return;

  return {
    source: sourceData,
    target: targetData,
    toIndex: sortableIndex(source),
    sourceGroup: typeof source.group === 'string' ? source.group : undefined,
    sourceInitialGroup: typeof source.initialGroup === 'string' ? source.initialGroup : undefined,
  };
};

export const getReorderOperation = (operation: EditorDragEndOperation): ReorderOperation | undefined => {
  const { source, target, toIndex, sourceGroup, sourceInitialGroup } = operation;
  if (toIndex === undefined) return;

  if (source.kind === 'conti-song' && target.kind === 'conti-song') {
    return { sourceId: source.itemId, toIndex };
  }
  if (source.kind === 'form-step' && target.kind === 'form-step' && source.itemId === target.itemId) {
    return { sourceId: source.stepId, scopeId: source.itemId, toIndex };
  }
  if (source.kind === 'song-section' && target.kind === 'song-section') {
    return { sourceId: source.sectionId, toIndex };
  }
  if (source.kind === 'lyric-line' && target.kind === 'lyric-line') {
    return {
      sourceId: source.lineId,
      scopeId: sourceInitialGroup ?? source.sectionId,
      targetScopeId: sourceGroup ?? target.sectionId,
      toIndex,
    };
  }
};
