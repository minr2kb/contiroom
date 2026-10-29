'use client';

import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { range } from 'es-toolkit/math';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { LineEditorCommand } from '@/features/song-editor/editor-commands';
import { graphemes } from '@/lib/graphemes';
import type { LyricLine } from '@/lib/model';

type Props = {
  line: LyricLine;
  sectionId: string;
  sectionName: string;
  lineIndex: number;
  inputRef: (lineId: string, element: HTMLTextAreaElement | null) => void;
  translationEnabled: boolean;
  onTranslationChange: (sectionId: string, lineId: string, text: string) => void;
  onCommand: (command: LineEditorCommand) => void;
  activeChordId?: string;
  activeSlotOffset?: number;
  armedChord?: string;
};

export const LyricLineEditor = ({
  line,
  sectionId,
  sectionName,
  lineIndex,
  inputRef,
  translationEnabled,
  onTranslationChange,
  onCommand,
  activeChordId,
  activeSlotOffset,
  armedChord,
}: Props) => {
  const characters = graphemes(line.text);
  const sortable = useSortable({
    id: `line:${sectionId}:${line.id}`,
    index: lineIndex,
    type: 'lyric-line',
    accept: 'lyric-line',
    group: sectionId,
    data: { kind: 'lyric-line', sectionId, lineId: line.id },
  });
  const slotCount = Math.max(characters.length + 1, line.text ? 0 : 8, ...line.chords.map((chord) => chord.offset + 2));

  return (
    <HStack
      as="li"
      ref={sortable.ref}
      id={`song-lyric-line-${line.id}`}
      align="end"
      gap={2}
      tabIndex={0}
      aria-label={`${sectionName} ${lineIndex + 1}번째 줄`}
      className={`group relative w-full py-2 px-1 transition-colors hover:bg-neutral-900/40 focus:bg-neutral-800/60 focus-within:bg-neutral-900/40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neutral-600 ${sortable.isDragging ? 'opacity-40' : ''} ${sortable.isDropTarget ? 'bg-neutral-800/60' : ''}`}
      onClick={(event) => {
        if (event.target instanceof Element && !event.target.closest('button, textarea, input'))
          event.currentTarget.focus();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.nativeEvent.isComposing || event.keyCode === 229) return;
        const commandKey = event.metaKey || event.ctrlKey;
        if (commandKey && !event.altKey && !event.shiftKey) {
          const key = event.key.toLowerCase();
          if (key === 'd') onCommand({ type: 'duplicate-line', sectionId, lineId: line.id, focusLine: true });
          else if (key === 'c') onCommand({ type: 'copy-line', sectionId, lineId: line.id });
          else if (key === 'v') onCommand({ type: 'paste-line', sectionId, lineId: line.id });
          else return;
          event.preventDefault();
        } else if (!commandKey && !event.altKey && (event.key === 'Backspace' || event.key === 'Delete')) {
          event.preventDefault();
          onCommand({ type: 'delete-line', sectionId, lineId: line.id, focusLine: true });
        }
      }}
    >
      <HStack
        align="center"
        gap={0}
        className={`absolute right-full ${translationEnabled ? 'bottom-12' : 'bottom-4'} shrink-0`}
      >
        <IconButton
          label={`${sectionName} ${lineIndex + 1}번째 줄 뒤에 추가`}
          tooltip="이 줄 아래에 추가"
          variant="ghost"
          size="sm"
          className="aspect-auto px-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
          icon={<Plus aria-hidden="true" className="h-4 w-4" />}
          onClick={() => onCommand({ type: 'insert-line-after', sectionId, lineId: line.id })}
        />
        <IconButton
          ref={sortable.handleRef}
          label={`${sectionName} ${lineIndex + 1}번째 줄 이동`}
          tooltip="드래그해 순서 변경·섹션 이동"
          variant="ghost"
          size="sm"
          className="aspect-auto cursor-grab px-1 text-neutral-400 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
          icon={<GripVertical aria-hidden="true" className="h-4 w-4" />}
        />
      </HStack>
      <div className="relative min-w-0 flex-1">
        <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <div className="w-max min-w-full">
            <HStack
              minHeight={34}
              className="font-mono whitespace-pre text-lg leading-normal"
              role="toolbar"
              aria-label="가사 위 코드 배치 영역"
            >
              {range(slotCount).map((offset) => {
                const glyph = characters[offset];
                const placedChords = line.chords.filter((chord) => chord.offset === offset);
                return (
                  <span
                    key={offset}
                    className={`relative inline-block h-[34px] shrink-0 ${glyph ? '' : 'min-w-[2ch]'}`}
                  >
                    <span aria-hidden="true" className="invisible tracking-wide">
                      {glyph === ' ' || !glyph ? '\u00a0' : glyph}
                    </span>
                    <ChordDropSlot
                      sectionId={sectionId}
                      lineId={line.id}
                      offset={offset}
                      onCommand={onCommand}
                      ghostChord={placedChords.length === 0 ? armedChord : undefined}
                      isAwaitingInput={placedChords.length === 0 && activeSlotOffset === offset && !armedChord}
                    />
                    {placedChords.map((chord) => (
                      <DraggableChord
                        key={chord.id}
                        chord={chord}
                        sectionId={sectionId}
                        lineId={line.id}
                        offset={offset}
                        isSelected={chord.id === activeChordId}
                        onCommand={onCommand}
                      />
                    ))}
                  </span>
                );
              })}
            </HStack>
            <textarea
              ref={(element) => inputRef(line.id, element)}
              className="font-mono block min-h-9 w-full resize-none overflow-x-hidden whitespace-pre border-b border-transparent bg-transparent p-0 text-lg leading-normal tracking-wide text-white outline-none transition-colors placeholder:text-neutral-600 group-hover:border-neutral-600 focus:border-neutral-300"
              aria-label={`${sectionName} ${lineIndex + 1}번째 줄 가사`}
              rows={1}
              wrap="off"
              placeholder="가사를 입력하세요"
              value={line.text}
              onChange={(event) =>
                onCommand({
                  type: 'change-lyric',
                  sectionId,
                  lineIndex,
                  value: event.target.value,
                  caret: event.target.selectionStart,
                })
              }
              onKeyDown={(event) => onCommand({ type: 'lyric-key-down', event, sectionId, lineIndex })}
            />
          </div>
        </div>
        {translationEnabled && (
          <input
            type="text"
            className="mt-1 block h-7 w-full min-w-0 border-b border-transparent bg-transparent p-0 font-mono text-sm leading-normal text-neutral-300 outline-none transition-colors placeholder:text-neutral-600 group-hover:border-neutral-600 focus:border-neutral-300"
            aria-label={`${sectionName} ${lineIndex + 1}번째 줄 번역 가사`}
            placeholder="번역 가사를 입력하세요"
            value={line.translation ?? ''}
            onChange={(event) => onTranslationChange(sectionId, line.id, event.target.value)}
          />
        )}
      </div>
      <HStack
        align="center"
        gap={0.5}
        role="toolbar"
        aria-label={`${sectionName} ${lineIndex + 1}번째 줄 도구`}
        className={`mt-7 hidden shrink-0 opacity-100 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 lg:flex ${translationEnabled ? 'mb-8' : 'mb-0'}`}
      >
        <IconButton
          label={`${sectionName} ${lineIndex + 1}번째 줄 복제`}
          tooltip="줄 복제"
          variant="secondary"
          size="sm"
          icon={<Copy aria-hidden="true" className="h-4 w-4" />}
          onClick={() => onCommand({ type: 'duplicate-line', sectionId, lineId: line.id })}
        />
        <IconButton
          label={`${sectionName} ${lineIndex + 1}번째 줄 삭제`}
          tooltip="줄 삭제"
          variant="secondary"
          size="sm"
          icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          onClick={() => onCommand({ type: 'delete-line', sectionId, lineId: line.id })}
        />
      </HStack>
      <div className="mt-7 shrink-0 lg:hidden">
        <MoreMenu
          label={`${sectionName} ${lineIndex + 1}번째 줄 메뉴`}
          alignment="end"
          presentation="adaptive"
          variant="ghost"
          size="sm"
          items={[
            {
              label: '줄 복제',
              icon: <Copy aria-hidden="true" className="h-4 w-4" />,
              onClick: () => onCommand({ type: 'duplicate-line', sectionId, lineId: line.id }),
            },
            {
              label: '줄 삭제',
              icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
              variant: 'destructive',
              onClick: () => onCommand({ type: 'delete-line', sectionId, lineId: line.id }),
            },
          ]}
        />
      </div>
    </HStack>
  );
};

