import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** RTL `wrapper` giving the component under test a fresh React Query client (no retries, so failures show at once). */
export const QueryWrapper = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
