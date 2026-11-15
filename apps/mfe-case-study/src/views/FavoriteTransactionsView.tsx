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
import { useMyWorkPinnedProperties } from "../lib/app-data/my-work-pins";
import type { WorkflowTask } from "../lib/app-data/tasks";
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
  // The transactions starred in «أعمالي» are listed here too while their pin lasts (Omar 2026-11-12).
  const { pinnedPropertyKeys, unpin } = useMyWorkPinnedProperties();

  const isPartyRole = isPartyWorkflowRole(role);

  const config = useMemo((): ActiveTransactionQueueConfig => {
    return {
      pageId: "favorites",
      pageTitle: "المفضلة",
      hidePageTitle: true,
      tableLayout: "all-transactions",
      emptyLine: "لا توجد معاملات في المفضلة.",
      emptyHint:
        "اضغط النجمة في بداية صف المعاملة في «أعمالي»، أو بجانب رقم الصك في تفاصيل العقار، لإضافتها هنا.",
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
          viewerAccess: ctx.viewerAccess,
        });
        const propertyId = ctx.propertyId ?? ctx.task.propertyId;
        if (propertyId) {
          items.push({
            id: "remove-favorite",
            label: "إزالة من المفضلة",
            // Both stars are taken off: the header's lasting favourite and the pin of «أعمالي».
            onClick: () => {
              if (favoriteKeys.has(favoritePropertyKey(ctx.task.poNumber, propertyId))) {
                toggleFavorite(ctx.task.poNumber, propertyId);
              }
              unpin(ctx.task.poNumber, propertyId);
            },
          });
        }
        return items;
      },
      getTaskStatusBadge: (task) => {
        const label = allTransactionsPhaseLabel(task);
        const className =
          label === "مكتمل"
            ? "b-done"
            : label === "البورصة" || label === "تعذّر"
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
          const key = favoritePropertyKey(task.poNumber, propertyId);
          return favoriteKeys.has(key) || pinnedPropertyKeys.has(key);
        }),
    };
  }, [favoriteKeys, pinnedPropertyKeys, unpin, isPartyRole, role, toggleFavorite]);

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
