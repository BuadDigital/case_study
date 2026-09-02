"use client";

import { useCallback, useRef } from "react";
import {
  useIdempotentAction,
  type IdempotentActionResult,
} from "./use-idempotent-action";

type UseCommandMutationOptions = {
  /** When false, concurrent calls are ignored (default). */
  guardConcurrent?: boolean;
  /** Thrown when run() is somehow invoked without args (should not happen). */
  missingArgsMessage?: string;
};

/**
 * Preferred command-button API: bind a payload once per intent, reuse one
 * idempotency key across retries, and drive Button `loading` from `loading`.
 *
 * Prefer this over hand-rolled refs + `useIdempotentAction` for new screens.
 */
export function useCommandMutation<TArgs, TResult>(
  mutate: (args: TArgs, idempotencyKey: string) => Promise<TResult>,
  options: UseCommandMutationOptions = {},
): {
  run: (args: TArgs) => Promise<IdempotentActionResult<TResult>>;
  loading: boolean;
  idempotencyKey: string | null;
  reset: () => void;
} {
  const {
    guardConcurrent = true,
    missingArgsMessage = "لا توجد بيانات للأمر",
  } = options;
  const argsRef = useRef<TArgs | null>(null);

  const { execute, loading, idempotencyKey, reset } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        const args = argsRef.current;
        if (args === null) {
          throw new Error(missingArgsMessage);
        }
        return mutate(args, idempotencyKey);
      },
      [mutate, missingArgsMessage],
    ),
    { guardConcurrent },
  );

  const run = useCallback(
    async (args: TArgs): Promise<IdempotentActionResult<TResult>> => {
      argsRef.current = args;
      return execute();
    },
    [execute],
  );

  return { run, loading, idempotencyKey, reset };
}
