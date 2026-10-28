'use client';

import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, type Dispatch, type SetStateAction, Suspense, useContext, useEffect, useState } from 'react';
import { authReturnPath } from '@/lib/auth-return-path';
import { createClient } from '@/lib/supabase/client';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import Image from 'next/image';

const AuthDialogContext = createContext<() => void>(() => {});

export const useAuthDialog = () => useContext(AuthDialogContext);

const AuthQueryOpener = ({
  setOpen,
  setMessage,
}: {
  setOpen: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string>>;
}) => {
  const login = useSearchParams().get('login');
  useEffect(() => {
    if (login) {
      setOpen(true);
      if (login === 'error') setMessage('Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
    }
  }, [login, setOpen, setMessage]);
  return null;
};

export const AuthDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

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
        <AuthQueryOpener setOpen={setOpen} setMessage={setMessage} />
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
    </AuthDialogContext.Provider>
  );
};
