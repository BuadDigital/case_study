import { createKeyedWriteQueue } from "@platform/app-shared/lib/keyed-write-queue";

/** Engineering survey drafts are serialised per task — see keyed-write-queue.ts. */
const queue = createKeyedWriteQueue();

export function enqueueEngineeringSurveyDraftWrite<T>(
  taskId: string,
  work: () => Promise<T>,
): Promise<T> {
  return queue.enqueue(taskId, work);
}

/** Resolves once every queued draft write for the task has settled. */
export function awaitEngineeringSurveyDraftWrites(taskId: string): Promise<void> {
  return queue.awaitIdle(taskId);
}
