'use client';

import { LinkProvider } from '@astryxdesign/core/Link';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PadUtilityPanel } from '@/components/pad-utility-panel';
import { PadProvider } from '@/features/pads/pad-provider';
import { UtilityProvider } from '@/features/pads/utility-provider';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }),
  );
  return (
    <Theme theme={neutralTheme} mode="dark">
      <LinkProvider component={Link}>
        <QueryClientProvider client={queryClient}>
          <PadProvider>
            <UtilityProvider>
              {children}
              <PadUtilityPanel />
            </UtilityProvider>
          </PadProvider>
        </QueryClientProvider>
      </LinkProvider>
    </Theme>
  );
};
