"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isOfflineCapableRole } from "@platform/app-shared/offline/offline-write";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { prefetchPartySubmissionsForTasks } from "@platform/app-shared/prototype/party-submission-api";
import { savePrefetch, requestPersistentStorage } from "@platform/offline-client";
import { getPoRecord } from "@case-study/mfe/lib/prototype/po-intake-storage";
import { useWorkflowTasksQuery } from "@/lib/query/prototype-queries";

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
    const userId = user.id;
    const tasks = (tasksQuery.data ?? []) as Array<Record<string, unknown>>;

    const run = () => {
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
            await Promise.all([
              prefetchPartySubmissionsForTasks(taskIds),
              savePrefetch({
                id: `tasks:${userId}`,
                userId,
                kind: "workflow-tasks",
                payloadJson: JSON.stringify({ taskIds, tasks }),
                updatedAtUtc: new Date().toISOString(),
              }),
            ]);
          }
          await Promise.allSettled(
            poNumbers.slice(0, 40).map(async (po) => {
              const record = await queryClient.fetchQuery({
                queryKey: prototypeKeys.poRecord(po),
                queryFn: () => getPoRecord(po),
                staleTime: 60_000,
              });
              if (record) {
                await savePrefetch({
                  id: `po:${userId}:${po}`,
                  userId,
                  kind: "po-record",
                  payloadJson: JSON.stringify(record),
                  updatedAtUtc: new Date().toISOString(),
                });
              }
            }),
          );
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
              id: `docs:${userId}`,
              userId,
              kind: "basic-docs",
              payloadJson: JSON.stringify(docHints),
              updatedAtUtc: new Date().toISOString(),
            });
          }
        } catch {
          // Offline crypto/IDB may be unavailable (non-secure context); ignore.
        }
      })();
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2_000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
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
