import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseConfig } from './config';

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([header, value]) => {
          response.headers.set(header, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === '/login';
  const isOnboarding = pathname === '/onboarding';
  const showingOnboarding = pathname === '/' && request.nextUrl.searchParams.has('onboarding');
  const requiresLogin = /^\/(?:songs|contis)\/[^/]+\/edit(?:\/|$)/.test(pathname);
  const redirectTo = (destination: string, search = '') => {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  };

  if (!userId && (requiresLogin || isOnboarding || isLogin || showingOnboarding)) {
    const search = new URLSearchParams({ login: '1' });
    if (requiresLogin) search.set('next', `${pathname}${request.nextUrl.search}`);
    if (showingOnboarding && request.nextUrl.searchParams.has('next')) {
      search.set('next', request.nextUrl.searchParams.get('next') ?? '/');
    }
    return redirectTo('/', search.toString());
  }

  // API requests need JSON errors, and the auth callback must finish its token
  // exchange before profile navigation is checked.
  if (
    userId &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/auth/') &&
    !pathname.split('/').at(-1)?.includes('.')
  ) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (!profileError) {
      if (!profile && !showingOnboarding) {
        return redirectTo(
          '/',
          new URLSearchParams({
            onboarding: '1',
            next: isOnboarding ? '/' : `${pathname}${request.nextUrl.search}`,
          }).toString(),
        );
      }
      if (profile && (isOnboarding || isLogin || showingOnboarding)) return redirectTo('/');
    }
  }

  return response;
};
