import { redirect } from 'next/navigation';
import { authReturnPath } from '@/lib/auth-return-path';
import { createClient } from '@/lib/supabase/server';

export const GET = async (request: Request) => {
  const query = new URL(request.url).searchParams;
  const next = authReturnPath(query.get('next'));
  const loginError = `/?${new URLSearchParams({ login: 'error', next })}`;
  if (query.has('error_code') || query.has('error')) redirect(loginError);

  const supabase = await createClient();
  const code = query.get('code');
  if (!code) redirect(loginError);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) redirect(loginError);

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== 'string') {
    await supabase.auth.signOut();
    redirect(loginError);
  }

  redirect(next);
};
