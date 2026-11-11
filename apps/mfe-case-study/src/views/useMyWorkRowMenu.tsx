"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast, type RowMoreMenuItem } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { useConfirmActionDialog } from "../components/ConfirmActionDialog";
import { RedistributePartiesHost } from "../components/distribution/RedistributePartiesHost";
import { useFailureRaiseModal } from "../hooks/useFailureRaiseModal";
import { useTransactionGeneralActions } from "../components/po-intake/useTransactionGeneralActions";
import { withTransactionGeneralItems } from "../lib/app-data/transaction-general-actions";
import {
  buildActiveQueueRowMoreItems,
  buildCaseStudyQueueRowMoreItems,
} from "../lib/app-data/active-queue-row-menu";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import type { MyWorkItem } from "../lib/app-data/my-work-model";
import {
  skipsBourseForIdentifier,
  type PoIntakeRecord,
} from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";

/**
 * The ⋮ menu of a «أعمالي» row — the same items its stage queue offers, so the stage queues can
 * leave the sidebar without taking an action away (plan 2026-11-05).
 *
 * How it works: coordination's primary-data / bourse / distribution rows get the stage queue's menu
 * (`buildActiveQueueRowMoreItems`: failure, phase revert for bourse / distribution, delete,
 * property links); every other row gets the case-study queues' menu (`buildCaseStudyQueueRowMoreItems`:
 * property links, and «تعديل إسناد الأطراف» on study rows); then the general actions every ⋮ menu
 * shares (`useTransactionGeneralActions`: reopen, failure, cancellation). The modals are
 * returned as `modals` for the page to mount once.
 * Edge cases: a bourse item whose deed has no case-study task loaded only links to the property; a
 * row with neither task nor property has no menu. A change refreshes the tasks, PO records and bourse
 * items so the row moves on.
 */
export function useMyWorkRowMenu({
  tasks,
  poByNumber,
}: {
  tasks: readonly WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
}): { itemsFor: (item: MyWorkItem) => RowMoreMenuItem[]; modals: ReactNode } {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, access } = useAppAccess();
  const { showToast } = useToast();
  const { confirm, dialog } = useConfirmActionDialog();
  const [redistributeTask, setRedistributeTask] = useState<WorkflowTask | null>(
    null,
  );

  const refresh = useCallback(() => {
    for (const queryKey of [
      appDataKeys.workflowTasks(),
      appDataKeys.poRecords(),
      appDataKeys.pendingBourseItems(),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient]);

  const { openFailureRaise, failureRaiseModal } = useFailureRaiseModal({
    onSubmitted: refresh,
  });
  const { itemsFor: generalItemsFor, dialogs: generalDialogs } =
    useTransactionGeneralActions({ onChanged: refresh });
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const stageItemsFor = useCallback(
    (item: MyWorkItem): RowMoreMenuItem[] => {
      const task = item.taskId ? byId.get(item.taskId) : undefined;
      const propertyId = item.propertyId;
      if (!task) {
        return propertyId
          ? [
              {
                id: "property-detail",
                label: "تفاصيل العقار",
                onClick: () =>
                  router.push(poPropertyPath(item.poNumber, propertyId)),
              },
            ]
          : [];
      }
      if (item.group === "co" && item.stage === "intake") {
        const property = findPropertyForTask(
          poByNumber.get(task.poNumber.trim()),
          task,
        );
        return buildActiveQueueRowMoreItems({
          task,
          propertyId,
          openTask: () => router.push(item.href),
          router,
          refreshQueue: refresh,
          showToast,
          poByNumber,
          allowPhaseRevert: task.phase !== "enfath",
          allowDeleteTransaction: true,
          skipsBourse: property
            ? skipsBourseForIdentifier(property.identifierType)
            : false,
          viewerRole: role,
          viewerAccess: access,
          confirmAction: confirm,
          onRegisterFailure: openFailureRaise,
        });
      }
      return buildCaseStudyQueueRowMoreItems({
        task,
        propertyId,
        router,
        viewerRole: role,
        viewerAccess: access,
        onRedistributeParties:
          item.stage === "study" ? () => setRedistributeTask(task) : undefined,
      });
    },
    [
      byId,
      poByNumber,
      router,
      refresh,
      showToast,
      role,
      access,
      confirm,
      openFailureRaise,
    ],
  );

  // The stage's items, then the general ones (reopen, failure, cancellation) every ⋮ menu shares.
  const itemsFor = useCallback(
    (item: MyWorkItem): RowMoreMenuItem[] => {
      const record = poByNumber.get(item.poNumber.trim());
      const property = item.propertyId
        ? record?.properties.find((p) => p.id === item.propertyId)
        : undefined;
      // Deposited and waiting for the upload: a mistake found now is corrected by reopening (2026-11-05).
      const general = property
        ? generalItemsFor({
            poNumber: item.poNumber,
            property,
            workOrderId: record?.id,
            reopenable: item.stage === "upload" && !item.reopened,
          })
        : [];
      return withTransactionGeneralItems(stageItemsFor(item), general);
    },
    [poByNumber, generalItemsFor, stageItemsFor],
  );

  const modals = (
    <>
      {dialog}
      {failureRaiseModal}
      {generalDialogs}
      <RedistributePartiesHost
        task={redistributeTask}
        onClose={() => setRedistributeTask(null)}
      />
    </>
  );

  return { itemsFor, modals };
}
