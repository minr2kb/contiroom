import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
};

export const PageHeader = ({ title, description, back, actions }: PageHeaderProps) => (
  <header className="mb-5 w-full">
    {back && (
      <div className="mb-5">
        <Link
          href={back.href}
          color="secondary"
          isStandalone
          className="inline-flex rounded-sm text-base transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            {back.label}
          </span>
        </Link>
      </div>
    )}
    <HStack align="start" justify="between" gap={2}>
      <Heading
        level={1}
        className="min-w-0 text-[clamp(2rem,4vw,3.25rem)] leading-tight tracking-tight text-white"
        style={{ overflowWrap: 'anywhere' }}
      >
        {title}
      </Heading>
      {actions && (
        <HStack wrap="wrap" align="center" justify="end" gap={3} className="min-w-0">
          {actions}
        </HStack>
      )}
    </HStack>
    {description && (
      <Text as="p" type="supporting" className="mt-2 whitespace-pre-line text-neutral-400">
        {description}
      </Text>
    )}
  </header>
);
