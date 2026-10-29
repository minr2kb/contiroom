'use client';

import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  Pencil,
  Plus,
  Presentation,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { DetailList } from '@/components/detail-list';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageContent, Shell } from '@/components/shell';
import { queries } from '@/lib/data-api';
import { useCurrentUserId } from '@/lib/use-current-user-id';

const ContiItems = ({ contiId }: { contiId: string }) => {
  const userId = useCurrentUserId();
  const [songsQuery, contisQuery] = useQueries({
    queries: [
      { ...queries.listContiSongs({ path: { id: contiId } }), throwOnError: true },
      { ...queries.listContis(), throwOnError: true },
    ],
  });
  if (songsQuery.isPending || contisQuery.isPending) return <Spinner label="콘티를 불러오는 중…" />;
  const songs = songsQuery.data ?? [];
  const contis = contisQuery.data ?? [];
  const conti = contis.find((entry) => entry.id === contiId);

  if (!conti) {
    return <EmptyState title="콘티를 찾을 수 없습니다" actions={<Button label="콘티 목록" href="/contis" />} />;
  }

  if (conti.items.length === 0) {
    return (
      <VStack paddingBlock={10} align="center">
        <EmptyState
          title="아직 곡이 없습니다"
          description={userId === conti.ownerId ? '수정을 눌러 곡을 추가하세요.' : undefined}
          actions={
            userId === conti.ownerId ? (
              <Button
                label="곡 추가"
                variant="primary"
                icon={<Plus aria-hidden="true" />}
                href={`/contis/${conti.id}/edit`}
              />
            ) : undefined
          }
        />
      </VStack>
    );
  }

  return (
    <List density="spacious" hasDividers aria-label="콘티 곡 순서">
      {conti.items.map((entry, index: number) => {
        const song = songs.find((candidate) => candidate.id === entry.songId);
        const songKey = entry.key || song?.baseKey;
        const bpm = entry.bpm ?? song?.bpm;
        const formChanged = Boolean(
          song && entry.form.some((step) => !song.sections.some((section) => section.id === step.sectionId)),
        );
        const sections = entry.form.reduce<{ sectionId: string; name: string; count: number }[]>((groups, step) => {
          const name = song?.sections.find((section) => section.id === step.sectionId)?.name ?? '섹션';
          const previous = groups[groups.length - 1];
          if (previous?.sectionId === step.sectionId) previous.count += 1;
          else groups.push({ sectionId: step.sectionId, name, count: 1 });
          return groups;
        }, []);
        return (
          <ListItem
            key={entry.id}
            href={
              song
                ? `/songs/${entry.songId}?contiId=${encodeURIComponent(conti.id)}&itemId=${encodeURIComponent(entry.id)}`
                : undefined
            }
            startContent={
              <Text as="span" type="supporting" hasTabularNumbers justify="center" className="w-6">
                {String(index + 1).padStart(2, '0')}
              </Text>
            }
            label={
              <HStack as="span" align="center" gap={2}>
                <Text as="span" type="large" maxLines={1}>
                  {song?.title ?? '사용할 수 없는 곡'}
                </Text>
                <Text
                  as="span"
                  type="code"
                  color="secondary"
                  className="shrink-0"
                  style={songKey ? { color: '#DF87FF' } : undefined}
                >
                  {songKey || '키 미설정'}
                </Text>
                {bpm != null && (
                  <Text as="span" type="supporting" className="shrink-0">
                    · {bpm} BPM
                  </Text>
                )}
              </HStack>
            }
            description={
              formChanged ? (
                <Text as="span" type="supporting">
                  곡 구성이 변경되었습니다. 콘티의 송폼을 확인하세요.
                </Text>
              ) : sections.length > 0 ? (
                <HStack as="span" wrap="wrap" gap={1} className="mt-1">
                  {sections.map((section, sectionIndex) => (
                    <Badge
                      key={`${entry.id}-${sectionIndex}`}
                      label={`${section.name}${section.count > 1 ? ` ×${section.count}` : ''}`}
                    />
                  ))}
                </HStack>
              ) : undefined
            }
            endContent={song ? <ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" /> : undefined}
            className="px-0"
          />
        );
      })}
    </List>
  );
};

export default function ContiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const { data: contis = [] } = useQuery(queries.listContis());
  const conti = contis.find((entry) => entry.id === id);
  const userId = useCurrentUserId();
  const isOwner = Boolean(userId && conti?.ownerId === userId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const visibilityMutation = useMutation(
    queries.saveConti({
      onSuccess: async (savedConti) => {
        await queryClient.invalidateQueries({ queryKey: queries.listContis.queryKey() });
        showToast({
          body: `공개 범위를 ${savedConti.visibility === 'public' ? '전체 공개' : '비공개'}로 변경했습니다.`,
        });
      },
      onError: () => showToast({ body: '공개 범위를 변경하지 못했습니다.', type: 'error' }),
    }),
  );
  const deletion = useMutation(
    queries.deleteConti({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: queries.listContis.queryKey() });
        showToast({ body: '콘티를 삭제했습니다.' });
        router.replace('/contis');
      },
      onError: () => showToast({ body: '콘티를 삭제하지 못했습니다. 다시 시도하세요.', type: 'error' }),
    }),
  );
  const deleteConti = async () => {
    if (deletion.isPending) return;
    try {
      await deletion.mutateAsync({ path: { id } });
    } catch {
      // The mutation exposes the error to the page.
    }
  };

  return (
    <Shell>
      <PageContent>
        <PageHeader
          title={conti?.title || '콘티'}
          description={
            conti ? (
              <>
                {[conti.scheduledDate, `${conti.items.length}곡`].filter(Boolean).join(' · ')} ·{' '}
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
              </>
            ) : undefined
          }
          back={{ href: '/contis', label: '콘티 목록' }}
          actions={
            conti && (
              <>
                <MoreMenu
                  label="콘티 메뉴"
                  alignment="end"
                  presentation="adaptive"
                  variant="secondary"
                  items={[
                    ...(isOwner
                      ? [
                          {
                            label: conti.visibility === 'public' ? '비공개로 전환' : '전체 공개로 전환',
                            icon:
                              conti.visibility === 'public' ? (
                                <EyeOff aria-hidden="true" className="h-4 w-4" />
                              ) : (
                                <Eye aria-hidden="true" className="h-4 w-4" />
                              ),
                            onClick: () => {
                              if (visibilityMutation.isPending) return;
                              visibilityMutation.mutate({
                                body: { ...conti, visibility: conti.visibility === 'public' ? 'private' : 'public' },
                              });
                            },
                          },
                          {
                            label: '수정',
                            href: `/contis/${conti.id}/edit`,
                            icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                          },
                        ]
                      : []),
                    {
                      label: '다운로드',
                      href: `/print?contiId=${encodeURIComponent(conti.id)}`,
                      target: '_blank',
                      icon: <Download aria-hidden="true" className="h-4 w-4" />,
                      rel: 'noopener noreferrer',
                    },
                    ...(isOwner
                      ? [
                          {
                            label: '삭제',
                            icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                            variant: 'destructive' as const,
                            onClick: () => setIsDeleteOpen(true),
                          },
                        ]
                      : []),
                  ]}
                />
                <Button
                  label="라이브"
                  variant="primary"
                  icon={<Presentation aria-hidden="true" />}
                  href={`/live/${conti.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </>
            )
          }
        />
        {conti && (
          <DetailList
            items={[
              { label: '제작자', value: conti.creatorHandle ? `@${conti.creatorHandle}` : '미등록' },
              ...(conti.createdAt
                ? [
                    {
                      label: '제작일',
                      value: new Date(conti.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
                    },
                  ]
                : []),
              ...(conti.youtubePlaylistUrl
                ? [
                    {
                      label: '플레이리스트',
                      value: (
                        <a
                          href={conti.youtubePlaylistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-md text-red-300 underline decoration-red-300/50 underline-offset-4 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                        >
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
                          YouTube에서 열기
                        </a>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
        <AlertDialog
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="콘티를 삭제할까요?"
          description={`‘${conti?.title ?? '이 콘티'}’를 삭제하면 되돌릴 수 없습니다.`}
          cancelLabel="취소"
          actionLabel="삭제"
          isActionLoading={deletion.isPending}
          onAction={deleteConti}
        />
        <QueryBoundary loadingLabel="콘티를 불러오는 중…" errorTitle="콘티를 불러오지 못했습니다">
          <ContiItems contiId={id} />
        </QueryBoundary>
      </PageContent>
    </Shell>
  );
}
