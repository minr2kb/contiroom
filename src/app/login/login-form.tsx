'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

const INVALID_LOGIN = '이메일 또는 비밀번호를 확인해 주세요.';

export const LoginForm = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [supabase] = useState(createClient);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get('email');
    const password = formData.get('password');
    const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof password !== 'string' ||
      !password ||
      password.length > 1024
    ) {
      setMessage(INVALID_LOGIN);
      return;
    }

    setPending(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.status === 429 ? '로그인 시도 제한에 걸렸습니다. 잠시 기다린 뒤 다시 시도해 주세요.' : INVALID_LOGIN);
      setPending(false);
      return;
    }

    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || typeof claims?.claims?.sub !== 'string') {
      await supabase.auth.signOut();
      setMessage(INVALID_LOGIN);
      setPending(false);
      return;
    }

    queryClient.clear();
    try {
      const profileResponse = await fetch('/api/me/profile', { cache: 'no-store' });
      if (!profileResponse.ok) {
        setMessage('프로필을 확인하지 못했습니다. 다시 시도해 주세요.');
        setPending(false);
        return;
      }
      const result = (await profileResponse.json()) as { profile: { handle: string } | null };
      router.replace(result.profile ? '/' : '/onboarding');
      router.refresh();
    } catch {
      setMessage('프로필을 확인하지 못했습니다. 다시 시도해 주세요.');
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <label htmlFor="email" className="block text-sm font-medium text-neutral-200">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-[#DF87FF]"
      />
      <label htmlFor="password" className="block text-sm font-medium text-neutral-200">
        비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-[#DF87FF]"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#DF87FF] px-5 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '로그인 중...' : '로그인'}
      </button>
      {message && (
        <p role="alert" className="text-sm text-red-300">
          {message}
        </p>
      )}
    </form>
  );
};
