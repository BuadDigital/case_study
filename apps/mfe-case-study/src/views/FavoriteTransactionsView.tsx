"use client";

import { useMemo } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { isPartyWorkflowRole } from "@platform/app-shared/app-data/party-task-pages";
import { CaseStudyTaskWork } from "./MyTaskWorkView";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import {
  favoritePropertyKey,
  useFavoriteProperties,
} from "../lib/app-data/favorite-properties";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import {
  favoritesPath,
  favoritesTaskPath,
  partyTaskWorkspacePath,
} from "../lib/my-task-routes";
import {
  allTransactionsPhaseLabel,
  buildAllTransactionsRowMoreItems,
} from "../lib/app-data/all-transactions-queue";

export function FavoriteTransactionsView() {
  const { role } = useAppAccess();
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
      tableHint: "اضغط الصف للفتح أو الإغلاق.",
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
