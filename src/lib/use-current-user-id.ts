'use client';

import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';

export const useCurrentUserId = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let requestId = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshClaims = async () => {
      const currentRequest = ++requestId;
      const { data, error } = await supabase.auth.getClaims();
      if (active && currentRequest === requestId) {
        setUserId(!error && typeof data?.claims?.sub === 'string' ? data.claims.sub : null);
      }
    };
    void refreshClaims();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        requestId++;
        setUserId(null);
        return;
      }
      refreshTimer = setTimeout(() => void refreshClaims(), 0);
    });
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      data.subscription.unsubscribe();
    };
  }, []);

  return userId;
};
