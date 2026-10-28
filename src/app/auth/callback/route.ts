import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const GET = async (request: Request) => {
  const query = new URL(request.url).searchParams;
  const authError = query.get('error_code') ?? query.get('error');
  if (authError) redirect(`/login?error=${authError === 'otp_expired' ? 'expired-link' : 'invalid-link'}`);

  const supabase = await createClient();
  const code = query.get('code');
  const tokenHash = query.get('token_hash');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) redirect(`/login?error=${error.code === 'otp_expired' ? 'expired-link' : 'invalid-link'}`);
  } else if (tokenHash && query.get('type') === 'email') {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error) redirect(`/login?error=${error.code === 'otp_expired' ? 'expired-link' : 'invalid-link'}`);
  } else {
    redirect('/login?error=invalid-link');
  }

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== 'string') {
    await supabase.auth.signOut();
    redirect('/login?error=invalid-link');
  }

  redirect('/');
};
