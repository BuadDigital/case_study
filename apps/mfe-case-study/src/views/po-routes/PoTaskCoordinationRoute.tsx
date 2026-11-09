"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button, InlineLoadingSkeleton, Note, PageShell } from "@platform/ui-kit";
import {
  poPropertiesPath,
  poPropertyCoordinationPath,
} from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { createDraftPropertyForSlot } from "../../lib/app-data/po-intake-commands";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

/**
 * `/po/{po}/task/{taskId}/coordination` — opens a deed's coordinator page from its task, even before the deed has a
 * property (Omar 2026-11-08: the intake is one block on the coordinator's page; a work order with several deeds
 * arrives as empty «تسجيل عقار ١ من ٣» slots).
 *
 * How it works: once the tasks load, a task with a property goes straight to its coordinator page on the
 * intake section; a slot without one gets its property draft created on the server first (the same
 * call the old primary-data panel made), then the caches refresh and the page opens.
 * Edge cases: an unknown task or a failed draft shows the reason with a way back to the work order;
 * the draft is created once per mount (a ref guards React's double effects).
 */
export function PoTaskCoordinationRoute({ poNumber, taskId }: { poNumber: string; taskId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tasksQuery = useWorkflowTasksQuery();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const task = tasksQuery.data?.find((t) => t.id === taskId);

  useEffect(() => {
    if (started.current || !tasksQuery.isFetched) return;
    started.current = true;
    if (!task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the task list answered without this task
      setError("المهمة غير موجودة أو ليست ضمن صلاحياتك.");
      return;
    }
    if (task.propertyId) {
      router.replace(poPropertyCoordinationPath(task.poNumber || poNumber, task.propertyId, "intake"));
      return;
    }
    void createDraftPropertyForSlot(task.poNumber || poNumber, task.id).then(async (created) => {
      if (!created.ok) {
        setError(created.error);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appDataKeys.workflowTasks() }),
        queryClient.invalidateQueries({ queryKey: appDataKeys.poRecord(task.poNumber || poNumber) }),
      ]);
      router.replace(poPropertyCoordinationPath(task.poNumber || poNumber, created.data.id, "intake"));
    });
  }, [tasksQuery.isFetched, task, poNumber, queryClient, router]);

  return (
    <PageShell variant="canvas" className="gap-3 px-[30px] py-[26px] max-sm:px-4">
      {error ? (
        <>
          <Note tone="danger">{error}</Note>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push(poPropertiesPath(poNumber))}>
              العودة إلى أمر العمل
            </Button>
          </div>
        </>
      ) : (
        <InlineLoadingSkeleton className="text-xs text-text-3" />
      )}
    </PageShell>
  );
}
