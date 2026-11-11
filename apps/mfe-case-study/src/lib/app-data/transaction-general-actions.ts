/**
 * The general actions of a transaction's ⋮ menu — the same items and rules wherever the menu shows:
 * the property page's corner, «أعمالي», «المعاملات النشطة» (Omar 2026-11-05: «الإجراءات العامة في
 * الثلاث نقاط، في ركن تفاصيل العقار أو من صفوف المعاملة»). Stage actions (revert, redistribute,
 * delete…) stay with their stage. Pure: no React.
 */
import type { RowMoreMenuItem } from "@platform/ui-kit";
import type { StaffAccess } from "@platform/app-shared/app-data/case-specialist-sub-roles";
import { failureDegreesFor } from "@failures/mfe/lib/failure-degrees";
import {
  canDecideTransactionCancel,
  canReopenTransaction,
  canRequestTransactionCancel,
} from "./po-roles";

export type TransactionGeneralRules = {
  /** «تسجيل تعذّر» — the one window with the degrees the viewer may record on this deed. */
  failure: boolean;
  cancel: boolean;
  /** The supervisor cancels at once; the specialist asks. */
  cancelDecides: boolean;
  /** «إعادة فتح المعاملة» (Omar 2026-11-05): any specialist, once deposited or uploaded. */
  reopen: boolean;
};

/**
 * Which general actions the viewer may start on a deed.
 *
 * How it works: a removed or cancelled deed takes none (only the supervisor's reactivation, on the
 * page banner, brings it back). Otherwise: «تسجيل تعذّر» when the viewer may raise a failure and
 * the window has a degree to offer him on this deed (`failureDegreesFor`: any degree of his role
 * while the deed has no open failure, the final one alone — the case specialist's, the supervisor's
 * and the CDO's — while it has one, none once the failure is final); the cancellation for
 * coordination (a request) or the supervisor (at once) unless one is pending or the deed is
 * final-failed. The server re-checks every one.
 * Edge cases: `cancellationPending` unknown (a list row) reads as false — the server refuses a second request.
 * Until 2026-11-11 the final failure was its own item, «التعذّر النهائي عن المعاملة», for the supervisor alone.
 */
export function transactionGeneralRules(input: {
  access: StaffAccess;
  canRaiseFailure: boolean;
  property: { isRemoved?: boolean; cancelledAtUtc?: string | null } | null;
  /** The deed's open failure status, null when it has none. */
  openFailureStatus: string | null;
  cancellationPending?: boolean;
  /** The host knows the valuation is deposited or the transaction uploaded, with nothing reopened yet. */
  reopenable?: boolean;
}): TransactionGeneralRules {
  const cancelDecides = canDecideTransactionCancel(input.access.role);
  const live = Boolean(
    input.property &&
    !input.property.isRemoved &&
    !input.property.cancelledAtUtc,
  );
  if (!live)
    return {
      failure: false,
      cancel: false,
      cancelDecides,
      reopen: false,
    };
  const finalApproved = input.openFailureStatus === "approved";
  return {
    failure:
      input.canRaiseFailure &&
      failureDegreesFor(input.access.role, input.openFailureStatus).length > 0,
    cancel:
      canRequestTransactionCancel(input.access) &&
      !input.cancellationPending &&
      !finalApproved,
    cancelDecides,
    reopen: Boolean(input.reopenable) && canReopenTransaction(input.access) && !finalApproved,
  };
}

/**
 * The general items, in their fixed order: reopen, failure, cancellation.
 *
 * How it works: an item shows only when its rule allows it and the host gave its handler.
 * Edge cases: `busy` disables them all while the menu's host is navigating.
 */
export function buildTransactionGeneralItems(
  rules: TransactionGeneralRules,
  handlers: {
    onFailure?: () => void;
    onCancel?: () => void;
    onReopen?: () => void;
  },
  busy = false,
): RowMoreMenuItem[] {
  const items: RowMoreMenuItem[] = [];
  if (rules.reopen && handlers.onReopen) {
    items.push({
      id: "reopen-transaction",
      label: "إعادة فتح المعاملة",
      disabled: busy,
      onClick: handlers.onReopen,
    });
  }
  if (rules.failure && handlers.onFailure) {
    items.push({
      id: "failure",
      label: "تسجيل تعذّر",
      danger: true,
      disabled: busy,
      onClick: handlers.onFailure,
    });
  }
  if (rules.cancel && handlers.onCancel) {
    items.push({
      id: "cancel-transaction",
      label: rules.cancelDecides ? "إلغاء المعاملة" : "طلب إلغاء المعاملة",
      danger: true,
      disabled: busy,
      onClick: handlers.onCancel,
    });
  }
  return items;
}

/** The ids `buildTransactionGeneralItems` gives its items — a menu holding one already has the general actions. */
export const GENERAL_ITEM_IDS: ReadonlySet<string> = new Set([
  "reopen-transaction",
  "failure",
  "cancel-transaction",
]);

/** Stage-menu ids that already raise a failure — the general «تسجيل تعذّر» is not added twice. */
const STAGE_FAILURE_IDS = new Set([
  "register-failure",
  "property-failure",
  "failure",
]);

/**
 * A row's stage items followed by the general ones.
 *
 * How it works: keeps the stage items as they are and appends the general items after them.
 * Edge cases: a stage menu that already offers its own failure keeps it, and the general one is dropped.
 */
export function withTransactionGeneralItems(
  stageItems: RowMoreMenuItem[],
  generalItems: RowMoreMenuItem[],
): RowMoreMenuItem[] {
  const stageHasFailure = stageItems.some((i) => STAGE_FAILURE_IDS.has(i.id));
  return [
    ...stageItems,
    ...generalItems.filter((i) => !(stageHasFailure && i.id === "failure")),
  ];
}
