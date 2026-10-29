'use client';

import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Selector } from '@astryxdesign/core/Selector';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

export type DisplayOptions = {
  count: 1 | 2 | 3;
  showChords: boolean;
  showForm: boolean;
  showNextLyrics: boolean;
  showTranslations: boolean;
};

export type LiveOptionsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  options: DisplayOptions;
  onChange: (change: Partial<DisplayOptions>) => void;
  pauseImageUrl: string | null;
  pauseImageError: boolean;
  onPauseImageChange: (file: File | null) => void;
};

export const LiveOptionsDialog = ({
  isOpen,
  onOpenChange,
  options,
  onChange,
  pauseImageUrl,
  pauseImageError,
  onPauseImageChange,
}: LiveOptionsDialogProps) => (
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
      <Switch
        label="번역 가사 표시"
        value={options.showTranslations}
        onChange={(value) => onChange({ showTranslations: value })}
        labelPosition="start"
        labelSpacing="spread"
        width="100%"
      />
      <VStack gap={2}>
        <label htmlFor="live-pause-image">휴식 화면 이미지</label>
        <Text color="secondary">
          16:9 비율의 이미지를 권장합니다. 이 브라우저에만 저장됩니다. 이미지가 없으면 콘티룸 로고가 표시됩니다.
        </Text>
        <input
          id="live-pause-image"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onPauseImageChange(file);
            event.currentTarget.value = '';
          }}
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-700 file:px-3 file:py-2 file:text-white"
        />
        {pauseImageUrl && (
          <button type="button" className="w-fit text-sm underline" onClick={() => onPauseImageChange(null)}>
            이미지 제거
          </button>
        )}
        {pauseImageError && (
          <Text role="alert">이미지를 저장하거나 불러오지 못했습니다. 브라우저 저장 공간을 확인하세요.</Text>
        )}
      </VStack>
    </VStack>
  </Dialog>
);
