"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { RowMoreMenuItem } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { getPropertyFailure } from "@failures/mfe/lib/failures-repository";
import { FinalFailureDialog } from "@failures/mfe/components/failures/FinalFailureDialog";
import { useFailureRaiseModal } from "../../hooks/useFailureRaiseModal";
import {
  canDecideTransactionCancel,
  canRaisePropertyFailure,
} from "../../lib/app-data/po-roles";
import {
  buildTransactionGeneralItems,
  transactionGeneralRules,
} from "../../lib/app-data/transaction-general-actions";
import {
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { transactionNumberOf } from "../../lib/app-data/transaction-number";
import { TransactionCancelDialog } from "./TransactionCancelDialog";
import { TransactionReopenDialog } from "./TransactionReopenDialog";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";

/** The deed a general action is started on. */
export type TransactionGeneralTarget = {
  poNumber: string;
  property: PoPropertyIntake;
  /** Override of «may raise a failure» (a party viewer holding a task on the deed). Default: the role's. */
  canRaiseFailure?: boolean;
  cancellationPending?: boolean;
  busy?: boolean;
  /** The work order's id — needed by «إعادة فتح المعاملة»; without it the item is not offered. */
  workOrderId?: string;
  /** Deposited or uploaded with nothing reopened yet (the host knows); offers «إعادة فتح المعاملة». */
  reopenable?: boolean;
};

type OpenDialog = {
  kind: "final" | "cancel" | "reopen";
  poNumber: string;
  property: PoPropertyIntake;
  workOrderId?: string;
};

/**
 * The general ⋮ actions of any deed — reopen, failure, final failure, cancellation — with their dialogs.
 *
 * How it works: `itemsFor` reads the rules (`transactionGeneralRules`, the failures cache for the
 * open failure) and returns the items; a click opens the matching dialog for that deed, mounted once
 * by the host through `dialogs`. The failure form is `useFailureRaiseModal`'s (its «raised by» label
 * follows the viewer's role).
 * Edge cases: the dialogs mount only while open, so their fields start empty each time; the final
 * failure dialog asks for the problem type only when the deed has no open failure to finalize.
 * Extracted 2026-11-05 from the property page's corner menu so list rows offer the same actions.
 */
export function useTransactionGeneralActions(options?: {
  onChanged?: () => void;
}): {
  itemsFor: (target: TransactionGeneralTarget) => RowMoreMenuItem[];
  dialogs: ReactNode;
} {
  const { role, access } = useAppAccess();
  const { openFailureRaise, failureRaiseModal } = useFailureRaiseModal({
    onSubmitted: options?.onChanged,
  });
  const [open, setOpen] = useState<OpenDialog | null>(null);

  const itemsFor = useCallback(
    (target: TransactionGeneralTarget): RowMoreMenuItem[] => {
      const po = target.poNumber.trim();
      const property = target.property;
      const openFailure = getPropertyFailure(po, property.id);
      const rules = transactionGeneralRules({
        access,
        canRaiseFailure:
          target.canRaiseFailure ?? canRaisePropertyFailure(role),
        property,
        openFailureStatus: openFailure ? openFailure.status : null,
        cancellationPending: target.cancellationPending,
        reopenable: Boolean(target.reopenable && target.workOrderId),
      });
      return buildTransactionGeneralItems(
        rules,
        {
          onFailure: () =>
            openFailureRaise({
              poNumber: po,
              propertyId: property.id,
              deedNumber:
                formatPropertyDeedDisplay(property) ||
                property.deedNumber.trim(),
            }),
          onFinalFailure: () =>
            setOpen({ kind: "final", poNumber: po, property }),
          onCancel: () => setOpen({ kind: "cancel", poNumber: po, property }),
          onReopen: () => setOpen({ kind: "reopen", poNumber: po, property, workOrderId: target.workOrderId }),
        },
        target.busy,
      );
    },
    [access, role, openFailureRaise],
  );

  const label = open
    ? (transactionNumberOf(open.property) ??
      (formatPropertyDeedDisplay(open.property) ||
        open.property.deedNumber.trim()))
    : "";
  const close = () => setOpen(null);

  const dialogs = (
    <>
      {failureRaiseModal}
      {open?.kind === "final" ? (
        <FinalFailureDialog
          open
          onClose={close}
          poNumber={open.poNumber}
          propertyId={open.property.id}
          deedLabel={label}
          deedCount={open.property.transactionDeedCount}
          askProblemType={!getPropertyFailure(open.poNumber, open.property.id)}
          onDone={options?.onChanged}
        />
      ) : null}
      {open?.kind === "reopen" && open.workOrderId ? (
        <TransactionReopenDialog
          workOrderId={open.workOrderId}
          propertyId={open.property.id}
          onClose={close}
          onReopened={() => {
            notifyTasksChanged();
            options?.onChanged?.();
          }}
        />
      ) : null}
      {open?.kind === "cancel" ? (
        <TransactionCancelDialog
          scope={{ propertyId: open.property.id }}
          label={label}
          decides={canDecideTransactionCancel(role)}
          onClose={close}
        />
      ) : null}
    </>
  );

  return { itemsFor, dialogs };
}
