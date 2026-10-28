'use client';

import { useCollapsible } from '@astryxdesign/core/Collapsible';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useSortable } from '@dnd-kit/react/sortable';
import { ArrowRight, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ContiItem, FormStep, Section } from '@/lib/model';

export const SortableContiSong = ({
  item,
  index,
  title,
  songKey,
  bpm,
  summary,
  isExpanded,
  onOpenChange,
  expandedContent,
  onRemove,
}: {
  item: ContiItem;
  index: number;
  title: string;
  songKey: string;
  bpm?: number;
  summary: string;
  isExpanded: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expandedContent?: ReactNode;
  onRemove: () => void;
}) => {
  const selectRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastExpandedContent = useRef<ReactNode>(expandedContent);
  const [rowElement, setRowElement] = useState<HTMLLIElement | null>(null);
  const [isPresent, setIsPresent] = useState(isExpanded);
  const [isVisuallyOpen, setIsVisuallyOpen] = useState(false);
  const panelId = useId();
  if (expandedContent != null) lastExpandedContent.current = expandedContent;
  const { toggle } = useCollapsible({ isCollapsible: { isOpen: isExpanded, onOpenChange } });
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isExpanded) {
      setIsPresent(true);
      if (reducedMotion) {
        setIsVisuallyOpen(true);
        return;
      }
      let secondFrame = 0;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setIsVisuallyOpen(true));
      });
      return () => {
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
      };
    }
    if (panelRef.current?.contains(document.activeElement)) selectRef.current?.focus();
    setIsVisuallyOpen(false);
    if (reducedMotion) {
      setIsPresent(false);
      return;
    }
    const closeTimer = window.setTimeout(() => setIsPresent(false), 350);
    return () => window.clearTimeout(closeTimer);
  }, [isExpanded, rowElement]);
  const sortable = useSortable({
    id: `conti-song:${item.id}`,
    index,
    type: 'conti-song',
    accept: 'conti-song',
    data: { kind: 'conti-song', itemId: item.id },
  });
  const setRowRef = useCallback(
    (element: HTMLLIElement | null) => {
      sortable.ref(element);
      setRowElement(element);
    },
    [sortable.ref],
  );
  return (
    <>
      <ListItem
        ref={setRowRef}
        interactiveRef={selectRef}
        isSelected={isExpanded}
        className={`group flex-wrap ${sortable.isDragging ? 'opacity-40' : ''} ${sortable.isDropTarget ? 'ring-1 ring-inset ring-sky-300' : ''}`}
        startContent={
          <HStack as="span" align="center" gap={2}>
            <IconButton
              ref={sortable.handleRef}
              label={`${title} 순서 변경`}
              tooltip="드래그해 곡 순서 변경"
              variant="ghost"
              size="sm"
              icon={<GripVertical aria-hidden="true" className="h-4 w-4" />}
            />
          </HStack>
        }
        label={
          <button ref={selectRef} type="button" aria-controls={isExpanded ? panelId : undefined} onClick={toggle}>
            <HStack as="span" align="center" gap={2}>
              <Text as="span" weight="medium" maxLines={1}>
                {title}
              </Text>
              <Text
                as="span"
                type="code"
                color="secondary"
                className="shrink-0"
                style={songKey !== '키 미설정' ? { color: '#DF87FF' } : undefined}
              >
                {songKey}
              </Text>
              {bpm != null && (
                <Text as="span" type="supporting" className="shrink-0">
                  {bpm} BPM
                </Text>
              )}
            </HStack>
          </button>
        }
        description={summary}
        endContent={
          <HStack as="span" align="center" gap={2}>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
            <IconButton
              label={`${title} 제거`}
              tooltip="곡 제거"
              variant="secondary"
              size="sm"
              icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              onClick={onRemove}
              className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            />
          </HStack>
        }
      />
      {rowElement &&
        (isExpanded || isPresent) &&
        lastExpandedContent.current &&
        createPortal(
          <Grid
            ref={panelRef}
            id={panelId}
            role="region"
            aria-label={`${title} 설정`}
            aria-hidden={!isExpanded || !isVisuallyOpen}
            inert={!isExpanded || !isVisuallyOpen}
            width="100%"
            columns={1}
            className={`basis-full overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${isVisuallyOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            onClick={(event) => event.stopPropagation()}
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget || isExpanded || isVisuallyOpen) return;
              lastExpandedContent.current = undefined;
              setIsPresent(false);
            }}
          >
            <VStack className="min-h-0 overflow-hidden">
              <VStack paddingBlockStart={3}>{lastExpandedContent.current}</VStack>
            </VStack>
          </Grid>,
          rowElement,
        )}
    </>
  );
};

export const SortableFormStep = ({
  step,
  index,
  itemId,
  sections,
  onSelect,
  onRemove,
}: {
  step: FormStep;
  index: number;
  itemId: string;
  sections: Section[];
  onSelect: (sectionId: string) => void;
  onRemove: () => void;
}) => {
  const sortable = useSortable({
    id: `form-step:${itemId}:${step.id}`,
    index,
    type: 'form-step',
    accept: 'form-step',
    group: `form:${itemId}`,
    data: { kind: 'form-step', itemId, stepId: step.id },
  });
  return (
    <HStack
      as="li"
      ref={sortable.ref}
      align="center"
      gap={2}
      className={`shrink-0 ${sortable.isDragging ? 'opacity-40' : ''}`}
    >
      {index > 0 && <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />}
      <HStack
        align="center"
        gap={1}
        className={`rounded-lg border bg-neutral-950 py-1 pl-1 pr-2 transition ${sortable.isDropTarget ? 'border-sky-300 ring-1 ring-sky-300' : 'border-neutral-800'}`}
      >
        <IconButton
          ref={sortable.handleRef}
          label={`${index + 1}번째 송폼 순서 변경`}
          tooltip="드래그해 송폼 순서 변경"
          variant="secondary"
          size="sm"
          icon={<GripVertical aria-hidden="true" className="h-4 w-4" />}
        />
        <Selector
          label={`${index + 1}번째 송폼 섹션`}
          isLabelHidden
          options={sections.map((section) => ({ label: section.name, value: section.id }))}
          value={step.sectionId}
          onChange={onSelect}
          size="sm"
          variant="ghost"
          width="max-content"
        />
        <IconButton
          label={`${index + 1}번째 송폼 섹션 삭제`}
          tooltip="섹션 삭제"
          variant="secondary"
          size="sm"
          icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          onClick={onRemove}
        />
      </HStack>
    </HStack>
  );
};
