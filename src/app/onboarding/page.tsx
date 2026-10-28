import { OnboardingForm } from './onboarding-form';

export default function OnboardingPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-5 text-white">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#DF87FF]">CONTIROOM</p>
        <h1 className="mt-4 text-3xl font-bold">핸들 만들기</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          곡과 콘티에 표시될 이름이에요. 영문 소문자, 숫자, 밑줄(_)을 사용할 수 있습니다.
        </p>
        <OnboardingForm />
      </section>
    </main>
  );
}
