"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isPartyWorkflowRole } from "@platform/app-shared/prototype/party-task-pages";
import { CaseStudyTaskWork } from "./MyTaskWorkView";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { findPropertyForTask } from "../lib/prototype/my-task-row";
import {
  favoritePropertyKey,
  useFavoriteProperties,
} from "../lib/prototype/favorite-properties";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import {
  favoritesPath,
  favoritesTaskPath,
  partyTaskWorkspacePath,
} from "../lib/my-task-routes";
import {
  allTransactionsPhaseLabel,
  buildAllTransactionsRowMoreItems,
} from "../lib/prototype/all-transactions-queue";

export function FavoriteTransactionsView() {
  const { role } = usePrototype();
  const { favoriteKeys, toggleFavorite } = useFavoriteProperties();

  const isPartyRole = isPartyWorkflowRole(role);

  const config = useMemo((): ActiveTransactionQueueConfig => {
    return {
      pageId: "favorites",
      pageTitle: "المفضلة",
      hidePageTitle: true,
      tableLayout: "all-transactions",
      emptyLine: "لا توجد معاملات في المفضلة.",
      emptyHint:
        "افتح تفاصيل أي عقار واضغط النجمة بجانب رقم الصك لإضافته هنا.",
      panelId: "favorite-transactions-panel",
      tableHint:
        "اضغط الصف لفتح المعاملة في مرحلتها الحالية — اضغط نفس الصف مرة أخرى للإغلاق.",
      partyAssignee: isPartyRole,
      assigneeRole: isPartyRole ? role : undefined,
      getBasePath: favoritesPath,
      getTaskPath: favoritesTaskPath,
      queueSort: "distributed-newest-first",
      includeAllStatuses: true,
      statusColumnLabel: "المرحلة",
      buildRowMoreItems: (ctx) => {
        const items = buildAllTransactionsRowMoreItems({
          task: ctx.task,
          propertyId: ctx.propertyId,
          openTask: ctx.openTask,
          router: ctx.router,
          viewerRole: ctx.viewerRole,
        });
        const propertyId = ctx.propertyId ?? ctx.task.propertyId;
        if (propertyId) {
          items.push({
            id: "remove-favorite",
            label: "إزالة من المفضلة",
            onClick: () => toggleFavorite(ctx.task.poNumber, propertyId),
          });
        }
        return items;
      },
      getTaskStatusBadge: (task) => {
        const label = allTransactionsPhaseLabel(task);
        const className =
          label === "مكتمل"
            ? "b-done"
            : label === "البورصة" || label === "تعذر"
              ? "b-fail"
              : label === "البيانات الأولية"
                ? "b-new"
                : "b-prog";
        return { label, className };
      },
      resolveFullPageTaskPath: isPartyRole ? partyTaskWorkspacePath : undefined,
      filterListed: (mine, poByNumber): WorkflowTask[] =>
        mine.filter((task) => {
          const record = poByNumber.get(task.poNumber.trim());
          const propertyId =
            findPropertyForTask(record, task)?.id ?? task.propertyId;
          if (!propertyId) return false;
          return favoriteKeys.has(
            favoritePropertyKey(task.poNumber, propertyId),
          );
        }),
    };
  }, [favoriteKeys, isPartyRole, role, toggleFavorite]);

  return (
    <ActiveTransactionQueueView
      config={config}
      renderPanel={
        isPartyRole
          ? undefined
          : ({ task, onRefresh, onClose }) => (
              <CaseStudyTaskWork
                key={task.id}
                task={task}
                onRefresh={onRefresh}
                layout="panel"
                onClose={onClose}
              />
            )
      }
    />
  );
}
