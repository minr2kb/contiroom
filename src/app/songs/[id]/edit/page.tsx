'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChordPicker } from '@/components/chord-picker';
import { PageHeader } from '@/components/page-header';
import { Shell } from '@/components/shell';
import { SongEditorContent } from '@/components/song-editor/song-editor-content';
import type { LineEditorCommand, SectionEditorCommand } from '@/features/song-editor/editor-commands';
import { useChordEditor } from '@/features/song-editor/use-chord-editor';
import { useLyricEditor } from '@/features/song-editor/use-lyric-editor';
import { createSong, useSongDraft } from '@/features/song-editor/use-song-draft';
import { queries } from '@/lib/data-api';
import { getEditorDragEndOperation } from '@/lib/drag-end-operation';
import type { LyricLine, Song } from '@/lib/model';
import { MUSIC_KEYS } from '@/lib/music';
import { PHOTO_DRAFT_STORAGE_KEY, storedPhotoDraftSchema } from '@/lib/song-photo-draft';
import { useCurrentUserId } from '@/lib/use-current-user-id';

const focusChordEditor = () => {
  const id = window.matchMedia('(max-width: 1023px)').matches ? 'song-chord-mobile-header' : 'song-chord-panel';
  requestAnimationFrame(() => document.getElementById(id)?.focus());
};

