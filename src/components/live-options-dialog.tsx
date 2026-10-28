'use client';

import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Selector } from '@astryxdesign/core/Selector';
import { Switch } from '@astryxdesign/core/Switch';
import { VStack } from '@astryxdesign/core/VStack';

export type DisplayOptions = {
  count: 1 | 2 | 3;
  showChords: boolean;
  showForm: boolean;
  showNextLyrics: boolean;
};

export type LiveOptionsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  options: DisplayOptions;
  onChange: (change: Partial<DisplayOptions>) => void;
};

export const LiveOptionsDialog = ({ isOpen, onOpenChange, options, onChange }: LiveOptionsDialogProps) => (
  <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
    <DialogHeader title="화면 설정" onOpenChange={onOpenChange} />
    <VStack gap={5} className="pt-5">
      <Selector
        label="표시 줄 수"
        options={[
          { label: '1줄', value: '1' },
          { label: '2줄', value: '2' },
          { label: '3줄', value: '3' },
        ]}
        value={String(options.count)}
        onChange={(value) => onChange({ count: Number(value) as 1 | 2 | 3 })}
      />
      <Switch
        label="코드 표시"
        value={options.showChords}
        onChange={(value) => onChange({ showChords: value })}
        labelPosition="start"
        labelSpacing="spread"
        width="100%"
      />
      <Switch
        label="하단 송폼 배지 표시"
        value={options.showForm}
        onChange={(value) => onChange({ showForm: value })}
        labelPosition="start"
        labelSpacing="spread"
        width="100%"
      />
      <Switch
        label="다음 가사 표시"
        value={options.showNextLyrics}
        onChange={(value) => onChange({ showNextLyrics: value })}
        labelPosition="start"
        labelSpacing="spread"
        width="100%"
      />
    </VStack>
  </Dialog>
);
