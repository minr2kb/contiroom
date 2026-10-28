import { NextResponse } from 'next/server';
import { createClient } from './server';

export const requireUser = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

  return {
    supabase,
    userId,
    response: userId ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
};
