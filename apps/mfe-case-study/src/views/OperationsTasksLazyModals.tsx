"use client";

/**
 * The operations-tasks modals load on demand, but through `preloadableLazy`:
 * once their code is warmed (create button hover, or idle time for the row-menu
 * ones) they open on the click, without React's suspense reveal delay that a
 * plain `next/dynamic` still showed on a preloaded chunk.
 */
import { Suspense, useEffect, type ComponentProps } from "react";
import { preloadableLazy, whenIdle } from "@platform/ui-kit";

// ~934 lines and only shown on demand — kept out of the screen chunk (bundle-dynamic-imports).
const createTaskModal = preloadableLazy(() =>
  import("../components/CreateOperationsTaskModal").then(
    (m) => m.CreateOperationsTaskModal,
  ),
);
const reassignTaskModal = preloadableLazy(() =>
  import("../components/tasks/ReassignOperationsTaskModal").then(
    (m) => m.ReassignOperationsTaskModal,
  ),
);
const failureRaiseModal = preloadableLazy(() =>
  import("../components/failures/FailureRaiseModal").then(
    (m) => m.FailureRaiseModal,
  ),
);

const CreateTaskModalLazy = createTaskModal.Component;
const ReassignTaskModalLazy = reassignTaskModal.Component;
const FailureRaiseModalLazy = failureRaiseModal.Component;

export function CreateOperationsTaskModal(
  props: ComponentProps<typeof CreateTaskModalLazy>,
) {
  return (
    <Suspense fallback={null}>
      <CreateTaskModalLazy {...props} />
    </Suspense>
  );
}

export function ReassignOperationsTaskModal(
  props: ComponentProps<typeof ReassignTaskModalLazy>,
) {
  return (
    <Suspense fallback={null}>
      <ReassignTaskModalLazy {...props} />
    </Suspense>
  );
}

export function FailureRaiseModal(
  props: ComponentProps<typeof FailureRaiseModalLazy>,
) {
  return (
    <Suspense fallback={null}>
      <FailureRaiseModalLazy {...props} />
    </Suspense>
  );
}

/** Hover / focus of «إنشاء مهمة» — hides the chunk fetch behind the pointer (bundle-preload). */
export function preloadCreateOperationsTaskModal(): void {
  void createTaskModal.preload();
}

/** Warm the row-menu / detail-action modals once the screen is idle. */
export function usePreloadOperationsTaskModals(input: {
  reassign: boolean;
  failureRaise: boolean;
}): void {
  const { reassign, failureRaise } = input;
  useEffect(() => {
    if (!reassign && !failureRaise) return;
    return whenIdle(() => {
      if (reassign) void reassignTaskModal.preload();
      if (failureRaise) void failureRaiseModal.preload();
    });
  }, [reassign, failureRaise]);
}
