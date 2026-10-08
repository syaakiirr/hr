import { QueryClient } from "@tanstack/react-query";

/**
 * Global TanStack Query client.
 *
 * Cache policy (SociHR defaults):
 *  - staleTime  5 min  → data dianggap segar selama 5 minit; tiada refetch semasa window tidak aktif
 *  - gcTime    10 min  → cache dibersihkan 10 minit selepas tiada subscriber
 *  - retry       2     → cuba semula 2× sebelum lempar ralat
 *  - refetchOnWindowFocus true → data di-refresh apabila tab dibuka semula
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minit
      gcTime: 10 * 60 * 1000,         // 10 minit
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
