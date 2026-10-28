'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

const handlePattern = /^[a-z0-9_]{1,30}$/;

export const OnboardingForm = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!handlePattern.test(handle)) {
      setMessage('영문 소문자, 숫자, 밑줄(_)만 사용해 1~30자로 입력해 주세요.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setMessage(result.error ?? '핸들을 저장하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      queryClient.clear();
      router.replace('/');
      router.refresh();
    } catch {
      setMessage('연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };

  const signOut = async () => {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setPending(false);
    if (error) {
      setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label htmlFor="handle" className="block text-sm font-medium text-neutral-200">내 핸들</label>
      <div className="flex overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 focus-within:border-[#DF87FF]">
        <span className="px-4 py-3 text-neutral-400">@</span>
        <input
          id="handle"
          name="handle"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={30}
          pattern="[a-z0-9_]+"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-white outline-none"
          placeholder="your_name"
        />
      </div>
      <p className="text-xs text-neutral-500">핸들은 등록 후 변경할 수 없습니다.</p>
      {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#DF87FF] px-5 py-3 font-semibold text-black disabled:opacity-50">
        {pending ? '저장 중...' : '시작하기'}
      </button>
      <button type="button" onClick={signOut} disabled={pending} className="w-full text-sm text-neutral-400 hover:text-white disabled:opacity-50">
        다른 계정으로 로그인
      </button>
    </form>
  );
};
