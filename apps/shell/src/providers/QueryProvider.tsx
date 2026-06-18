"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  prefetchCorePrototypeData,
  usePrototypeDataSync,
} from "@/lib/query/prototype-queries";

function PrototypeQueryEffects() {
  usePrototypeDataSync();
  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  useEffect(() => {
    const run = () => prefetchCorePrototypeData(client);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2_000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <PrototypeQueryEffects />
      {children}
    </QueryClientProvider>
  );
}
