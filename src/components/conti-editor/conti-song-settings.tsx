import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Plus } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { SortableFormStep } from '@/components/conti-sortable-items';
import type { ContiSongChange } from '@/features/conti-editor/conti-song-change';
import type { ContiItem, Song } from '@/lib/model';
import { MUSIC_KEYS } from '@/lib/music';

type Props = {
  item: ContiItem;
  song?: Song;
  onChange: (change: ContiSongChange) => void;
};

export function ContiSongSettings({ item, song, onChange }: Props) {
  const formListRef = useRef<HTMLElement>(null);
  const shouldScrollToEnd = useRef(false);

  useLayoutEffect(() => {
    if (!shouldScrollToEnd.current) return;
    shouldScrollToEnd.current = false;
    formListRef.current?.scrollTo({ left: formListRef.current.scrollWidth, behavior: 'smooth' });
  }, [item.form.length]);

  if (!song) {
    return (
      <Card padding={6}>
        <Text type="supporting">원곡을 사용할 수 없어 설정을 편집할 수 없습니다.</Text>
      </Card>
    );
  }

  return (
    <Card padding={6}>
      <VStack gap={6}>
        <Grid columns={{ minWidth: 180, max: 2, repeat: 'fit' }} align="end" gap={4}>
          <Selector
            label="이 콘티의 키"
            options={[...MUSIC_KEYS]}
            value={item.key || song.baseKey}
            onChange={(value) => onChange({ type: 'key', value })}
          />
          <NumberInput
            label="BPM"
            isOptional
            min={1}
            max={300}
            value={item.bpm ?? song.bpm}
            onChange={(value) => onChange({ type: 'bpm', value })}
          />
        </Grid>
        <HStack align="center" justify="between" gap={4}>
          <Heading level={3}>송폼</Heading>
          <Button
            label="섹션 추가"
            variant="secondary"
            size="sm"
            icon={<Plus />}
            onClick={() => {
              if (song.sections[0]) {
                shouldScrollToEnd.current = true;
                onChange({ type: 'form/add', sectionId: song.sections[0].id });
              }
            }}
          />
        </HStack>
        <HStack
          as="ol"
          align="center"
          gap={2}
          minHeight={48}
          isScrollable
          ref={formListRef}
          paddingInlineStart={0}
          paddingBlockEnd={2}
          className="m-0 list-none"
        >
          {item.form.map((step, index) => (
            <SortableFormStep
              key={step.id}
              step={step}
              index={index}
              itemId={item.id}
              sections={song.sections}
              onSelect={(sectionId) => onChange({ type: 'form/select', stepId: step.id, sectionId })}
              onRemove={() => onChange({ type: 'form/remove', stepId: step.id })}
            />
          ))}
          {item.form.length === 0 && (
            <VStack as="li">
              <Text type="supporting">송폼이 비어 있습니다.</Text>
            </VStack>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}
