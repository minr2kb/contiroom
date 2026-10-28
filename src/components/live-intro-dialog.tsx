'use client';

import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

export type LiveIntroDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  hideForDay: boolean;
  onHideForDayChange: (value: boolean) => void;
};

export const LiveIntroDialog = ({ isOpen, onOpenChange, hideForDay, onHideForDayChange }: LiveIntroDialogProps) => (
  <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="info" width={520}>
    <DialogHeader title="라이브 화면 사용 안내" onOpenChange={onOpenChange} />
    <VStack gap={4} className="pt-5">
      <Text>화면 왼쪽/오른쪽 절반을 클릭하거나 ←/→ 키로 슬라이드를 넘깁니다. Cmd/Ctrl+←/→ 키로 섹션을 이동합니다.</Text>
      <Text>
        F 키로 전체화면을 켜거나 끄고, Esc 키로 전체화면을 종료합니다. 오른쪽 위에서 표시 내용을 조정할 수 있습니다.
      </Text>
      <Text>P 키로 현재 곡의 패드를 켜거나 끕니다. 패드를 받지 않았다면 유틸리티가 열립니다.</Text>
      <CheckboxInput label="하루 동안 보지 않기" value={hideForDay} onChange={onHideForDayChange} />
      <Button label="알겠어요" variant="primary" onClick={() => onOpenChange(false)} />
    </VStack>
  </Dialog>
);
