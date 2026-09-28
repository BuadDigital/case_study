"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { ROLES } from "@platform/app-shared/app-data/constants";
import type { RoleId } from "@platform/types";
import type { WorkflowTaskKind } from "@platform/app-shared/workflow/task-types";
import {
  FAILURE_RAISER_LABEL_BY_KIND,
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
} from "@failures/mfe/lib/failure-party-roles";
import { FailureRaiseModal } from "../components/failures/FailureRaiseModal";

export type FailureRaiseTarget = {
  poNumber: string;
  propertyId: string;
  deedNumber?: string;
  /** When opening from a party queue row, prefer that party's raiser label. */
  taskKind?: WorkflowTaskKind;
};

const PARTY_FAILURE_RAISER_BY_ROLE: Partial<Record<RoleId, string>> = {
  "field-inspector": FAILURE_RAISER_LABEL_BY_KIND["field-inspection"]!,
  "engineering-office": FAILURE_RAISER_LABEL_BY_KIND["engineering-survey"]!,
  "real-estate-appraiser": FAILURE_RAISER_LABEL_BY_KIND["property-appraisal"]!,
};

function raisedByRoleFor(
  role: RoleId,
  taskKind?: WorkflowTaskKind,
): string {
  if (taskKind && FAILURE_RAISER_LABEL_BY_KIND[taskKind]) {
    return FAILURE_RAISER_LABEL_BY_KIND[taskKind]!;
  }
  const fromRole = PARTY_FAILURE_RAISER_BY_ROLE[role];
  if (fromRole) return fromRole;
  if (role === "section-supervisor") return FAILURE_RAISER_SUPERVISOR;
  return FAILURE_RAISER_SPECIALIST;
}

/**
 * Shared «تسجيل تعذر» modal host — queues and property lists open this
 * instead of navigating to `/po/.../failure`.
 */
export function useFailureRaiseModal(options?: {
  onSubmitted?: () => void;
}): {
  openFailureRaise: (target: FailureRaiseTarget) => void;
  failureRaiseModal: ReactNode;
} {
  const { role } = useAppAccess();
  const [target, setTarget] = useState<FailureRaiseTarget | null>(null);

  const openFailureRaise = useCallback((next: FailureRaiseTarget) => {
    const po = next.poNumber.trim();
    const propertyId = next.propertyId.trim();
    if (!po || !propertyId) return;
    setTarget({
      poNumber: po,
      propertyId,
      deedNumber: next.deedNumber?.trim() || "",
      taskKind: next.taskKind,
    });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const raisedByRole = useMemo(
    () => raisedByRoleFor(role, target?.taskKind),
    [role, target?.taskKind],
  );
  const specialist = ROLES[role]?.name ?? "أخصائي";

  const failureRaiseModal = target ? (
    <FailureRaiseModal
      open
      onClose={close}
      poNumber={target.poNumber}
      propertyId={target.propertyId}
      deedNumber={target.deedNumber ?? ""}
      specialist={specialist}
      raisedByRole={raisedByRole}
      onSubmitted={() => {
        options?.onSubmitted?.();
        close();
      }}
    />
  ) : null;

  return { openFailureRaise, failureRaiseModal };
}
