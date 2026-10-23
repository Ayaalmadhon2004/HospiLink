import { useState } from 'react';

/**
 * Reads `#token=...` from the URL once and removes it from the address bar, so the secret
 * does not stay in history or leak through screenshots. (A fragment is never sent to a server.)
 */
export const useFragmentToken = (): string | null => {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    if (value) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return value;
  });
  return token;
};
