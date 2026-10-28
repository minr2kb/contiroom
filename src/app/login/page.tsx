import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error ? '로그인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요.' : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-5 text-white">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#DF87FF]">CONTIROOM</p>
        <h1 className="mt-4 text-3xl font-bold">로그인</h1>
        {errorMessage && (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {errorMessage}
          </p>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
