"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isOfflineCapableRole } from "@platform/app-shared/offline/offline-write";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { prefetchPartySubmissionsForTasks } from "@platform/app-shared/prototype/party-submission-api";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  BASIC_DOC_PREFETCH_SCOPES,
  BASIC_DOCS_PREFETCH_ID,
  OPS_TASKS_PREFETCH_ID,
  WORKFLOW_TASKS_PREFETCH_ID,
  type BasicDocPrefetchEntry,
} from "@platform/app-shared/offline/prefetch-read";
import {
  cachePrefetchAttachment,
  savePrefetch,
  requestPersistentStorage,
} from "@platform/offline-client";
import {
  downloadAttachmentBlob,
  listAttachments,
} from "@platform/api-client";
import { getPoRecord } from "@case-study/mfe/lib/prototype/po-intake-storage";
import { loadOperationsTasks } from "@case-study/mfe/lib/prototype/operations-tasks-storage";
import { useWorkflowTasksQuery } from "@/lib/query/prototype-queries";

function scopeKeyForProperty(poNumber: string, propertyId: string): string {
  return `${poNumber.trim()}:${propertyId}`;
}

async function prefetchBasicDocBinaries(input: {
  userId: string;
  properties: Array<{ poNumber: string; propertyId: string }>;
}): Promise<BasicDocPrefetchEntry[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const entries: BasicDocPrefetchEntry[] = [];
  const seen = new Set<string>();

  for (const property of input.properties) {
    const poNumber = property.poNumber.trim();
    const propertyId = property.propertyId.trim();
    if (!poNumber || !propertyId) continue;
    const scopeKey = scopeKeyForProperty(poNumber, propertyId);

    for (const doc of BASIC_DOC_PREFETCH_SCOPES) {
      const dedupe = `${doc.scope}:${scopeKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const listed = await listAttachments(config, doc.scope, scopeKey);
      if (!listed.ok || listed.data.length === 0) continue;
      const meta = listed.data[0]!;

      const blobResult = await downloadAttachmentBlob(config, meta.id);
      if (!blobResult.ok) continue;

      const bytes = await blobResult.data.arrayBuffer();
      await cachePrefetchAttachment({
        userId: input.userId,
        attachmentId: meta.id,
        scope: doc.scope,
        scopeKey,
        fileName: meta.fileName,
        contentType: meta.contentType,
        bytes,
      });

      entries.push({
        attachmentId: meta.id,
        scope: doc.scope,
        scopeKey,
        fileName: meta.fileName,
        contentType: meta.contentType,
        poNumber,
        propertyId,
        kind: doc.kind,
      });
    }
  }

  return entries;
}

/**
 * Pre-fetches active tasks, PO records, party submissions, ops tasks, and basic
 * document binaries for field roles while online so offline forms remain usable.
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
      const properties = [
        ...new Map(
          tasks
            .map((task) => ({
              poNumber: String(task.poNumber ?? task.PoNumber ?? "").trim(),
              propertyId: String(task.propertyId ?? task.PropertyId ?? "").trim(),
            }))
            .filter((row) => row.poNumber && row.propertyId)
            .map((row) => [`${row.poNumber}:${row.propertyId}`, row] as const),
        ).values(),
      ];

      void (async () => {
        try {
          await requestPersistentStorage();
          if (taskIds.length) {
            await Promise.all([
              prefetchPartySubmissionsForTasks(taskIds),
              savePrefetch({
                id: WORKFLOW_TASKS_PREFETCH_ID(userId),
                userId,
                kind: "workflow-tasks",
                payloadJson: JSON.stringify({ taskIds, tasks }),
                updatedAtUtc: new Date().toISOString(),
              }),
            ]);
          }

          const opsTasks = await loadOperationsTasks({ assigneeId: userId });
          if (opsTasks.length) {
            await savePrefetch({
              id: OPS_TASKS_PREFETCH_ID(userId),
              userId,
              kind: "operations-tasks",
              payloadJson: JSON.stringify({ tasks: opsTasks }),
              updatedAtUtc: new Date().toISOString(),
            });
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

          const docEntries = await prefetchBasicDocBinaries({
            userId,
            properties,
          });
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
          await savePrefetch({
            id: BASIC_DOCS_PREFETCH_ID(userId),
            userId,
            kind: "basic-docs",
            payloadJson: JSON.stringify({
              hints: docHints,
              entries: docEntries,
            }),
            updatedAtUtc: new Date().toISOString(),
          });
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
