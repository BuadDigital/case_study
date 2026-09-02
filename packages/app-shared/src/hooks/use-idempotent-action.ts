"use client";

import { createIdempotencyKey } from "@platform/api-client/idempotency-key";
import { useCallback, useRef, useState } from "react";

export type IdempotentActionResult<T> =
  | { status: "skipped" }
  | { status: "ok"; value: T };

type UseIdempotentActionOptions = {
  /** When false, concurrent calls are ignored (default). */
  guardConcurrent?: boolean;
};

/**
 * Wraps a mutating handler with in-flight UI guard + a stable idempotency key per intent.
 * Clear the key on success; keep it on failure so retries stay idempotent.
 */
export function useIdempotentAction<T>(
  action: (idempotencyKey: string) => Promise<T>,
  options: UseIdempotentActionOptions = {},
): {
  execute: () => Promise<IdempotentActionResult<T>>;
  loading: boolean;
  idempotencyKey: string | null;
  reset: () => void;
} {
  const { guardConcurrent = true } = options;
  const inFlightRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    keyRef.current = null;
    inFlightRef.current = false;
    setLoading(false);
  }, []);

  const execute = useCallback(async (): Promise<IdempotentActionResult<T>> => {
    if (guardConcurrent && inFlightRef.current) {
      return { status: "skipped" };
    }

    inFlightRef.current = true;
    setLoading(true);
    const key = keyRef.current ?? createIdempotencyKey();
    keyRef.current = key;

    try {
      const value = await action(key);
      keyRef.current = null;
      return { status: "ok", value };
    } catch (error) {
      throw error;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [action, guardConcurrent]);

  return {
    execute,
    loading,
    idempotencyKey: keyRef.current,
    reset,
  };
}
