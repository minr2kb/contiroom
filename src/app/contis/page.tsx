'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Globe, LockKeyhole, LogIn, Plus } from 'lucide-react';
import { useAuthDialog } from '@/components/auth-dialog';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageContent, Shell } from '@/components/shell';
import { queries } from '@/lib/data-api';
import { useCurrentUserId } from '@/lib/use-current-user-id';

const ContisList = ({ userId }: { userId: string | null }) => {
  const openLogin = useAuthDialog();
  const contisQuery = useQuery({ ...queries.listContis(), enabled: Boolean(userId), throwOnError: true });
  const contis = (contisQuery.data ?? []).filter((conti) => conti.ownerId === userId);
  if (!userId)
    return (
      <EmptyState
        title="로그인이 필요합니다"
        actions={<Button label="로그인" icon={<LogIn aria-hidden="true" />} onClick={openLogin} />}
      />
    );
  if (contisQuery.isPending) return <Spinner label="콘티 목록을 불러오는 중…" />;
  if (contis.length === 0) {
    return (
      <VStack paddingBlock={10} align="center">
        <EmptyState
          title="아직 등록된 콘티가 없습니다"
          actions={
            userId ? (
              <Button label="새 콘티" variant="primary" icon={<Plus aria-hidden="true" />} href="/contis/new/edit" />
            ) : undefined
          }
        />
      </VStack>
    );
  }

  return (
    <List density="spacious" hasDividers>
      {contis.map((conti) => (
        <ListItem
          key={conti.id}
          href={`/contis/${conti.id}`}
          label={
            <HStack as="span" align="center" gap={2}>
              <Text as="span" type="large">
                {conti.title}
              </Text>
              <Badge
                label={conti.visibility === 'public' ? '전체 공개' : '비공개'}
                icon={
                  conti.visibility === 'public' ? (
                    <Globe aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                  )
                }
              />
            </HStack>
          }
          description={
            <Text as="span" type="supporting">
              {conti.scheduledDate ? `${conti.scheduledDate} · ` : ''}
              {conti.items.length}곡
            </Text>
          }
          endContent={<ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" />}
        />
      ))}
    </List>
  );
};

const ContisPage = () => {
  const userId = useCurrentUserId();
  return (
    <Shell>
      <PageContent>
        <PageHeader
          title="콘티"
          description="곡 순서와 송폼을 정리하고 예배를 준비하세요."
          actions={
            userId ? (
              <Button label="새 콘티" variant="primary" icon={<Plus aria-hidden="true" />} href="/contis/new/edit" />
            ) : undefined
          }
        />
        <VStack as="section" aria-label="콘티 목록">
          <QueryBoundary loadingLabel="콘티 목록을 불러오는 중…" errorTitle="콘티 목록을 불러오지 못했습니다">
            <ContisList userId={userId} />
          </QueryBoundary>
        </VStack>
      </PageContent>
    </Shell>
  );
};

export default ContisPage;
