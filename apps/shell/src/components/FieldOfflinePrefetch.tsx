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
 * Pre-fetches active tasks, PO records, and party submissions for field roles
 * while online so offline forms remain usable.
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
      await requestPersistentStorage();
      if (taskIds.length) {
        await prefetchPartySubmissionsForTasks(taskIds);
        await savePrefetch({
          id: `tasks:${user.id}`,
          userId: user.id,
          kind: "workflow-tasks",
          payloadJson: JSON.stringify(taskIds),
          updatedAtUtc: new Date().toISOString(),
        });
      }
      for (const po of poNumbers.slice(0, 40)) {
        prefetchPoRecord(queryClient, po);
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