const SongEditor = () => {
  const { id: songId } = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToast();
  const userId = useCurrentUserId();
  const { data: songs = [], isPending, isError, refetch } = useQuery(queries.listSongs());
  const queryClient = useQueryClient();
  const loadedRoute = useRef<string | undefined>(undefined);
  const photoDraftId = useRef<string | null>(null);
  const copiedLine = useRef<LyricLine | null>(null);
  const dragOrigin = useRef<{ element: Element; parent: Element; nextSibling: ChildNode | null } | null>(null);
  const { draft: loadedDraft, recentChords, song: songActions, sections, lines, chords } = useSongDraft();
  const draft = loadedRoute.current === songId ? loadedDraft : undefined;
  const [message, setMessage] = useState('');
  const [armedChord, setArmedChord] = useState<string>();
  const saveSong = useMutation(
    queries.saveSong({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queries.listSongs.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContis.queryKey() }),
          queryClient.invalidateQueries({ queryKey: queries.listContiSongs.queryKey() }),
        ]);
      },
    }),
  );
  const { target, existingChord, openChord, closeChord, placeChord, chooseChord, removeChord, resetChordEditor } =
    useChordEditor({ song: draft, chords, setMessage });
  const { registerInput, handleLyricChange, handleLyricKeyDown } = useLyricEditor(draft, lines);
  const sectionToScroll = useRef<string | null>(null);

  const isNewSong = songId === 'new';

  useEffect(() => {
    if (loadedRoute.current === songId) return;
    let song: Song | undefined;
    let imported = false;
    if (isNewSong) {
      if (new URLSearchParams(window.location.search).get('mode') === 'manual') {
        sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY);
      }
      const stored = sessionStorage.getItem(PHOTO_DRAFT_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = storedPhotoDraftSchema.safeParse(JSON.parse(stored));
          if (parsed.success) {
            song = parsed.data;
            photoDraftId.current = song.id;
            imported = true;
          } else {
            sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY);
          }
        } catch {
          sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY);
        }
      }
      song ??= createSong();
    } else {
      song = songs.find((entry) => entry.id === songId && entry.ownerId === userId);
    }
    if (!song) return;
    loadedRoute.current = songId;
    resetChordEditor();
    setArmedChord(undefined);
    setMessage(imported ? '사진에서 만든 초안입니다. 내용을 확인한 뒤 저장하세요.' : '');
    songActions.load(song);
  }, [songId, songs, resetChordEditor, songActions, userId]);

  useEffect(() => {
    if (isNewSong && draft && draft.id === photoDraftId.current) {
      sessionStorage.setItem(PHOTO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft, isNewSong]);

  useEffect(() => {
    const sectionId = sectionToScroll.current;
    if (!sectionId || !draft?.sections.some((section) => section.id === sectionId)) return;
    document.getElementById(`song-section-editor-${sectionId}`)?.scrollIntoView({ block: 'start' });
    sectionToScroll.current = null;
  }, [draft?.sections]);

  useEffect(() => {
    if (!target || !window.matchMedia('(max-width: 1023px)').matches) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`song-lyric-line-${target.lineId}`)?.scrollIntoView({ block: 'end' });
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  useEffect(() => {
    if (!armedChord) return;
    const cancelChordSelection = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const wasInToast =
        event.target instanceof Element && Boolean(event.target.closest('[data-selected-chord-toast]'));
      setArmedChord(undefined);
      event.preventDefault();
      if (wasInToast) focusChordEditor();
    };
    window.addEventListener('keydown', cancelChordSelection);
    return () => window.removeEventListener('keydown', cancelChordSelection);
  }, [armedChord]);

  const save = async () => {
    if (!draft || !userId || saveSong.isPending) return;
    if (!draft.title.trim()) {
      setMessage('곡 제목을 입력하세요.');
      return;
    }
    if (!MUSIC_KEYS.some((key) => key === draft.baseKey)) {
      setMessage('기준 키를 선택하세요.');
      return;
    }
    try {
      const saved = await saveSong.mutateAsync({ body: draft });
      photoDraftId.current = null;
      sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY);
      songActions.load(saved);
      resetChordEditor();
      setMessage('');
      showToast({ body: '곡을 저장했습니다.' });
      router.replace(`/songs/${saved.id}`);
    } catch {
      showToast({ body: '저장에 실패했습니다. 다시 시도하세요.', type: 'error' });
    }
  };
  const cancel = () => {
    if (isNewSong) {
      photoDraftId.current = null;
      sessionStorage.removeItem(PHOTO_DRAFT_STORAGE_KEY);
      router.push('/songs');
      return;
    }
    router.push(`/songs/${songId}`);
  };
  const addSection = () => {
    sectionToScroll.current = sections.add();
  };
  const handleSectionCommand = (command: SectionEditorCommand) => {
    switch (command.type) {
      case 'rename':
        sections.rename(command.sectionId, command.name);
        break;
      case 'add-section':
        sectionToScroll.current = sections.add();
        break;
      case 'duplicate':
        sectionToScroll.current = sections.duplicate(command.sectionId);
        break;
      case 'remove':
        sections.remove(command.sectionId);
        break;
    }
  };
  const handleLineCommand = (command: LineEditorCommand) => {
    switch (command.type) {
      case 'open-chord':
        if (armedChord && !command.chordId) {
          chords.place(command.sectionId, command.lineId, command.offset, {
            id: nanoid(12),
            value: armedChord,
            offset: command.offset,
          });
          chords.useRecent(armedChord);
          setMessage('');
          return;
        }
        setArmedChord(undefined);
        openChord(command.element, command.sectionId, command.lineId, command.offset, command.chordId);
        break;
      case 'remove-chord':
        removeChord(command.sectionId, command.lineId, command.chordId);
        if (
          target?.chordId === command.chordId &&
          target.sectionId === command.sectionId &&
          target.lineId === command.lineId
        ) {
          closeChord();
          requestAnimationFrame(() =>
            document.querySelector<HTMLTextAreaElement>(`#song-lyric-line-${command.lineId} textarea`)?.focus(),
          );
        }
        break;
      case 'copy-chord': {
        const chord = draft?.sections
          .find((section) => section.id === command.sectionId)
          ?.lines.find((line) => line.id === command.lineId)
          ?.chords.find((entry) => entry.id === command.chordId);
        if (!chord) break;
        setArmedChord(chord.value);
        closeChord();
        setMessage('');
        requestAnimationFrame(() =>
          document.querySelector<HTMLTextAreaElement>(`#song-lyric-line-${command.lineId} textarea`)?.focus(),
        );
        break;
      }
      case 'change-lyric':
        handleLyricChange(command.sectionId, command.lineIndex, command.value, command.caret);
        break;
      case 'lyric-key-down':
        handleLyricKeyDown(command.event, command.sectionId, command.lineIndex);
        break;
      case 'delete-line': {
        const section = draft?.sections.find((entry) => entry.id === command.sectionId);
        const lineIndex = section?.lines.findIndex((line) => line.id === command.lineId) ?? -1;
        if (!section || lineIndex < 0) break;
        const nextLineId = section.lines[lineIndex + 1]?.id ?? section.lines[lineIndex - 1]?.id ?? command.lineId;
        lines.remove(command.sectionId, command.lineId);
        if (target?.sectionId === command.sectionId && target.lineId === command.lineId) closeChord();
        requestAnimationFrame(() => {
          const selector = command.focusLine
            ? `#song-lyric-line-${nextLineId}`
            : `#song-lyric-line-${nextLineId} textarea`;
          document.querySelector<HTMLElement>(selector)?.focus();
        });
        break;
      }
      case 'insert-line-after': {
        const section = draft?.sections.find((entry) => entry.id === command.sectionId);
        const lineIndex = section?.lines.findIndex((line) => line.id === command.lineId) ?? -1;
        if (lineIndex < 0) break;
        const lineId = nanoid(12);
        lines.splice(command.sectionId, lineIndex + 1, 0, [{ id: lineId, text: '', chords: [] }]);
        requestAnimationFrame(() =>
          document.querySelector<HTMLTextAreaElement>(`#song-lyric-line-${lineId} textarea`)?.focus(),
        );
        break;
      }
      case 'duplicate-line':
        {
          const newLineId = lines.duplicate(command.sectionId, command.lineId);
          if (command.focusLine)
            requestAnimationFrame(() => document.getElementById(`song-lyric-line-${newLineId}`)?.focus());
        }
        break;
      case 'copy-line': {
        const source = draft?.sections
          .find((section) => section.id === command.sectionId)
          ?.lines.find((line) => line.id === command.lineId);
        copiedLine.current = source ? structuredClone(source) : null;
        break;
      }
      case 'paste-line': {
        const section = draft?.sections.find((entry) => entry.id === command.sectionId);
        const lineIndex = section?.lines.findIndex((line) => line.id === command.lineId) ?? -1;
        if (lineIndex < 0 || !copiedLine.current) break;
        const newLineId = nanoid(12);
        const pastedLine = {
          ...copiedLine.current,
          id: newLineId,
          chords: copiedLine.current.chords.map((chord) => ({ ...chord, id: nanoid(12) })),
        };
        lines.splice(command.sectionId, lineIndex + 1, 0, [pastedLine]);
        requestAnimationFrame(() => document.getElementById(`song-lyric-line-${newLineId}`)?.focus());
        break;
      }
    }
  };
  const pickFromPanel = (value: string) => {
    if (target) {
      const trigger = target.element;
      chooseChord(value);
      requestAnimationFrame(() => trigger.focus());
      return;
    }
    setArmedChord(value);
    setMessage('');
  };

  return (
    <Shell>
      <DragDropProvider
        onDragStart={(event) => {
          const source = event.operation.source;
          const element = isSortable(source) ? source.sortable.element : undefined;
          if (element?.parentElement) {
            dragOrigin.current = { element, parent: element.parentElement, nextSibling: element.nextSibling };
          }
        }}
        onDragEnd={(event) => {
          const origin = dragOrigin.current;
          dragOrigin.current = null;
          if (origin) {
            const { element, parent, nextSibling } = origin;
            if (element.parentElement !== parent || element.nextSibling !== nextSibling)
              parent.insertBefore(element, nextSibling?.parentNode === parent ? nextSibling : null);
          }
          const operation = getEditorDragEndOperation(event);
          if (!operation) return;
          const { source, target } = operation;
          if (source.kind === 'chord' && target.kind === 'lyric-slot') {
            placeChord(target.sectionId, target.lineId, target.offset, JSON.stringify(source));
            return;
          }
          if (!draft) return;
          if (source.kind === 'song-section' && target.kind === 'song-section') {
            const sourceId = `section:${source.sectionId}`;
            const reordered = move(
              draft.sections.map((section) => `section:${section.id}`),
              event,
            );
            const toIndex = reordered.indexOf(sourceId);
            if (toIndex >= 0) sections.reorder({ sourceId: source.sectionId, toIndex });
          } else if (source.kind === 'lyric-line' && target.kind === 'lyric-line') {
            const sourceId = `line:${source.sectionId}:${source.lineId}`;
            const grouped = Object.fromEntries(
              draft.sections.map((section) => [
                section.id,
                section.lines.map((line) => `line:${section.id}:${line.id}`),
              ]),
            );
            const destination = Object.entries(move(grouped, event)).find(([, ids]) => ids.includes(sourceId));
            if (destination) {
              lines.reorder({
                sourceId: source.lineId,
                scopeId: source.sectionId,
                targetScopeId: destination[0],
                toIndex: destination[1].indexOf(sourceId),
              });
            }
          }
        }}
      >
        <div className="song-editor-layout mx-auto w-full max-w-5xl pb-20 lg:pb-0">
          <PageHeader
            back={{
              href: isNewSong ? '/songs' : `/songs/${songId}`,
              label: isNewSong ? '곡 목록' : '곡 보기',
            }}
            title={isNewSong ? '새 곡' : '곡 수정'}
            actions={
              <>
                <Button label="취소" variant="secondary" icon={<X aria-hidden="true" />} onClick={cancel} />
                <Button
                  label="저장"
                  variant="primary"
                  icon={<Save aria-hidden="true" />}
                  isLoading={saveSong.isPending}
                  isDisabled={!draft || !userId || isPending}
                  onClick={save}
                />
              </>
            }
          />
          <SongEditorContent
            load={{
              isPending,
              isError,
              retry: () => {
                void refetch();
              },
            }}
            draft={draft}
            songActions={songActions}
            registerInput={registerInput}
            onLineCommand={handleLineCommand}
            onSectionCommand={handleSectionCommand}
            onAddSection={addSection}
            activeTarget={
              target
                ? {
                    sectionId: target.sectionId,
                    lineId: target.lineId,
                    offset: target.offset,
                    chordId: target.chordId,
                  }
                : undefined
            }
            armedChord={armedChord}
            sidePanel={
              !isPending && draft ? (
                <ChordPicker
                  targetKey={
                    target ? `${target.sectionId}:${target.lineId}:${target.offset}:${target.chordId ?? ''}` : undefined
                  }
                  existingChord={existingChord}
                  selectedChord={armedChord}
                  recentChords={recentChords}
                  message={target ? message : undefined}
                  onPick={pickFromPanel}
                  onRemoveChord={() => {
                    if (target?.chordId) {
                      handleLineCommand({
                        type: 'remove-chord',
                        sectionId: target.sectionId,
                        lineId: target.lineId,
                        chordId: target.chordId,
                      });
                    }
                  }}
                  onClearTarget={() => {
                    const trigger = target?.element;
                    closeChord();
                    requestAnimationFrame(() => trigger?.focus());
                  }}
                  onClearSelection={() => {
                    setArmedChord(undefined);
                    focusChordEditor();
                  }}
                />
              ) : undefined
            }
          />
          {!isPending && draft && !target && message && (
            <Banner status={message.startsWith('저장에 실패') ? 'error' : 'warning'} title={message} />
          )}
          {armedChord && (
            <HStack
              align="center"
              gap={3}
              role="status"
              data-selected-chord-toast
              className="fixed right-1/2 bottom-20 z-[60] w-max max-w-[calc(100vw-2rem)] translate-x-1/2 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white shadow-xl lg:bottom-6"
            >
              <Text as="span" className="shrink-0 rounded-md bg-neutral-700 px-2 py-1 font-mono font-semibold">
                {armedChord}
              </Text>
              <Text as="span" className="min-w-0 text-sm">
                가사 위치를 눌러 배치 · Esc 취소
              </Text>
              <IconButton
                label="코드 선택 해제"
                tooltip="코드 선택 해제 (Esc)"
                variant="ghost"
                size="sm"
                icon={<X aria-hidden="true" className="h-4 w-4" />}
                onClick={() => {
                  setArmedChord(undefined);
                  focusChordEditor();
                }}
              />
            </HStack>
          )}
        </div>
      </DragDropProvider>
    </Shell>
  );
};

export default SongEditor;
