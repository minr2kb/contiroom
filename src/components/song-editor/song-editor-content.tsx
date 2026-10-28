import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { Plus, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { SongSectionEditor } from '@/components/song-section-editor';
import type { LineEditorCommand, SectionEditorCommand } from '@/features/song-editor/editor-commands';
import type { useLyricEditor } from '@/features/song-editor/use-lyric-editor';
import type { useSongDraft } from '@/features/song-editor/use-song-draft';
import type { Song } from '@/lib/model';
import { MUSIC_KEYS } from '@/lib/music';

type SongEditorContentProps = {
  load: { isPending: boolean; isError: boolean; retry: () => void };
  draft?: Song;
  songActions: ReturnType<typeof useSongDraft>['song'];
  registerInput: ReturnType<typeof useLyricEditor>['registerInput'];
  onLineCommand: (command: LineEditorCommand) => void;
  onSectionCommand: (command: SectionEditorCommand) => void;
  onAddSection: () => void;
  sidePanel?: ReactNode;
  activeTarget?: { sectionId: string; lineId: string; offset: number; chordId?: string };
  armedChord?: string;
};

export const SongEditorContent = ({
  load,
  draft,
  songActions,
  registerInput,
  onLineCommand,
  onSectionCommand,
  onAddSection,
  sidePanel,
  activeTarget,
  armedChord,
}: SongEditorContentProps) => {
  if (load.isPending) {
    return (
      <VStack paddingBlock={10} align="center">
        <Spinner label="곡을 불러오는 중…" />
      </VStack>
    );
  }

  if (!draft) {
    if (load.isError) {
      return (
        <Banner
          status="error"
          title="곡을 불러오지 못했습니다"
          endContent={<Button label="다시 시도" icon={<RotateCw aria-hidden="true" />} onClick={load.retry} />}
        />
      );
    }
    return <EmptyState title="곡을 찾을 수 없습니다" actions={<Button label="곡 목록" href="/songs" />} />;
  }

  return (
    <>
      {load.isError && (
        <Banner
          status="error"
          title="곡 목록을 불러오지 못했습니다"
          endContent={<Button label="다시 시도" icon={<RotateCw aria-hidden="true" />} onClick={load.retry} />}
        />
      )}
      <Grid columns={{ minWidth: 180, max: 3, repeat: 'fit' }} gap={5} align="end">
        <TextInput label="곡 제목" value={draft.title} onChange={songActions.setTitle} />
        <TextInput label="아티스트 · 연주 팀" value={draft.artist ?? ''} onChange={songActions.setArtist} />
        <Selector
          label="기준 키"
          options={draft.baseKey === '키 미설정' ? ['키 미설정', ...MUSIC_KEYS] : [...MUSIC_KEYS]}
          value={draft.baseKey}
          onChange={songActions.setKey}
        />
        <NumberInput label="BPM" isOptional min={1} max={300} value={draft.bpm} onChange={songActions.setBpm} />
        <Selector
          label="공개 범위"
          options={['비공개', '전체공개']}
          value={draft.visibility === 'public' ? '전체공개' : '비공개'}
          onChange={(value) => songActions.setVisibility(value === '전체공개' ? 'public' : 'private')}
        />
      </Grid>
      <Text as="span" type="supporting" className="my-4 block">
        가사 위 위치를 선택해 코드를 놓으세요. 줄 왼쪽의 +로 추가하고 손잡이로 이동할 수 있습니다. 가사 입력 중
        Ctrl/⌘+D로 줄을 복제할 수 있습니다.
      </Text>
      <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <div className="min-w-0">
          {draft.sections.map((section, index) => (
            <SongSectionEditor
              key={section.id}
              section={section}
              index={index}
              inputRef={registerInput}
              onLineCommand={onLineCommand}
              onSectionCommand={onSectionCommand}
              activeLineId={activeTarget?.sectionId === section.id ? activeTarget.lineId : undefined}
              activeChordId={activeTarget?.sectionId === section.id ? activeTarget.chordId : undefined}
              activeSlotOffset={
                !armedChord && activeTarget?.sectionId === section.id && !activeTarget.chordId
                  ? activeTarget.offset
                  : undefined
              }
              armedChord={armedChord}
            />
          ))}
          <HStack paddingBlockStart={2} paddingBlockEnd={8}>
            <Button label="섹션 추가" variant="secondary" icon={<Plus />} onClick={onAddSection} />
          </HStack>
        </div>
        {sidePanel}
      </div>
    </>
  );
};
