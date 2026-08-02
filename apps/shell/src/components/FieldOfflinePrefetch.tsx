"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isOfflineCapableRole } from "@platform/app-shared";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { prefetchPartySubmissionsForTasks } from "@platform/app-shared/prototype/party-submission-api";
import { savePrefetch, requestPersistentStorage } from "@platform/offline-client";
import {
  prefetchPoRecord,
  useWorkflowTasksQuery,
} from "@/lib/query/prototype-queries";

/**
 * Pre-fetches active tasks, PO records, party submissions, and basic document
 * metadata for field roles while online so offline forms remain usable.
 */
export function FieldOfflinePrefetch() {
  const { role, user, isAuthenticated } = useAuth();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const capable = isOfflineCapableRole(role);
  const tasksQuery = useWorkflowTasksQuery({
    live: capable && isAuthenticated,
  });

  useEffect(() => {
    if (!capable || !isAuthenticated || !online || !user?.id) return;
    const tasks = (tasksQuery.data ?? []) as Array<Record<string, unknown>>;
    const taskIds = tasks
      .map((task) => String(task.id ?? task.Id ?? "").trim())
      .filter(Boolean);
    const poNumbers = [
      ...new Set(
        tasks
          .map((task) =>
            String(task.poNumber ?? task.PoNumber ?? "").trim(),
          )
          .filter(Boolean),
      ),
    ];

    void (async () => {
      try {
        await requestPersistentStorage();
        if (taskIds.length) {
          await prefetchPartySubmissionsForTasks(taskIds);
          await savePrefetch({
            id: `tasks:${user.id}`,
            userId: user.id,
            kind: "workflow-tasks",
            payloadJson: JSON.stringify({ taskIds, tasks }),
            updatedAtUtc: new Date().toISOString(),
          });
        }
        for (const po of poNumbers.slice(0, 40)) {
          prefetchPoRecord(queryClient, po);
          const cached = queryClient.getQueryData(["po-record", po]);
          if (cached) {
            await savePrefetch({
              id: `po:${user.id}:${po}`,
              userId: user.id,
              kind: "po-record",
              payloadJson: JSON.stringify(cached),
              updatedAtUtc: new Date().toISOString(),
            });
          }
        }
        // Basic document hints from tasks (deed/assignment refs) for offline display.
        const docHints = tasks
          .map((task) => ({
            taskId: String(task.id ?? task.Id ?? ""),
            poNumber: String(task.poNumber ?? task.PoNumber ?? ""),
            deedNumber: String(task.deedNumber ?? task.DeedNumber ?? ""),
            propertyId: String(task.propertyId ?? task.PropertyId ?? ""),
            assignmentMandateNumber: String(
              task.assignmentMandateNumber ??
                task.AssignmentMandateNumber ??
                "",
            ),
          }))
          .filter((row) => row.taskId);
        if (docHints.length) {
          await savePrefetch({
            id: `docs:${user.id}`,
            userId: user.id,
            kind: "basic-docs",
            payloadJson: JSON.stringify(docHints),
            updatedAtUtc: new Date().toISOString(),
          });
        }
      } catch {
        // Offline crypto/IDB may be unavailable (non-secure context); ignore.
      }
    })();
  }, [
    capable,
    isAuthenticated,
    online,
    queryClient,
    tasksQuery.data,
    user?.id,
  ]);

  return null;
}
