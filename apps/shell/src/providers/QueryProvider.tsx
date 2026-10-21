"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useAppAccessDataSync } from "@/lib/query/app-data-queries";

function PrototypeQueryEffects() {
  useAppAccessDataSync();
  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        // One retry absorbs a transient blip on a read; a real failure then
        // reaches the screen's inline error state (`QueryErrorState`).
        retry: 1,
      },
      // Writes never auto-repeat — a retried command could apply twice.
      mutations: { retry: 0 },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      <PrototypeQueryEffects />
      {children}
    </QueryClientProvider>
  );
}
