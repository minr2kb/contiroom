'use client';

import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, type Dispatch, type SetStateAction, Suspense, useContext, useEffect, useState } from 'react';
import { OnboardingForm } from '@/components/onboarding-form';
import { authReturnPath } from '@/lib/auth-return-path';
import { createClient } from '@/lib/supabase/client';

const AuthDialogContext = createContext<() => void>(() => {});

export const useAuthDialog = () => useContext(AuthDialogContext);

const AuthQueryOpener = ({
  setOpen,
  setMessage,
  setOnboarding,
}: {
  setOpen: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string>>;
  setOnboarding: Dispatch<SetStateAction<boolean>>;
}) => {
  const searchParams = useSearchParams();
  const login = searchParams.get('login');
  const onboarding = searchParams.has('onboarding');
  useEffect(() => {
    if (login) {
      setOpen(true);
      if (login === 'error') setMessage('Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
    }
    setOnboarding(onboarding);
  }, [login, onboarding, setOpen, setMessage, setOnboarding]);
  return null;
};

export const AuthDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [onboarding, setOnboarding] = useState(false);

  const close = () => {
    setOpen(false);
    setMessage('');
    const url = new URL(window.location.href);
    if (url.searchParams.has('login')) {
      url.searchParams.delete('login');
      url.searchParams.delete('next');
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }
  };

  const signIn = async () => {
    setPending(true);
    setMessage('');
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next');
    url.searchParams.delete('login');
    url.searchParams.delete('next');
    const returnTo = next ? authReturnPath(next) : `${url.pathname}${url.search}${url.hash}`;
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', returnTo);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.toString() },
      });
      if (error) throw error;
    } catch {
      setMessage('Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요.');
      setPending(false);
    }
  };

  return (
    <AuthDialogContext.Provider value={() => setOpen(true)}>
      {children}
      <Suspense fallback={null}>
        <AuthQueryOpener setOpen={setOpen} setMessage={setMessage} setOnboarding={setOnboarding} />
      </Suspense>
      <Dialog isOpen={open} onOpenChange={(isOpen) => !isOpen && close()} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="로그인" onOpenChange={(isOpen) => !isOpen && close()} />}
          content={
            <LayoutContent className="mt-5">
              <Button
                label={pending ? '연결 중...' : 'Google로 계속하기'}
                onClick={() => void signIn()}
                icon={<Image src="/google_logo.svg" alt="Google" width={20} height={20} />}
                isDisabled={pending}
                className="w-full h-12"
                size="lg"
                variant="primary"
              />
              {message && <Text type="supporting">{message}</Text>}
            </LayoutContent>
          }
        />
      </Dialog>
      <Dialog isOpen={onboarding} onOpenChange={() => {}} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="핸들 만들기" subtitle="곡과 콘티에 표시될 이름이에요." />}
          content={
            <LayoutContent>
              <OnboardingForm />
            </LayoutContent>
          }
        />
      </Dialog>
    </AuthDialogContext.Provider>
  );
};
