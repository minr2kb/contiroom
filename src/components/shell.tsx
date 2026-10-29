'use client';

import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { HStack } from '@astryxdesign/core/HStack';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { VStack } from '@astryxdesign/core/VStack';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Library, ListMusic, LogOut } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthDialog } from '@/components/auth-dialog';
import { createClient } from '@/lib/supabase/client';

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const openLogin = useAuthDialog();
  const [supabase] = useState(createClient);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  useEffect(() => {
    let active = true;
    let requestId = 0;
    let profileRetries = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let profileRetryTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshClaims = async () => {
      const currentRequest = ++requestId;
      const { data, error } = await supabase.auth.getClaims();
      if (active && currentRequest === requestId) {
        const authenticated = !error && typeof data?.claims?.sub === 'string';
        setIsAuthenticated(authenticated);
        if (!authenticated) {
          setProfileHandle(null);
          return;
        }
        try {
          const response = await fetch('/api/me/profile', { cache: 'no-store' });
          if (!response.ok) throw new Error('Profile request failed');
          const result = (await response.json()) as { profile: { handle: string } | null };
          if (active && currentRequest === requestId) setProfileHandle(result.profile?.handle ?? null);
        } catch {
          if (active && currentRequest === requestId) {
            setProfileHandle(null);
            if (profileRetries < 1) {
              profileRetries++;
              profileRetryTimer = setTimeout(() => void refreshClaims(), 3000);
            }
          }
        }
      }
    };
    void refreshClaims();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      requestId++;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (profileRetryTimer) clearTimeout(profileRetryTimer);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') profileRetries = 0;
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setProfileHandle(null);
        queryClient.clear();
        return;
      }
      if (event === 'SIGNED_IN') setProfileHandle(null);
      refreshTimer = setTimeout(() => void refreshClaims(), 0);
    });
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (profileRetryTimer) clearTimeout(profileRetryTimer);
      listener.subscription.unsubscribe();
    };
  }, [queryClient, supabase]);

  const handleLogout = async () => {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);
    if (error) return;
    queryClient.clear();
    router.refresh();
  };
  const exploreActive = pathname === '/';
  const songsActive = pathname.startsWith('/songs');
  const contisActive = pathname.startsWith('/contis');
  const selectedLabelClass =
    'relative after:absolute after:bottom-[-5px] after:left-1/2 after:h-[2px] after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-[#DF87FF]';
  return (
    <VStack minHeight="100dvh" className="bg-black text-white">
      <VStack as="header" className="border-b border-neutral-800 bg-black">
        <TopNav
          label="주 메뉴"
          className="mx-auto min-h-20 w-full max-w-[1440px] px-3 sm:px-8 lg:px-14"
          heading={
            <TopNavHeading
              logo={<Image src="/contiroom-logo.svg" alt="콘티룸" width={78} height={40} />}
              headingHref="/"
            />
          }
          startContent={
            <>
              <TopNavItem label="탐색" href="/" isSelected={exploreActive}>
                <span className={`inline-flex items-center gap-1.5 ${exploreActive ? selectedLabelClass : ''}`}>
                  <Compass aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">탐색</span>
                </span>
              </TopNavItem>
              <TopNavItem label="곡 라이브러리" href="/songs" isSelected={songsActive}>
                <span className={`inline-flex items-center gap-1.5 ${songsActive ? selectedLabelClass : ''}`}>
                  <Library aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">곡 라이브러리</span>
                </span>
              </TopNavItem>
              <TopNavItem label="콘티" href="/contis" isSelected={contisActive}>
                <span className={`inline-flex items-center gap-1.5 ${contisActive ? selectedLabelClass : ''}`}>
                  <ListMusic aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">콘티</span>
                </span>
              </TopNavItem>
            </>
          }
          endContent={
            <HStack align="center" gap={2}>
              {isAuthenticated === null ? null : isAuthenticated ? (
                <DropdownMenu
                  button={{
                    label: profileHandle ? `@${profileHandle}` : '계정',
                    variant: 'ghost',
                    isDisabled: isSigningOut,
                  }}
                  hasChevron
                  alignment="end"
                  items={[
                    {
                      label: '로그아웃',
                      icon: <LogOut aria-hidden="true" className="h-4 w-4" />,
                      onClick: handleLogout,
                    },
                  ]}
                />
              ) : (
                <button type="button" onClick={openLogin} className="text-sm text-neutral-400 hover:text-white">
                  로그인
                </button>
              )}
            </HStack>
          }
        />
      </VStack>
      <VStack as="main" className="mx-auto w-full max-w-[1440px] px-5 pt-10 pb-24 sm:px-10 sm:pt-14 lg:px-16">
        {children}
      </VStack>
    </VStack>
  );
};
export const PageContent = ({ children }: { children: React.ReactNode }) => (
  <VStack width="100%" maxWidth={960} className="mx-auto">
    {children}
  </VStack>
);