const ChordDropSlot = ({
  sectionId,
  lineId,
  offset,
  onCommand,
  ghostChord,
  isAwaitingInput,
}: {
  sectionId: string;
  lineId: string;
  offset: number;
  onCommand: Props['onCommand'];
  ghostChord?: string;
  isAwaitingInput: boolean;
}) => {
  const { ref, isDropTarget } = useDroppable({
    id: `slot:${sectionId}:${lineId}:${offset}`,
    accept: 'chord',
    data: { kind: 'lyric-slot', sectionId, lineId, offset },
  });
  return (
    <button
      ref={ref}
      type="button"
      className={`group/slot font-mono absolute inset-0 h-[34px] w-full cursor-pointer border-0 bg-transparent p-0 text-lg leading-normal after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:opacity-0 after:transition-opacity hover:bg-neutral-700/70 hover:after:opacity-100 focus-visible:bg-neutral-700/70 focus-visible:outline-1 focus-visible:outline-neutral-300 focus-visible:after:opacity-100 ${isDropTarget ? 'bg-neutral-600/30 after:bg-neutral-300 after:opacity-100' : isAwaitingInput ? 'bg-[#DF87FF]/10 ring-1 ring-inset ring-[#DF87FF]/40 hover:bg-[#DF87FF]/15 focus-visible:bg-[#DF87FF]/15 after:bg-[#DF87FF]/75 after:opacity-100' : 'after:bg-neutral-300'}`}
      aria-pressed={isAwaitingInput}
      aria-label={
        ghostChord ? `${offset + 1}번째 글자 위치에 ${ghostChord} 코드 놓기` : `${offset + 1}번째 글자 위치에 코드 추가`
      }
      onClick={(event) => onCommand({ type: 'open-chord', element: event.currentTarget, sectionId, lineId, offset })}
    >
      {ghostChord && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-[1] whitespace-nowrap rounded-md border border-dashed border-neutral-400/70 bg-neutral-800/85 px-[7px] py-[3px] text-sm leading-5 text-neutral-200 opacity-0 transition-opacity group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100"
        >
          {ghostChord}
        </span>
      )}
    </button>
  );
};

