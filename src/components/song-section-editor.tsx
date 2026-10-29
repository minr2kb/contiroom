'use client';

import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSortable } from '@dnd-kit/react/sortable';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { LyricLineEditor } from '@/components/lyric-line-editor';
import type { LineEditorCommand, SectionEditorCommand } from '@/features/song-editor/editor-commands';
import type { Section } from '@/lib/model';

type Props = {
  section: Section;
  index: number;
  inputRef: (lineId: string, element: HTMLTextAreaElement | null) => void;
  translationEnabled: boolean;
  onTranslationChange: (sectionId: string, lineId: string, text: string) => void;
  onLineCommand: (command: LineEditorCommand) => void;
  onSectionCommand: (command: SectionEditorCommand) => void;
  activeLineId?: string;
  activeChordId?: string;
  activeSlotOffset?: number;
  armedChord?: string;
};

export const SongSectionEditor = ({
  section,
  index,
  inputRef,
  translationEnabled,
  onTranslationChange,
  onLineCommand,
  onSectionCommand,
  activeLineId,
  activeChordId,
  activeSlotOffset,
  armedChord,
}: Props) => {
  const sortable = useSortable({
    id: `section:${section.id}`,
    index,
    type: 'song-section',
    accept: 'song-section',
    data: { kind: 'song-section', sectionId: section.id },
  });

  return (
    <section
      ref={sortable.ref}
      id={`song-section-editor-${section.id}`}
      className={`mb-6 border-t border-neutral-800/80 transition ${sortable.isDragging ? 'opacity-40' : ''} ${sortable.isDropTarget ? 'border-neutral-400' : ''}`}
      aria-label={section.name}
    >
      <HStack wrap="wrap" align="center" gap={2} className="group/header relative py-3">
        <HStack align="center" gap={0} className="absolute right-full shrink-0">
          <IconButton
            label="곡 맨 아래에 섹션 추가"
            tooltip="곡 맨 아래에 섹션 추가"
            variant="ghost"
            size="sm"
            className="aspect-auto px-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/header:opacity-100 [@media(hover:hover)]:group-focus-within/header:opacity-100"
            icon={<Plus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onSectionCommand({ type: 'add-section' })}
          />
          <IconButton
            ref={sortable.handleRef}
            label={`${section.name} 섹션 이동`}
            tooltip="드래그해 섹션 순서 변경"
            variant="ghost"
            size="sm"
            className="aspect-auto cursor-grab px-1 text-neutral-400 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/header:opacity-100 [@media(hover:hover)]:group-focus-within/header:opacity-100"
            icon={<GripVertical aria-hidden="true" className="h-4 w-4" />}
          />
        </HStack>
        <div className="min-w-0 flex-1">
          <TextInput
            label="섹션 이름"
            isLabelHidden
            value={section.name}
            onChange={(name) => onSectionCommand({ type: 'rename', sectionId: section.id, name })}
            width="100%"
            size="lg"
            controlClassName="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 shadow-none transition-colors hover:border-neutral-600 focus-within:border-neutral-300 [&>input]:px-0 [&>input]:text-2xl [&>input]:font-bold [&>input]:leading-tight [&>input]:text-white"
            htmlName={`section-name-${section.id}`}
          />
        </div>
        <HStack align="center" gap={1} className="ml-auto">
          <IconButton
            label={`${section.name} 섹션 복제`}
            tooltip="섹션 복제"
            variant="secondary"
            size="sm"
            icon={<Copy aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onSectionCommand({ type: 'duplicate', sectionId: section.id })}
          />
          <IconButton
            label={`${section.name} 섹션 삭제`}
            tooltip="섹션 삭제"
            variant="destructive"
            size="sm"
            icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onSectionCommand({ type: 'remove', sectionId: section.id })}
          />
        </HStack>
      </HStack>
      <ol className="list-none">
        {section.lines.map((line, lineIndex) => (
          <LyricLineEditor
            key={line.id}
            line={line}
            sectionId={section.id}
            sectionName={section.name}
            lineIndex={lineIndex}
            inputRef={inputRef}
            translationEnabled={translationEnabled}
            onTranslationChange={onTranslationChange}
            onCommand={onLineCommand}
            activeChordId={activeChordId}
            activeSlotOffset={activeLineId === line.id ? activeSlotOffset : undefined}
            armedChord={armedChord}
          />
        ))}
      </ol>
    </section>
  );
};