const DraggableChord = ({
  chord,
  sectionId,
  lineId,
  offset,
  isSelected,
  onCommand,
}: {
  chord: LyricLine['chords'][number];
  sectionId: string;
  lineId: string;
  offset: number;
  isSelected: boolean;
  onCommand: Props['onCommand'];
}) => {
  const { ref, isDragging } = useDraggable({
    id: `chord:${chord.id}`,
    type: 'chord',
    data: { kind: 'chord', id: chord.id, value: chord.value, sourceSectionId: sectionId, sourceLineId: lineId },
  });
  return (
    <span className="absolute top-0 left-0 z-10 inline-flex items-start gap-0.5">
      <button
        ref={ref}
        type="button"
        className={`font-mono cursor-grab whitespace-nowrap rounded-md border px-[6px] py-[2px] text-xs leading-5 text-white focus-visible:outline-2 focus-visible:outline-neutral-200 ${isSelected ? 'border-neutral-300 bg-neutral-800' : 'border-neutral-600 bg-neutral-900 hover:border-neutral-300 hover:bg-neutral-800'} ${isDragging ? 'scale-105 border-neutral-300 opacity-60 shadow-lg' : ''}`}
        onClick={(event) =>
          onCommand({ type: 'open-chord', element: event.currentTarget, sectionId, lineId, offset, chordId: chord.id })
        }
        onKeyDown={(event) => {
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onCommand({ type: 'remove-chord', sectionId, lineId, chordId: chord.id });
          }
        }}
        title="코드 변경, 드래그해 이동, Delete로 삭제"
      >
        {chord.value}
      </button>
      {isSelected && (
        <HStack
          align="center"
          gap={1}
          role="toolbar"
          aria-label={`${chord.value} 코드 도구`}
          className="absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-lg"
        >
          <IconButton
            label={`${chord.value} 코드 복사`}
            tooltip="다른 위치에 복사"
            variant="ghost"
            size="sm"
            icon={<Copy aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onCommand({ type: 'copy-chord', sectionId, lineId, chordId: chord.id })}
          />
          <IconButton
            label={`${chord.value} 코드 삭제`}
            tooltip="코드 삭제"
            variant="ghost"
            size="sm"
            icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onCommand({ type: 'remove-chord', sectionId, lineId, chordId: chord.id })}
          />
        </HStack>
      )}
    </span>
  );
};
